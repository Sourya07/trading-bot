import { create } from "zustand";
import type { MatchData, StrategyData, PositionData, AgentLogData, SettlementData, OddsHistoryPoint } from "./types";

type TerminalState = {
  matches: MatchData[];
  currentMatch: MatchData | null;
  oddsHistory: OddsHistoryPoint[];
  strategy: StrategyData | null;
  positions: PositionData[];
  agentLogs: AgentLogData[];
  settlements: SettlementData[];
  liveMinute: number;
  lastEvent: string | null;
  walletBalance: number;

  setMatches: (matches: MatchData[]) => void;
  setCurrentMatch: (match: MatchData | null) => void;
  updateMatchData: (data: Partial<MatchData> & { minute?: number; last_event?: string | null }) => void;
  setOddsHistory: (history: OddsHistoryPoint[]) => void;
  addOddsPoint: (point: OddsHistoryPoint) => void;
  setStrategy: (strategy: StrategyData | null) => void;
  setPositions: (positions: PositionData[]) => void;
  addPosition: (position: PositionData) => void;
  setAgentLogs: (logs: AgentLogData[]) => void;
  addAgentLog: (log: AgentLogData) => void;
  setSettlements: (settlements: SettlementData[]) => void;
  setWalletBalance: (balance: number) => void;
  reset: () => void;
};

export const useTerminalStore = create<TerminalState>((set) => ({
  matches: [],
  currentMatch: null,
  oddsHistory: [],
  strategy: null,
  positions: [],
  agentLogs: [],
  settlements: [],
  liveMinute: 0,
  lastEvent: null,
  walletBalance: 1000,

  setMatches: (matches) => set({ matches }),
  setCurrentMatch: (match) => set({ currentMatch: match, oddsHistory: [], positions: [], agentLogs: [], settlements: [], strategy: null, liveMinute: 0, lastEvent: null }),
  updateMatchData: (data) =>
    set((state) => {
      if (!state.currentMatch) return {};
      const updated = { ...state.currentMatch, ...data } as MatchData;
      return {
        currentMatch: updated,
        liveMinute: data.minute ?? state.liveMinute,
        lastEvent: data.last_event ?? state.lastEvent,
        matches: state.matches.map((m) => (m.match_id === updated.match_id ? updated : m)),
      };
    }),
  setOddsHistory: (history) => set({ oddsHistory: history }),
  addOddsPoint: (point) => set((state) => ({ oddsHistory: [...state.oddsHistory, point].slice(-100) })),
  setStrategy: (strategy) => set({ strategy }),
  setPositions: (positions) => set({ positions }),
  addPosition: (position) => set((state) => ({ positions: [position, ...state.positions] })),
  setAgentLogs: (logs) => set({ agentLogs: logs }),
  addAgentLog: (log) => set((state) => ({ agentLogs: [log, ...state.agentLogs].slice(0, 50) })),
  setSettlements: (settlements) => set({ settlements }),
  setWalletBalance: (balance) => set({ walletBalance: balance }),
  reset: () => set({ currentMatch: null, oddsHistory: [], strategy: null, positions: [], agentLogs: [], settlements: [], liveMinute: 0, lastEvent: null }),
}));
