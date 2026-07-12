import type { WebSocket } from "ws";
import { query, queryOne } from "../db";
import { getMatches, updateMatchScore, finalizeMatch } from "../txline";
import type { TxLineSnapshot } from "../txline";
import { decimalToImpliedProb } from "../txline";

type SimState = {
  matchId: string;
  minute: number;
  active: boolean;
  homeScore: number;
  awayScore: number;
  lastEvent: string | null;
  baseOddsHome: number;
  baseOddsAway: number;
  oddsDrift: number;
};

const simulations = new Map<string, SimState>();

function broadcast(clients: Set<WebSocket>, msg: unknown) {
  const data = JSON.stringify(msg);
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(data);
  });
}

async function ensureSim(matchId: string) {
  if (simulations.has(matchId)) return;
  const data = await queryOne<{
    match_id: string;
    status: string;
    score_home: number;
    score_away: number;
    odds_home: number;
    odds_away: number;
  }>(
    `SELECT match_id, status, score_home, score_away, odds_home, odds_away FROM matches WHERE match_id = $1`,
    [matchId]
  );
  if (!data) return;
  simulations.set(matchId, {
    matchId,
    minute: 0,
    active: data.status === "live",
    homeScore: data.score_home || 0,
    awayScore: data.score_away || 0,
    lastEvent: null,
    baseOddsHome: Number(data.odds_home),
    baseOddsAway: Number(data.odds_away),
    oddsDrift: 0,
  });
}

function simulateOddsDrift(state: SimState) {
  state.oddsDrift += (Math.random() - 0.5) * 0.02;
  state.oddsDrift = Math.max(-0.1, Math.min(0.1, state.oddsDrift));
  const homeOdds = Math.max(1.1, state.baseOddsHome + state.oddsDrift);
  const awayOdds = Math.max(1.1, state.baseOddsAway - state.oddsDrift);
  return { homeOdds, awayOdds };
}

async function processMatch(
  state: SimState,
  clients: Set<WebSocket>,
  onGoal: (matchId: string, scoringTeam: "home" | "away", minute: number) => Promise<void>
) {
  if (!state.active) return;

  state.minute += 1;

  if (state.minute >= 90) {
    state.active = false;
    const hash = await finalizeMatch(state.matchId, state.homeScore, state.awayScore);
    const snapshot: TxLineSnapshot = {
      match_id: state.matchId,
      home_team: "",
      away_team: "",
      status: "final",
      score_home: state.homeScore,
      score_away: state.awayScore,
      odds_home: 0,
      odds_away: 0,
      odds_draw: 0,
      implied_prob_home: 0,
      implied_prob_away: 0,
      minute: 90,
      last_event: "Match finalized",
      timestamp: new Date().toISOString(),
    };
    broadcast(clients, { type: "match_settled", data: { matchId: state.matchId, hash, snapshot } });
    return;
  }

  const goalChance = 0.04;
  if (Math.random() < goalChance) {
    const scoringTeam = Math.random() < 0.5 ? "home" : "away";
    if (scoringTeam === "home") {
      state.homeScore += 1;
      state.lastEvent = `Goal! ${scoringTeam === "home" ? "Home" : "Away"} scored in minute ${state.minute}`;
    } else {
      state.awayScore += 1;
      state.lastEvent = `Goal! Away scored in minute ${state.minute}`;
    }
    await updateMatchScore(state.matchId, state.homeScore, state.awayScore, "live", state.lastEvent);
    await onGoal(state.matchId, scoringTeam, state.minute);
  } else {
    const { homeOdds, awayOdds } = simulateOddsDrift(state);
    const probHome = decimalToImpliedProb(homeOdds);
    const probAway = decimalToImpliedProb(awayOdds);
    await updateMatchScore(state.matchId, state.homeScore, state.awayScore, "live", state.lastEvent);
    broadcast(clients, {
      type: "match_update",
      data: {
        match_id: state.matchId,
        status: "live",
        score_home: state.homeScore,
        score_away: state.awayScore,
        odds_home: Math.round(homeOdds * 100) / 100,
        odds_away: Math.round(awayOdds * 100) / 100,
        implied_prob_home: Math.round(probHome * 10) / 10,
        implied_prob_away: Math.round(probAway * 10) / 10,
        minute: state.minute,
        last_event: state.lastEvent,
      },
    });
  }
}

export function startTxLineWorker(
  clients: Set<WebSocket>,
  onGoal: (matchId: string, scoringTeam: "home" | "away", minute: number) => Promise<void>
) {
  setInterval(async () => {
    const matches = await getMatches();
    for (const match of matches) {
      await ensureSim(match.match_id);
      const state = simulations.get(match.match_id);
      if (!state) continue;

      if (match.status === "live" || state.active) {
        if (!state.active && match.status === "live") {
          state.active = true;
        }
        await processMatch(state, clients, onGoal);
      }
    }

    broadcast(clients, { type: "fixtures_update", data: { count: matches.length } });
  }, 3000);
}

export async function startMatchSimulation(matchId: string): Promise<void> {
  await ensureSim(matchId);
  const state = simulations.get(matchId);
  if (!state) return;

  state.active = true;
  state.minute = 0;
  state.homeScore = 0;
  state.awayScore = 0;
  state.lastEvent = null;

  await query(
    `UPDATE matches SET status = 'live', score_home = 0, score_away = 0, updated_at = now() WHERE match_id = $1`,
    [matchId]
  );
}

export async function fastForwardMatch(matchId: string): Promise<void> {
  await ensureSim(matchId);
  const state = simulations.get(matchId);
  if (!state) return;

  state.active = true;
  state.minute = 85;
  if (state.homeScore === 0 && state.awayScore === 0) {
    state.homeScore = 1;
    state.awayScore = 1;
  }
  await updateMatchScore(matchId, state.homeScore, state.awayScore, "live", "Fast-forwarded to minute 85");
}
