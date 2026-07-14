export type MatchData = {
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
  implied_prob_draw: number;
  txline_data: Record<string, unknown>;
  txline_result_hash: string | null;
  updated_at: string;
};

export type StrategyData = {
  id: string;
  wallet: string;
  match_id: string;
  template: string;
  rule_config: Record<string, unknown>;
  agent_active: boolean;
  anchor_strategy_signature: string | null;
  created_at: string;
};

export type PositionData = {
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

export type AgentLogData = {
  id: string;
  strategy_id: string | null;
  match_id: string | null;
  event_type: string;
  message: string;
  txline_snapshot: Record<string, unknown>;
  created_at: string;
};

export type SettlementData = {
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
  positions?: PositionData;
};

export type DevnetProgramStatus = {
  cluster: string;
  rpcUrl: string;
  programId: string;
  deployed: boolean;
  executable: boolean;
  owner: string | null;
  lamports: number | null;
  explorerUrl: string;
  error: string | null;
};

export type OddsHistoryPoint = {
  recorded_at: string;
  odds_home: number;
  odds_away: number;
  odds_draw: number;
  implied_prob_home: number;
  implied_prob_away: number;
  implied_prob_draw: number;
};

export type WsMessage =
  | { type: "match_update"; data: Partial<MatchData> & { minute?: number; last_event?: string | null } }
  | { type: "match_settled"; data: { matchId: string; hash: string | null; snapshot: unknown } }
  | { type: "agent_event"; data: { strategy_id: string; event_type?: string; message?: string; position?: PositionData; active?: boolean; txline_snapshot?: any } }
  | { type: "position_settled"; data: { position_id: string; match_id: string; final_outcome: string; pnl: number; txline_result_hash: string } }
  | { type: "fixtures_update"; data: { count: number } }
  | { type: "subscribed"; matchId: string };
