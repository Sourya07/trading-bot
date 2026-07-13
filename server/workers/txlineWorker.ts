import type { WebSocket } from "ws";
import { query, queryOne } from "../db";
import { getMatches, getMatch, updateMatchOdds, updateMatchScore, finalizeMatch } from "../txline";
import type { TxLineSnapshot } from "../txline";
import { decimalToImpliedProb } from "../txline";
import { settleAllForMatch, getOpenPositions } from "../agent/strategyEngine";
import { hasTxLineCredentials, connectOddsStream, connectScoresStream } from "../txlineApi";

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

  // Retrieve current match details from database
  const match = await getMatch(state.matchId);
  if (!match) return;

  if (state.minute >= 90) {
    state.active = false;
    const hash = await finalizeMatch(state.matchId, state.homeScore, state.awayScore);
    await settleAllForMatch(state.matchId, state.homeScore, state.awayScore, hash || "mock-hash", clients);
    const snapshot: TxLineSnapshot = {
      match_id: state.matchId,
      home_team: match.home_team,
      away_team: match.away_team,
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
      state.lastEvent = `Goal! ${match.home_team} scored in minute ${state.minute}`;
    } else {
      state.awayScore += 1;
      state.lastEvent = `Goal! ${match.away_team} scored in minute ${state.minute}`;
    }
    await updateMatchScore(state.matchId, state.homeScore, state.awayScore, "live", state.lastEvent);
    await onGoal(state.matchId, scoringTeam, state.minute);
  } else {
    // Read actual current odds from database
    const currentOddsHome = Number(match.odds_home) || 2.0;
    const currentOddsAway = Number(match.odds_away) || 2.0;
    const currentOddsDraw = Number(match.odds_draw) || 3.0;

    // Simulate minor random walk drift (approx ±0.01 - ±0.06 per tick)
    const drift = (Math.random() - 0.5) * 0.12;
    const nextOddsHome = Math.round(Math.max(1.05, Math.min(50, currentOddsHome + drift)) * 100) / 100;
    const nextOddsAway = Math.round(Math.max(1.05, Math.min(50, currentOddsAway - drift)) * 100) / 100;
    
    // Slight drift on Draw odds
    const drawDrift = (Math.random() - 0.5) * 0.04;
    const nextOddsDraw = Math.round(Math.max(1.05, Math.min(50, currentOddsDraw + drawDrift)) * 100) / 100;

    // Write updated drifted odds back to the database
    await updateMatchOdds(state.matchId, nextOddsHome, nextOddsAway, nextOddsDraw);
    await updateMatchScore(state.matchId, state.homeScore, state.awayScore, "live", state.lastEvent);

    const probHome = decimalToImpliedProb(nextOddsHome);
    const probAway = decimalToImpliedProb(nextOddsAway);

    broadcast(clients, {
      type: "match_update",
      data: {
        match_id: state.matchId,
        status: "live",
        score_home: state.homeScore,
        score_away: state.awayScore,
        odds_home: nextOddsHome,
        odds_away: nextOddsAway,
        odds_draw: nextOddsDraw,
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
  // Start simulation loop (poller runs every 3s)
  setInterval(async () => {
    const matches = await getMatches();
    for (const match of matches) {
      // Self-healing: if match is already finalized but has open positions, settle them!
      if (match.status === "final") {
        try {
          const openPositions = await getOpenPositions(match.match_id);
          if (openPositions.length > 0) {
            console.log(`[TxLINE] Auto-settling ${openPositions.length} open positions for finalized match ${match.match_id}`);
            await settleAllForMatch(
              match.match_id,
              match.score_home,
              match.score_away,
              match.txline_result_hash || "mock-hash",
              clients
            );
          }
        } catch (err) {
          console.error("[TxLINE] Self-healing settlement check failed:", err);
        }
      }

      await ensureSim(match.match_id);
      const state = simulations.get(match.match_id);
      if (!state) continue;

      if (state.active) {
        await processMatch(state, clients, onGoal);
      }
    }

    broadcast(clients, { type: "fixtures_update", data: { count: matches.length } });
  }, 3000);

  // If TxLINE API credentials exist, connect to live SSE streams
  if (hasTxLineCredentials()) {
    console.log("[TxLINE] Connecting to live SSE data streams...");
    
    // Connect to scores stream to get live minute, scores, and events
    connectScoresStream((event, data: any) => {
      if (!data || !data.fixtureId) return;
      handleLiveScoreUpdate(data, clients, onGoal);
    }).catch(err => console.error("[TxLINE] Scores stream failed to start:", err));

    // Connect to odds stream to get live odds updates
    connectOddsStream((event, data: any) => {
      if (!data || !data.FixtureId) return;
      handleLiveOddsUpdate(data, clients);
    }).catch(err => console.error("[TxLINE] Odds stream failed to start:", err));
  } else {
    console.log("[TxLINE] No credentials configured. Running in local simulation mode.");
  }
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

export function resetWorkerSimulations() {
  simulations.clear();
}

// ─── Live Feed Event Handlers ────────────────────────────────────────

async function getMatchByFixtureId(fixtureId: number) {
  const matches = await getMatches();
  return matches.find((m: any) => {
    try {
      const data = typeof m.txline_data === "string" ? JSON.parse(m.txline_data) : m.txline_data;
      return data && Number(data.fixtureId) === Number(fixtureId);
    } catch {
      return false;
    }
  }) || null;
}

async function handleLiveScoreUpdate(data: any, clients: Set<WebSocket>, onGoal: any) {
  const match = await getMatchByFixtureId(data.fixtureId);
  if (!match) return;
  
  const matchId = match.match_id;
  const simState = simulations.get(matchId);
  
  // If the user has manually started a simulation for this match, ignore live feeds to avoid collisions
  if (simState && simState.active) {
    return;
  }
  
  const scoreHome = Number(data.homeScore ?? match.score_home);
  const scoreAway = Number(data.awayScore ?? match.score_away);
  const minute = Number(data.minute ?? 0);
  const gameState = data.gameState || "live";
  
  let status = "live";
  if (data.action === "game_finalised" || data.statusId === 100 || data.period === 100) {
    status = "final";
  } else if (gameState === "1") {
    status = "scheduled";
  }
  
  const homeGoal = scoreHome > match.score_home;
  const awayGoal = scoreAway > match.score_away;
  const lastEvent = homeGoal 
    ? `Goal! ${match.home_team} scored in minute ${minute}`
    : awayGoal 
      ? `Goal! ${match.away_team} scored in minute ${minute}`
      : match.status === "scheduled" && status === "live"
        ? "Match kickoff!"
        : null;
        
  if (status === "final") {
    const hash = await finalizeMatch(matchId, scoreHome, scoreAway);
    await settleAllForMatch(matchId, scoreHome, scoreAway, hash || "real-hash", clients);
    broadcast(clients, { 
      type: "match_settled", 
      data: { 
        matchId, 
        hash, 
        snapshot: {
          match_id: matchId,
          home_team: match.home_team,
          away_team: match.away_team,
          status: "final",
          score_home: scoreHome,
          score_away: scoreAway,
          minute,
          last_event: "Match finalized"
        }
      } 
    });
  } else {
    await updateMatchScore(matchId, scoreHome, scoreAway, status, lastEvent);
    
    broadcast(clients, {
      type: "match_update",
      data: {
        match_id: matchId,
        status,
        score_home: scoreHome,
        score_away: scoreAway,
        odds_home: Number(match.odds_home),
        odds_away: Number(match.odds_away),
        odds_draw: Number(match.odds_draw),
        minute,
        last_event: lastEvent || undefined,
      }
    });
    
    if (homeGoal) {
      await onGoal(matchId, "home", minute);
    } else if (awayGoal) {
      await onGoal(matchId, "away", minute);
    }
  }
}

async function handleLiveOddsUpdate(data: any, clients: Set<WebSocket>) {
  const match = await getMatchByFixtureId(data.FixtureId);
  if (!match) return;
  
  const matchId = match.match_id;
  const simState = simulations.get(matchId);
  
  if (simState && simState.active) {
    return;
  }
  
  if (!data.Odds || data.Odds.length < 3) return;
  
  const oddsHome = Number(data.Odds[0].SP || data.Odds[0].StablePrice || match.odds_home);
  const oddsAway = Number(data.Odds[2].SP || data.Odds[2].StablePrice || match.odds_away);
  const oddsDraw = Number(data.Odds[1].SP || data.Odds[1].StablePrice || match.odds_draw);
  
  await updateMatchOdds(matchId, oddsHome, oddsAway, oddsDraw);
  
  const probHome = decimalToImpliedProb(oddsHome);
  const probAway = decimalToImpliedProb(oddsAway);
  
  broadcast(clients, {
    type: "match_update",
    data: {
      match_id: matchId,
      status: match.status,
      score_home: match.score_home,
      score_away: match.score_away,
      odds_home: oddsHome,
      odds_away: oddsAway,
      odds_draw: oddsDraw,
      implied_prob_home: Math.round(probHome * 10) / 10,
      implied_prob_away: Math.round(probAway * 10) / 10,
      minute: simState ? simState.minute : 0,
    }
  });
}
