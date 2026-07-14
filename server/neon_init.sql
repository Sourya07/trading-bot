/*
  TxHedge — Neon DB Schema
  Clean PostgreSQL schema without Supabase RLS policies.
*/

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  match_id text PRIMARY KEY,
  home_team text NOT NULL,
  away_team text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  score_home integer NOT NULL DEFAULT 0,
  score_away integer NOT NULL DEFAULT 0,
  kickoff_time timestamptz,
  odds_home numeric DEFAULT 2.0,
  odds_away numeric DEFAULT 2.0,
  odds_draw numeric DEFAULT 3.0,
  implied_prob_home numeric DEFAULT 50.0,
  implied_prob_away numeric DEFAULT 50.0,
  implied_prob_draw numeric DEFAULT 33.3,
  txline_data jsonb DEFAULT '{}'::jsonb,
  txline_result_hash text,
  updated_at timestamptz DEFAULT now()
);

-- Odds history table
CREATE TABLE IF NOT EXISTS odds_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  odds_home numeric NOT NULL,
  odds_away numeric NOT NULL,
  odds_draw numeric NOT NULL DEFAULT 3.0,
  implied_prob_home numeric NOT NULL,
  implied_prob_away numeric NOT NULL,
  implied_prob_draw numeric NOT NULL DEFAULT 33.3,
  recorded_at timestamptz DEFAULT now()
);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS implied_prob_draw numeric DEFAULT 33.3;
ALTER TABLE odds_history ADD COLUMN IF NOT EXISTS odds_draw numeric NOT NULL DEFAULT 3.0;
ALTER TABLE odds_history ADD COLUMN IF NOT EXISTS implied_prob_draw numeric NOT NULL DEFAULT 33.3;
CREATE INDEX IF NOT EXISTS idx_odds_history_match_id ON odds_history(match_id);
CREATE INDEX IF NOT EXISTS idx_odds_history_recorded_at ON odds_history(recorded_at);

-- Strategies table
CREATE TABLE IF NOT EXISTS strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  match_id text NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  template text NOT NULL DEFAULT 'goal_shift_hedge',
  rule_config jsonb DEFAULT '{}'::jsonb,
  agent_active boolean NOT NULL DEFAULT false,
  anchor_strategy_signature text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_strategies_wallet ON strategies(wallet);
CREATE INDEX IF NOT EXISTS idx_strategies_match_id ON strategies(match_id);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  match_id text NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  wallet text NOT NULL,
  side text NOT NULL,
  entry_odds numeric NOT NULL,
  stake_credits numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  position_type text NOT NULL DEFAULT 'primary',
  trigger_reason text,
  txline_snapshot_hash text,
  anchor_position_signature text,
  pnl_credits numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_positions_strategy_id ON positions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_positions_match_id ON positions(match_id);
CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet);

-- Agent logs table
CREATE TABLE IF NOT EXISTS agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategies(id) ON DELETE CASCADE,
  match_id text,
  event_type text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  txline_snapshot jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_logs_strategy_id ON agent_logs(strategy_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_match_id ON agent_logs(match_id);

-- Settlements table
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  match_id text NOT NULL,
  final_outcome text NOT NULL,
  final_score_home integer NOT NULL DEFAULT 0,
  final_score_away integer NOT NULL DEFAULT 0,
  txline_result_hash text,
  anchor_settle_signature text,
  pnl_credits numeric DEFAULT 0,
  settled_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_settlements_position_id ON settlements(position_id);
CREATE INDEX IF NOT EXISTS idx_settlements_match_id ON settlements(match_id);

-- Wallets table (mock credit ledger)
CREATE TABLE IF NOT EXISTS wallets (
  address text PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 1000,
  created_at timestamptz DEFAULT now()
);

-- Seed World Cup fixtures
INSERT INTO matches (match_id, home_team, away_team, status, odds_home, odds_away, odds_draw, implied_prob_home, implied_prob_away, implied_prob_draw, kickoff_time)
VALUES
  ('wc-2026-001', 'Brazil', 'Germany', 'scheduled', 2.10, 3.40, 3.25, 47.6, 29.4, 30.8, now() + interval '1 hour'),
  ('wc-2026-002', 'Argentina', 'France', 'scheduled', 2.50, 2.80, 3.10, 40.0, 35.7, 32.3, now() + interval '2 hours'),
  ('wc-2026-003', 'Spain', 'England', 'scheduled', 2.30, 3.00, 3.20, 43.5, 33.3, 31.3, now() + interval '3 hours'),
  ('wc-2026-004', 'Portugal', 'Netherlands', 'scheduled', 2.60, 2.70, 3.15, 38.5, 37.0, 31.7, now() + interval '4 hours'),
  ('wc-2026-005', 'Italy', 'Belgium', 'scheduled', 2.40, 2.90, 3.10, 41.7, 34.5, 32.3, now() + interval '5 hours'),
  ('wc-2026-006', 'Mexico', 'USA', 'scheduled', 3.10, 2.20, 3.30, 32.3, 45.5, 30.3, now() + interval '6 hours')
ON CONFLICT (match_id) DO NOTHING;
