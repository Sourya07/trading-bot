import type { MatchData, StrategyData, PositionData, AgentLogData, SettlementData, OddsHistoryPoint, DevnetProgramStatus } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  getDevnetStatus: () => fetchJson<DevnetProgramStatus>(`${API_BASE}/devnet/status`),

  getFixtures: () => fetchJson<MatchData[]>(`${API_BASE}/fixtures`),

  getMatch: (matchId: string) => fetchJson<MatchData>(`${API_BASE}/fixtures/${matchId}`),

  getOddsHistory: (matchId: string, limit = 100) =>
    fetchJson<OddsHistoryPoint[]>(`${API_BASE}/fixtures/${matchId}/odds-history?limit=${limit}`),

  startSimulation: (matchId: string) =>
    fetchJson<{ ok: boolean }>(`${API_BASE}/fixtures/${matchId}/start-simulation`, { method: "POST" }),

  fastForward: (matchId: string) =>
    fetchJson<{ ok: boolean }>(`${API_BASE}/fixtures/${matchId}/fast-forward`, { method: "POST" }),

  createStrategy: (wallet: string, matchId: string, template: string, ruleConfig: Record<string, unknown>, anchorStrategySignature?: string | null) =>
    fetchJson<StrategyData>(`${API_BASE}/strategies`, {
      method: "POST",
      body: JSON.stringify({ wallet, match_id: matchId, template, rule_config: ruleConfig, anchor_strategy_signature: anchorStrategySignature }),
    }),

  getStrategies: (wallet: string) =>
    fetchJson<StrategyData[]>(`${API_BASE}/strategies?wallet=${wallet}`),

  toggleAgent: (strategyId: string, active: boolean) =>
    fetchJson<StrategyData>(`${API_BASE}/strategies/${strategyId}/toggle-agent`, {
      method: "POST",
      body: JSON.stringify({ active }),
    }),

  getAgentLogs: (strategyId: string) =>
    fetchJson<AgentLogData[]>(`${API_BASE}/strategies/${strategyId}/logs`),

  getPositions: (strategyId: string) =>
    fetchJson<PositionData[]>(`${API_BASE}/strategies/${strategyId}/positions`),

  createPosition: (data: {
    strategy_id: string;
    match_id: string;
    wallet: string;
    side: string;
    entry_odds: number;
    stake_credits: number;
    position_type: string;
    trigger_reason: string;
    anchor_position_signature?: string | null;
  }) =>
    fetchJson<PositionData>(`${API_BASE}/positions`, {
      method: "POST",
      body: JSON.stringify({
        ...data,
        anchor_position_signature: data.anchor_position_signature
      }),
    }),

  getMatchPositions: (matchId: string) =>
    fetchJson<PositionData[]>(`${API_BASE}/positions/${matchId}`),

  getWallet: (address: string) =>
    fetchJson<{ address: string; balance: number }>(`${API_BASE}/wallet/${address}`),

  getSettlements: (matchId: string) =>
    fetchJson<SettlementData[]>(`${API_BASE}/settlements/${matchId}`),

  recordSettlementSignature: (positionId: string, signature: string) =>
    fetchJson<{ ok: boolean }>(`${API_BASE}/settlements/${positionId}/anchor-signature`, {
      method: "POST",
      body: JSON.stringify({ signature }),
    }),
};
