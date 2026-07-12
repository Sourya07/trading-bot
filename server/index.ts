import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { query, queryOne } from "./db";
import { getMatches, getMatch, getOddsHistory, seedInitialOddsHistory } from "./txline";
import {
  createStrategy,
  getStrategies,
  getStrategy,
  toggleAgent,
  getAgentLogs,
  createPosition,
  getPositions,
  handleGoalEvent,
  settleAllForMatch,
} from "./agent/strategyEngine";
import { startTxLineWorker, startMatchSimulation, fastForwardMatch } from "./workers/txlineWorker";
import { hashSnapshot } from "./txline";
import { runMigrations } from "./migrate";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const clients = new Set<WebSocket>();

wss.on("connection", (ws: WebSocket) => {
  clients.add(ws);
  console.log(`WebSocket client connected. Total: ${clients.size}`);

  ws.on("message", async (message: Buffer) => {
    try {
      const msg = JSON.parse(message.toString());
      if (msg.type === "subscribe" && msg.matchId) {
        ws.send(JSON.stringify({ type: "subscribed", matchId: msg.matchId }));
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`WebSocket client disconnected. Total: ${clients.size}`);
  });
});

// Routes

app.get("/api/fixtures", async (_req, res) => {
  const matches = await getMatches();
  res.json(matches);
});

app.get("/api/fixtures/:matchId", async (req, res) => {
  const match = await getMatch(req.params.matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  res.json(match);
});

app.get("/api/fixtures/:matchId/odds-history", async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const history = await getOddsHistory(req.params.matchId, limit);
  res.json(history);
});

app.post("/api/fixtures/:matchId/start-simulation", async (req, res) => {
  await startMatchSimulation(req.params.matchId);
  res.json({ ok: true });
});

app.post("/api/fixtures/:matchId/fast-forward", async (req, res) => {
  await fastForwardMatch(req.params.matchId);
  res.json({ ok: true });
});

app.post("/api/strategies", async (req, res) => {
  const { wallet, match_id, template, rule_config } = req.body;
  if (!wallet || !match_id) {
    res.status(400).json({ error: "wallet and match_id are required" });
    return;
  }
  const strategy = await createStrategy(wallet, match_id, template || "goal_shift_hedge", rule_config || {});
  res.json(strategy);
});

app.get("/api/strategies", async (req, res) => {
  const wallet = req.query.wallet as string;
  const strategies = await getStrategies(wallet);
  res.json(strategies);
});

app.get("/api/strategies/:strategyId", async (req, res) => {
  const strategy = await getStrategy(req.params.strategyId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  res.json(strategy);
});

app.post("/api/strategies/:strategyId/toggle-agent", async (req, res) => {
  const { active } = req.body;
  const strategy = await toggleAgent(req.params.strategyId, active, clients);
  res.json(strategy);
});

app.get("/api/strategies/:strategyId/logs", async (req, res) => {
  const logs = await getAgentLogs(req.params.strategyId);
  res.json(logs);
});

app.get("/api/strategies/:strategyId/positions", async (req, res) => {
  const positions = await getPositions(req.params.strategyId);
  res.json(positions);
});

app.post("/api/positions", async (req, res) => {
  const { strategy_id, match_id, wallet, side, entry_odds, stake_credits, position_type, trigger_reason } = req.body;
  if (!strategy_id || !match_id || !wallet || !side) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const snapshot = {
    match_id,
    side,
    entry_odds,
    timestamp: new Date().toISOString(),
  };
  const snapshotHash = hashSnapshot(snapshot);
  const position = await createPosition(
    strategy_id,
    match_id,
    wallet,
    side,
    entry_odds,
    stake_credits || 100,
    position_type || "primary",
    trigger_reason || "Manual position",
    snapshotHash,
    null
  );
  res.json(position);
});

app.get("/api/positions/:matchId", async (req, res) => {
  try {
    const data = await query(
      `SELECT * FROM positions WHERE match_id = $1 ORDER BY created_at DESC`,
      [req.params.matchId]
    );
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get("/api/wallet/:address", async (req, res) => {
  try {
    const wallet = await queryOne<{ address: string; balance: number; created_at: string }>(
      `SELECT * FROM wallets WHERE address = $1`,
      [req.params.address]
    );
    if (!wallet) {
      // Auto-create wallet with 1000 credits
      const newWallet = await queryOne<{ address: string; balance: number; created_at: string }>(
        `INSERT INTO wallets (address, balance) VALUES ($1, 1000) RETURNING *`,
        [req.params.address]
      );
      res.json(newWallet);
      return;
    }
    res.json(wallet);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get("/api/settlements/:matchId", async (req, res) => {
  try {
    // Join settlements with positions to replicate Supabase's `select("*, positions(*)")`
    const data = await query(
      `SELECT s.*, row_to_json(p.*) as positions
       FROM settlements s
       LEFT JOIN positions p ON s.position_id = p.id
       WHERE s.match_id = $1
       ORDER BY s.settled_at DESC`,
      [req.params.matchId]
    );
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

const PORT = parseInt(process.env.PORT || "3001");

server.listen(PORT, async () => {
  console.log(`TxHedge server running on port ${PORT}`);
  await runMigrations();
  await seedInitialOddsHistory();
  startTxLineWorker(clients, async (matchId, scoringTeam, minute) => {
    await handleGoalEvent(matchId, scoringTeam, minute, clients);
  });
});
