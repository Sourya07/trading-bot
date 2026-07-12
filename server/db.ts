import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { config } from "dotenv";

config();

// Neon serverless driver needs a WebSocket constructor for Node.js
neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({ connectionString: databaseUrl });

// Helper: run a query and return rows
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

// Helper: run a query and return the first row or null
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) || null;
}

export type Match = {
  match_id: string;
  home_team: string;
  away_team: string;
  status: string;
  score_home: number;
  score_away: number;
  kickoff_time: string | null;
  odds_home: number;
  odds_away: number;
  odds_draw: number;
  implied_prob_home: number;
  implied_prob_away: number;
  txline_data: Record<string, unknown>;
  txline_result_hash: string | null;
  updated_at: string;
};

export type Strategy = {
  id: string;
  wallet: string;
  match_id: string;
  template: string;
  rule_config: Record<string, unknown>;
  agent_active: boolean;
  anchor_strategy_signature: string | null;
  created_at: string;
};

export type Position = {
  id: string;
  strategy_id: string;
  match_id: string;
  wallet: string;
  side: string;
  entry_odds: number;
  stake_credits: number;
  status: string;
  position_type: string;
  trigger_reason: string | null;
  txline_snapshot_hash: string | null;
  anchor_position_signature: string | null;
  pnl_credits: number;
  created_at: string;
  settled_at: string | null;
};

export type AgentLog = {
  id: string;
  strategy_id: string | null;
  match_id: string | null;
  event_type: string;
  message: string;
  txline_snapshot: Record<string, unknown>;
  created_at: string;
};

export type Settlement = {
  id: string;
  position_id: string;
  match_id: string;
  final_outcome: string;
  final_score_home: number;
  final_score_away: number;
  txline_result_hash: string | null;
  anchor_settle_signature: string | null;
  pnl_credits: number;
  settled_at: string;
};
