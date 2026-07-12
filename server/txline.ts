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
