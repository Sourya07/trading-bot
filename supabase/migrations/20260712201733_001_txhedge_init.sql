/*
# TxHedge — Verifiable Sports Hedging Terminal

## Purpose
TxHedge ingests live World Cup match data from TxLINE (fixtures, odds, scores),
runs an automated hedging agent, creates paper positions, and settles them
on Solana devnet with verifiable proof.

## New Tables

1. `matches` — World Cup fixtures synced from TxLINE
   - `match_id` (text, PK) — TxLINE fixture ID
   - `home_team` / `away_team` (text) — team names
   - `status` (text) — scheduled | live | final
   - `score_home` / `score_away` (int) — current/final score
   - `kickoff_time` (timestamptz) — scheduled kickoff
   - `odds_home` / `odds_away` (numeric) — latest decimal odds
   - `odds_draw` (numeric) — latest draw odds (if applicable)
   - `implied_prob_home` / `implied_prob_away` (numeric) — implied probability %
   - `txline_data` (jsonb) — raw TxLINE snapshot
   - `txline_result_hash` (text) — SHA-256 of final TxLINE result payload
   - `updated_at` (timestamptz)

2. `odds_history` — time-series odds for charting
   - `id` (uuid, PK)
   - `match_id` (text, FK → matches)
   - `odds_home` / `odds_away` (numeric)
   - `implied_prob_home` / `implied_prob_away` (numeric)
   - `recorded_at` (timestamptz)

3. `strategies` — user-defined hedging strategies
   - `id` (uuid, PK)
   - `wallet` (text) — Solana wallet address
   - `match_id` (text, FK → matches)
   - `template` (text) — goal_shift_hedge | momentum | mean_reversion
   - `rule_config` (jsonb) — strategy parameters
   - `agent_active` (boolean) — whether agent is running
   - `anchor_strategy_signature` (text) — Solana tx signature for on-chain strategy
   - `created_at` (timestamptz)

4. `positions` — paper trading positions
   - `id` (uuid, PK)
   - `strategy_id` (uuid, FK → strategies)
   - `match_id` (text, FK → matches)
   - `wallet` (text) — Solana wallet address
   - `side` (text) — home | away | draw
   - `entry_odds` (numeric)
   - `stake_credits` (numeric) — mock USDC amount
   - `status` (text) — open | settled
   - `position_type` (text) — primary | hedge
   - `trigger_reason` (text) — human-readable agent reasoning
   - `txline_snapshot_hash` (text) — hash of TxLINE data at entry
   - `anchor_position_signature` (text) — Solana tx signature
   - `pnl_credits` (numeric) — realized P&L
   - `created_at` (timestamptz)
   - `settled_at` (timestamptz)

5. `agent_logs` — agent reasoning feed
   - `id` (uuid, PK)
   - `strategy_id` (uuid, FK → strategies)
   - `match_id` (text)
   - `event_type` (text) — info | trigger | settle | warning
   - `message` (text) — human-readable explanation
   - `txline_snapshot` (jsonb) — TxLINE data at event time
   - `created_at` (timestamptz)

6. `settlements` — settlement receipts with on-chain proof
   - `id` (uuid, PK)
   - `position_id` (uuid, FK → positions)
   - `match_id` (text)
   - `final_outcome` (text) — home | away | draw
   - `final_score_home` / `final_score_away` (int)
   - `txline_result_hash` (text) — verified TxLINE result hash
   - `anchor_settle_signature` (text) — Solana settlement tx signature
   - `pnl_credits` (numeric)
   - `settled_at` (timestamptz)

7. `wallets` — mock credit ledger
   - `address` (text, PK) — Solana wallet address
   - `balance` (numeric) — mock USDC credits
   - `created_at` (timestamptz)

## Security
- Single-tenant app (no Supabase auth — wallet-based identity via Phantom).
- RLS enabled on all tables with `TO anon, authenticated` policies.
- All data is intentionally shared/public for the hackathon demo.
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

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_matches" ON matches;
CREATE POLICY "anon_select_matches" ON matches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_matches" ON matches;
CREATE POLICY "anon_insert_matches" ON matches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_matches" ON matches;
CREATE POLICY "anon_update_matches" ON matches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_matches" ON matches;
CREATE POLICY "anon_delete_matches" ON matches FOR DELETE TO anon, authenticated USING (true);

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
CREATE INDEX IF NOT EXISTS idx_odds_history_match_id ON odds_history(match_id);
CREATE INDEX IF NOT EXISTS idx_odds_history_recorded_at ON odds_history(recorded_at);

ALTER TABLE odds_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_odds_history" ON odds_history;
CREATE POLICY "anon_select_odds_history" ON odds_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_odds_history" ON odds_history;
CREATE POLICY "anon_insert_odds_history" ON odds_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_odds_history" ON odds_history;
CREATE POLICY "anon_delete_odds_history" ON odds_history FOR DELETE TO anon, authenticated USING (true);

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

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_strategies" ON strategies;
CREATE POLICY "anon_select_strategies" ON strategies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_strategies" ON strategies;
CREATE POLICY "anon_insert_strategies" ON strategies FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_strategies" ON strategies;
CREATE POLICY "anon_update_strategies" ON strategies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_strategies" ON strategies;
CREATE POLICY "anon_delete_strategies" ON strategies FOR DELETE TO anon, authenticated USING (true);

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

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_positions" ON positions;
CREATE POLICY "anon_select_positions" ON positions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_positions" ON positions;
CREATE POLICY "anon_insert_positions" ON positions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_positions" ON positions;
CREATE POLICY "anon_update_positions" ON positions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_positions" ON positions;
CREATE POLICY "anon_delete_positions" ON positions FOR DELETE TO anon, authenticated USING (true);

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

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_agent_logs" ON agent_logs;
CREATE POLICY "anon_select_agent_logs" ON agent_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_agent_logs" ON agent_logs;
CREATE POLICY "anon_insert_agent_logs" ON agent_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_agent_logs" ON agent_logs;
CREATE POLICY "anon_delete_agent_logs" ON agent_logs FOR DELETE TO anon, authenticated USING (true);

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

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_settlements" ON settlements;
CREATE POLICY "anon_select_settlements" ON settlements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settlements" ON settlements;
CREATE POLICY "anon_insert_settlements" ON settlements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settlements" ON settlements;
CREATE POLICY "anon_delete_settlements" ON settlements FOR DELETE TO anon, authenticated USING (true);

-- Wallets table (mock credit ledger)
CREATE TABLE IF NOT EXISTS wallets (
  address text PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 1000,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_wallets" ON wallets;
CREATE POLICY "anon_select_wallets" ON wallets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_wallets" ON wallets;
CREATE POLICY "anon_insert_wallets" ON wallets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_wallets" ON wallets;
CREATE POLICY "anon_update_wallets" ON wallets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_wallets" ON wallets;
CREATE POLICY "anon_delete_wallets" ON wallets FOR DELETE TO anon, authenticated USING (true);
