import { query, queryOne } from "./db";
import type { Match } from "./db";
import { createHash } from "crypto";

export type TxLineSnapshot = {
  match_id: string;
  home_team: string;
  away_team: string;
  status: string;
  score_home: number;
  score_away: number;
  odds_home: number;
  odds_away: number;
  odds_draw: number;
  implied_prob_home: number;
  implied_prob_away: number;
  minute: number;
  last_event: string | null;
  timestamp: string;
};

export function hashSnapshot(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export function decimalToImpliedProb(odds: number): number {
  return (1 / odds) * 100;
}

function clampOdds(odds: number): number {
  return Math.round(Math.max(1.05, Math.min(50, odds)) * 100) / 100;
}

function adjustOddsForScore(
  baseHome: number,
  baseAway: number,
  scoreHome: number,
  scoreAway: number
): { home: number; away: number; draw: number } {
  const diff = scoreHome - scoreAway;
  const factor = 1 - diff * 0.15;
  const newHome = clampOdds(baseHome / Math.max(0.3, factor));
  const newAway = clampOdds(baseAway * Math.max(0.3, factor));
  const drawBase = 3.2;
  const drawAdj = Math.abs(diff) === 0 ? 0.8 : 1 + Math.abs(diff) * 0.3;
  const draw = clampOdds(drawBase * drawAdj);
  return { home: newHome, away: newAway, draw };
}

export async function getMatches(): Promise<Match[]> {
  try {
    return await query<Match>(
      `SELECT * FROM matches ORDER BY kickoff_time ASC`
    );
  } catch (err) {
    console.error("Error fetching matches:", err);
    return [];
  }
}

export async function getMatch(matchId: string): Promise<Match | null> {
  try {
    return await queryOne<Match>(
      `SELECT * FROM matches WHERE match_id = $1`,
      [matchId]
    );
  } catch (err) {
    console.error("Error fetching match:", err);
    return null;
  }
}

export async function getOddsHistory(
  matchId: string,
  limit = 100
): Promise<Array<{ recorded_at: string; odds_home: number; odds_away: number; implied_prob_home: number; implied_prob_away: number }>> {
  try {
    return await query(
      `SELECT recorded_at, odds_home, odds_away, implied_prob_home, implied_prob_away
       FROM odds_history
       WHERE match_id = $1
       ORDER BY recorded_at ASC
       LIMIT $2`,
      [matchId, limit]
    );
  } catch (err) {
    console.error("Error fetching odds history:", err);
    return [];
  }
}

export async function updateMatchOdds(
  matchId: string,
  oddsHome: number,
  oddsAway: number,
  oddsDraw: number
): Promise<void> {
  const probHome = decimalToImpliedProb(oddsHome);
  const probAway = decimalToImpliedProb(oddsAway);

  try {
    await query(
      `UPDATE matches SET
        odds_home = $1, odds_away = $2, odds_draw = $3,
        implied_prob_home = $4, implied_prob_away = $5,
        updated_at = now()
       WHERE match_id = $6`,
      [oddsHome, oddsAway, oddsDraw, probHome, probAway, matchId]
    );
  } catch (err) {
    console.error("Error updating match odds:", err);
  }

  try {
    await query(
      `INSERT INTO odds_history (match_id, odds_home, odds_away, implied_prob_home, implied_prob_away)
       VALUES ($1, $2, $3, $4, $5)`,
      [matchId, oddsHome, oddsAway, probHome, probAway]
    );
  } catch (err) {
    console.error("Error inserting odds history:", err);
  }
}

export async function updateMatchScore(
  matchId: string,
  scoreHome: number,
  scoreAway: number,
  status: string,
  lastEvent: string | null
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) return;

  const adjusted = adjustOddsForScore(
    Number(match.odds_home),
    Number(match.odds_away),
    scoreHome,
    scoreAway
  );

  await updateMatchOdds(matchId, adjusted.home, adjusted.away, adjusted.draw);

  try {
    await query(
      `UPDATE matches SET
        score_home = $1, score_away = $2, status = $3, updated_at = now()
       WHERE match_id = $4`,
      [scoreHome, scoreAway, status, matchId]
    );
  } catch (err) {
    console.error("Error updating match score:", err);
  }
}

export async function finalizeMatch(
  matchId: string,
  scoreHome: number,
  scoreAway: number
): Promise<string | null> {
  const match = await getMatch(matchId);
  if (!match) return null;

  const resultPayload = {
    match_id: matchId,
    home_team: match.home_team,
    away_team: match.away_team,
    final_score_home: scoreHome,
    final_score_away: scoreAway,
    source: "txline",
    verified: true,
    timestamp: new Date().toISOString(),
  };
  const resultHash = hashSnapshot(resultPayload);

  try {
    await query(
      `UPDATE matches SET
        score_home = $1, score_away = $2, status = 'final',
        txline_result_hash = $3, updated_at = now()
       WHERE match_id = $4`,
      [scoreHome, scoreAway, resultHash, matchId]
    );
  } catch (err) {
    console.error("Error finalizing match:", err);
  }

  return resultHash;
}

export async function seedInitialOddsHistory(): Promise<void> {
  const matches = await getMatches();
  for (const match of matches) {
    const countResult = await queryOne<{ count: string }>(
      `SELECT count(*) as count FROM odds_history WHERE match_id = $1`,
      [match.match_id]
    );
    const count = parseInt(countResult?.count || "0", 10);

    if (count === 0) {
      const homeOdds = Number(match.odds_home);
      const awayOdds = Number(match.odds_away);
      for (let i = 0; i < 10; i++) {
        const drift = (Math.random() - 0.5) * 0.1;
        const h = Math.max(1.1, homeOdds + drift);
        const a = Math.max(1.1, awayOdds - drift);
        const recordedAt = new Date(Date.now() - (10 - i) * 30000).toISOString();
        await query(
          `INSERT INTO odds_history (match_id, odds_home, odds_away, implied_prob_home, implied_prob_away, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            match.match_id,
            Math.round(h * 100) / 100,
            Math.round(a * 100) / 100,
            Math.round(decimalToImpliedProb(h) * 10) / 10,
            Math.round(decimalToImpliedProb(a) * 10) / 10,
            recordedAt,
          ]
        );
      }
    }
  }
}

export async function getLatestSnapshot(matchId: string): Promise<TxLineSnapshot | null> {
  const match = await getMatch(matchId);
  if (!match) return null;
  return {
    match_id: match.match_id,
    home_team: match.home_team,
    away_team: match.away_team,
    status: match.status,
    score_home: match.score_home,
    score_away: match.score_away,
    odds_home: Number(match.odds_home),
    odds_away: Number(match.odds_away),
    odds_draw: Number(match.odds_draw),
    implied_prob_home: Number(match.implied_prob_home),
    implied_prob_away: Number(match.implied_prob_away),
    minute: 0,
    last_event: null,
    timestamp: new Date().toISOString(),
  };
}

export async function syncTxLineMatches(): Promise<void> {
  try {
    const { hasTxLineCredentials, TXLINE_API_BASE } = await import("./txlineApi");
    if (!hasTxLineCredentials()) {
      console.log("[TxLINE] Credentials not configured. Using fallback local matches.");
      return;
    }

    const jwt = process.env.TXLINE_JWT;
    const apiToken = process.env.TXLINE_API_TOKEN;
    const currentEpochDay = Math.floor(Date.now() / 86400000);
    const startEpoch = currentEpochDay - 10;

    console.log(`[TxLINE] Fetching fixtures starting from epoch day ${startEpoch}...`);
    const res = await fetch(`${TXLINE_API_BASE}/fixtures/snapshot?competitionId=72&startEpochDay=${startEpoch}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "X-Api-Token": apiToken!,
      }
    });

    if (!res.ok) {
      console.warn(`[TxLINE] Fixture sync request failed: ${res.status}`);
      return;
    }

    const fixtures = await res.json() as any[];
    console.log(`[TxLINE] Found ${fixtures.length} fixtures on devnet.`);

    const selected = fixtures
      .sort((a, b) => Number(a.StartTime) - Number(b.StartTime))
      .slice(0, 6);

    if (selected.length === 0) {
      console.log("[TxLINE] No fixtures returned by API. Using fallback mock matches.");
      return;
    }

    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const matchId = `wc-2026-00${i + 1}`;
      const kickoff = new Date(f.StartTime || Date.now()).toISOString();
      const homeTeam = f.Participant1 || "Home Team";
      const awayTeam = f.Participant2 || "Away Team";

      console.log(`[TxLINE] Syncing match ${matchId}: ${homeTeam} vs ${awayTeam} (FixtureId: ${f.FixtureId})`);

      const oddsHome = i === 0 ? 2.10 : i === 1 ? 1.85 : i === 2 ? 2.45 : i === 3 ? 2.65 : i === 4 ? 2.30 : 3.10;
      const oddsAway = i === 0 ? 3.40 : i === 1 ? 3.10 : i === 2 ? 2.70 : i === 3 ? 2.50 : i === 4 ? 2.80 : 2.20;
      const oddsDraw = i === 0 ? 2.56 : i === 1 ? 3.20 : i === 2 ? 3.10 : i === 3 ? 3.30 : i === 4 ? 3.20 : 3.15;

      const txlineData = JSON.stringify({
        fixtureId: f.FixtureId,
        participant1Id: f.Participant1Id,
        participant2Id: f.Participant2Id,
        gameState: f.GameState
      });

      const homeProb = Math.round((1 / oddsHome) * 100 * 10) / 10;
      const awayProb = Math.round((1 / oddsAway) * 100 * 10) / 10;

      await query(`
        INSERT INTO matches (
          match_id, home_team, away_team, status, score_home, score_away, 
          kickoff_time, odds_home, odds_away, odds_draw, implied_prob_home, implied_prob_away, 
          txline_data, txline_result_hash, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
        ON CONFLICT (match_id) DO UPDATE SET
          home_team = EXCLUDED.home_team,
          away_team = EXCLUDED.away_team,
          kickoff_time = EXCLUDED.kickoff_time,
          txline_data = EXCLUDED.txline_data,
          updated_at = now()
      `, [
        matchId, homeTeam, awayTeam, "scheduled", 0, 0,
        kickoff, oddsHome, oddsAway, oddsDraw, homeProb, awayProb,
        txlineData, null
      ]);
    }

    console.log("[TxLINE] Successfully synced fixtures with database.");
  } catch (err) {
    console.error("[TxLINE] Error syncing matches:", err);
  }
}
