import { useEffect, useRef, useCallback } from "react";
import { useTerminalStore } from "./store";
import { api } from "./api";
import type { WsMessage } from "./types";

export function useTxLineSocket(walletAddress?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const updateMatchData = useTerminalStore((s) => s.updateMatchData);
  const addAgentLog = useTerminalStore((s) => s.addAgentLog);
  const addPosition = useTerminalStore((s) => s.addPosition);
  const addOddsPoint = useTerminalStore((s) => s.addOddsPoint);
  const setSettlements = useTerminalStore((s) => s.setSettlements);
  const handleMessage = useCallback(
    (msg: WsMessage) => {
      const currentMatch = useTerminalStore.getState().currentMatch;
      if (!currentMatch) return;

      switch (msg.type) {
        case "match_update":
          if (msg.data.match_id === currentMatch.match_id) {
            updateMatchData(msg.data);
            if (msg.data.implied_prob_home && msg.data.implied_prob_away) {
              addOddsPoint({
                recorded_at: new Date().toISOString(),
                odds_home: msg.data.odds_home || 0,
                odds_away: msg.data.odds_away || 0,
                implied_prob_home: msg.data.implied_prob_home || 0,
                implied_prob_away: msg.data.implied_prob_away || 0,
              });
            }
          }
          break;
        case "match_settled":
          if (msg.data.matchId === currentMatch.match_id) {
            updateMatchData({ status: "final", txline_result_hash: msg.data.hash });
          }
          break;
        case "agent_event":
          if (msg.data.position) {
            addPosition(msg.data.position);
          }
          if (msg.data.message) {
            addAgentLog({
              id: crypto.randomUUID(),
              strategy_id: msg.data.strategy_id,
              match_id: currentMatch.match_id,
              event_type: msg.data.event_type || "info",
              message: msg.data.message,
              txline_snapshot: {},
              created_at: new Date().toISOString(),
            });
          }
          break;
        case "position_settled":
          api.getSettlements(currentMatch.match_id).then(setSettlements).catch(() => {});
          if (walletAddress) {
            api.getWallet(walletAddress).then((w) => {
              useTerminalStore.getState().setWalletBalance(w.balance);
            }).catch(console.error);
          }
          break;
      }
    },
    [walletAddress, updateMatchData, addAgentLog, addPosition, addOddsPoint, setSettlements]
  );

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closed = false;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to TxHedge server");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          handleMessage(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [handleMessage]);

  return wsRef;
}
