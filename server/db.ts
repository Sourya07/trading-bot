import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { config } from "dotenv";
import { randomUUID } from "crypto";

config();

// Neon serverless driver needs a WebSocket constructor for Node.js
neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;

// Global fallback flag
export let useInMemoryDb = !databaseUrl;

export const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

// In-Memory Database store
class InMemoryStore {
  matches = new Map<string, any>();
  strategies = new Map<string, any>();
  positions = new Map<string, any>();
  logs = new Map<string, any[]>();
  settlements = new Map<string, any>();
  wallets = new Map<string, any>();
  oddsHistory = new Map<string, any[]>();

  constructor() {
    this.seed();
  }

  seed() {
    const defaultMatches = [
      {
        match_id: "wc-2026-001",
        home_team: "Brazil",
        away_team: "Germany",
        status: "scheduled",
        score_home: 0,
        score_away: 0,
        kickoff_time: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
        odds_home: 2.1,
        odds_away: 3.4,
        odds_draw: 2.56,
        implied_prob_home: 47.6,
        implied_prob_away: 29.4,
        txline_data: { stage: "World Cup 2026" },
        txline_result_hash: null,
        updated_at: new Date().toISOString()
      },
      {
        match_id: "wc-2026-002",
        home_team: "Argentina",
        away_team: "France",
        status: "scheduled",
        score_home: 0,
        score_away: 0,
        kickoff_time: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
        odds_home: 1.85,
        odds_away: 3.1,
        odds_draw: 3.0,
        implied_prob_home: 54.0,
        implied_prob_away: 32.2,
        txline_data: { stage: "World Cup 2026" },
        txline_result_hash: null,
        updated_at: new Date().toISOString()
      },
      {
        match_id: "wc-2026-003",
        home_team: "Spain",
        away_team: "England",
        status: "scheduled",
        score_home: 0,
        score_away: 0,
        kickoff_time: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        odds_home: 2.3,
        odds_away: 3.0,
        odds_draw: 3.2,
        implied_prob_home: 43.5,
        implied_prob_away: 33.3,
        txline_data: { stage: "World Cup 2026" },
        txline_result_hash: null,
        updated_at: new Date().toISOString()
      },
      {
        match_id: "wc-2026-004",
        home_team: "Portugal",
        away_team: "Netherlands",
        status: "scheduled",
        score_home: 0,
        score_away: 0,
        kickoff_time: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        odds_home: 2.6,
        odds_away: 2.7,
        odds_draw: 3.15,
        implied_prob_home: 38.5,
        implied_prob_away: 37.0,
        txline_data: { stage: "World Cup 2026" },
        txline_result_hash: null,
        updated_at: new Date().toISOString()
      },
      {
        match_id: "wc-2026-005",
        home_team: "Italy",
        away_team: "Belgium",
        status: "scheduled",
        score_home: 0,
        score_away: 0,
        kickoff_time: new Date(Date.now() + 1000 * 60 * 120).toISOString(),
        odds_home: 2.4,
        odds_away: 2.9,
        odds_draw: 2.56,
        implied_prob_home: 41.6,
        implied_prob_away: 34.4,
        txline_data: { stage: "World Cup 2026" },
        txline_result_hash: null,
        updated_at: new Date().toISOString()
      },
      {
        match_id: "wc-2026-006",
        home_team: "Mexico",
        away_team: "USA",
        status: "scheduled",
        score_home: 0,
        score_away: 0,
        kickoff_time: new Date(Date.now() + 1000 * 60 * 240).toISOString(),
        odds_home: 3.1,
        odds_away: 2.2,
        odds_draw: 3.3,
        implied_prob_home: 32.3,
        implied_prob_away: 45.5,
        txline_data: { stage: "World Cup 2026" },
        txline_result_hash: null,
        updated_at: new Date().toISOString()
      }
    ];
    for (const m of defaultMatches) {
      this.matches.set(m.match_id, m);
      this.oddsHistory.set(m.match_id, [
        {
          recorded_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          odds_home: m.odds_home,
          odds_away: m.odds_away,
          implied_prob_home: m.implied_prob_home,
          implied_prob_away: m.implied_prob_away
        }
      ]);
    }
  }
}

export const inMemoryStore = new InMemoryStore();

export function setUseInMemoryDb(val: boolean) {
  useInMemoryDb = val;
}

function runInMemoryQuery<T>(text: string, params?: any[]): T[] {
  const sql = text.replace(/\s+/g, " ").trim();

  // 1. SELECT * FROM matches ORDER BY kickoff_time ASC
  if (sql.includes("SELECT * FROM matches ORDER BY kickoff_time ASC")) {
    const list = Array.from(inMemoryStore.matches.values());
    list.sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
    return list as unknown as T[];
  }

  // 2. SELECT * FROM matches WHERE match_id = $1
  if (sql.includes("SELECT * FROM matches WHERE match_id = $1")) {
    const match = inMemoryStore.matches.get(params?.[0]);
    return (match ? [match] : []) as unknown as T[];
  }

  // 3. SELECT match_id, status, score_home, score_away, odds_home, odds_away FROM matches WHERE match_id = $1
  if (sql.includes("SELECT match_id, status, score_home, score_away, odds_home, odds_away FROM matches WHERE match_id = $1")) {
    const match = inMemoryStore.matches.get(params?.[0]);
    if (!match) return [] as unknown as T[];
    return [{
      match_id: match.match_id,
      status: match.status,
      score_home: match.score_home,
      score_away: match.score_away,
      odds_home: match.odds_home,
      odds_away: match.odds_away
    }] as unknown as T[];
  }

  // 4. UPDATE matches SET score_home = $1, score_away = $2, status = $3, updated_at = now() WHERE match_id = $4
  // We can match substring to cover multi-line UPDATE statements
  if (sql.includes("UPDATE matches SET") && sql.includes("score_home = $1, score_away = $2")) {
    const matchId = params?.[3];
    const match = inMemoryStore.matches.get(matchId);
    if (match) {
      match.score_home = params?.[0];
      match.score_away = params?.[1];
      match.status = params?.[2];
      match.updated_at = new Date().toISOString();
    }
    return [] as unknown as T[];
  }

  // 5. UPDATE matches SET odds_home = $1, odds_away = $2, odds_draw = $3, implied_prob_home = $4, implied_prob_away = $5, updated_at = now() WHERE match_id = $6
  if (sql.includes("UPDATE matches SET") && sql.includes("odds_home = $1, odds_away = $2")) {
    const matchId = params?.[5];
    const match = inMemoryStore.matches.get(matchId);
    if (match) {
      match.odds_home = params?.[0];
      match.odds_away = params?.[1];
      match.odds_draw = params?.[2];
      match.implied_prob_home = params?.[3];
      match.implied_prob_away = params?.[4];
      match.updated_at = new Date().toISOString();
    }
    return [] as unknown as T[];
  }

  // 6. UPDATE matches SET status = 'live', score_home = 0, score_away = 0, updated_at = now() WHERE match_id = $1
  if (sql.includes("UPDATE matches SET status = 'live', score_home = 0, score_away = 0")) {
    const matchId = params?.[0];
    const match = inMemoryStore.matches.get(matchId);
    if (match) {
      match.status = "live";
      match.score_home = 0;
      match.score_away = 0;
      match.updated_at = new Date().toISOString();
    }
    return [] as unknown as T[];
  }

  // 7. UPDATE matches SET score_home = $1, score_away = $2, status = 'final', txline_result_hash = $3, updated_at = now() WHERE match_id = $4
  if (sql.includes("UPDATE matches SET") && sql.includes("txline_result_hash = $3")) {
    const matchId = params?.[3];
    const match = inMemoryStore.matches.get(matchId);
    if (match) {
      match.score_home = params?.[0];
      match.score_away = params?.[1];
      match.txline_result_hash = params?.[2];
      match.status = "final";
      match.updated_at = new Date().toISOString();
    }
    return [] as unknown as T[];
  }

  // 8. SELECT * FROM strategies WHERE wallet = $1
  if (sql.includes("SELECT * FROM strategies WHERE wallet = $1")) {
    const list = Array.from(inMemoryStore.strategies.values()).filter(s => s.wallet === params?.[0]);
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list as unknown as T[];
  }

  // 9. SELECT * FROM strategies ORDER BY created_at DESC
  if (sql.includes("SELECT * FROM strategies ORDER BY created_at DESC") || sql.includes("SELECT * FROM strategies ORDER BY")) {
    const list = Array.from(inMemoryStore.strategies.values());
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list as unknown as T[];
  }

  // 10. SELECT * FROM strategies WHERE id = $1
  if (sql.includes("SELECT * FROM strategies WHERE id = $1")) {
    const strat = inMemoryStore.strategies.get(params?.[0]);
    return (strat ? [strat] : []) as unknown as T[];
  }

  // 11. INSERT INTO strategies
  if (sql.includes("INSERT INTO strategies")) {
    const rawConfig = params?.[3];
    const newStrat = {
      id: randomUUID(),
      wallet: params?.[0],
      match_id: params?.[1],
      template: params?.[2],
      rule_config: typeof rawConfig === "string" ? JSON.parse(rawConfig) : rawConfig,
      agent_active: params?.[4] || false,
      anchor_strategy_signature: params?.[5] || null,
      created_at: new Date().toISOString()
    };
    inMemoryStore.strategies.set(newStrat.id, newStrat);
    return [newStrat] as unknown as T[];
  }

  // 12. UPDATE strategies SET agent_active = $1 WHERE id = $2 RETURNING *
  if (sql.includes("UPDATE strategies SET agent_active = $1 WHERE id = $2 RETURNING *")) {
    const strat = inMemoryStore.strategies.get(params?.[1]);
    if (strat) {
      strat.agent_active = params?.[0];
    }
    return (strat ? [strat] : []) as unknown as T[];
  }

  // 13. SELECT * FROM positions WHERE strategy_id = $1
  if (sql.includes("SELECT * FROM positions WHERE strategy_id = $1")) {
    const list = Array.from(inMemoryStore.positions.values()).filter(p => p.strategy_id === params?.[0]);
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list as unknown as T[];
  }

  // 14. SELECT * FROM positions WHERE match_id = $1 AND status = 'open'
  if (sql.includes("SELECT * FROM positions WHERE match_id = $1 AND status = 'open'")) {
    const list = Array.from(inMemoryStore.positions.values()).filter(p => p.match_id === params?.[0] && p.status === "open");
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list as unknown as T[];
  }

  // 15. SELECT * FROM positions WHERE match_id = $1 ORDER BY created_at DESC
  if (sql.includes("SELECT * FROM positions WHERE match_id = $1 ORDER BY created_at DESC") || sql.includes("SELECT * FROM positions WHERE match_id = $1 ORDER BY")) {
    const list = Array.from(inMemoryStore.positions.values()).filter(p => p.match_id === params?.[0]);
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list as unknown as T[];
  }

  // 16. INSERT INTO positions
  if (sql.includes("INSERT INTO positions")) {
    const newPos = {
      id: randomUUID(),
      strategy_id: params?.[0],
      match_id: params?.[1],
      wallet: params?.[2],
      side: params?.[3],
      entry_odds: params?.[4],
      stake_credits: params?.[5],
      status: params?.[6] || "open",
      position_type: params?.[7] || "primary",
      trigger_reason: params?.[8],
      txline_snapshot_hash: params?.[9],
      anchor_position_signature: params?.[10],
      pnl_credits: 0,
      created_at: new Date().toISOString(),
      settled_at: null
    };
    inMemoryStore.positions.set(newPos.id, newPos);
    return [newPos] as unknown as T[];
  }

  // 17. UPDATE positions SET status = 'settled', pnl_credits = $1, settled_at = now() WHERE id = $2
  if (sql.includes("UPDATE positions SET status = 'settled'")) {
    const pos = inMemoryStore.positions.get(params?.[1]);
    if (pos) {
      pos.status = "settled";
      pos.pnl_credits = params?.[0];
      pos.settled_at = new Date().toISOString();
    }
    return [] as unknown as T[];
  }

  // 18. SELECT * FROM wallets WHERE address = $1
  if (sql.includes("SELECT * FROM wallets WHERE address = $1")) {
    const w = inMemoryStore.wallets.get(params?.[0]);
    return (w ? [w] : []) as unknown as T[];
  }

  // 19. SELECT balance FROM wallets WHERE address = $1
  if (sql.includes("SELECT balance FROM wallets WHERE address = $1")) {
    const w = inMemoryStore.wallets.get(params?.[0]);
    return (w ? [{ balance: w.balance }] : []) as unknown as T[];
  }

  // 20. INSERT INTO wallets
  if (sql.includes("INSERT INTO wallets")) {
    const newWallet = {
      address: params?.[0],
      balance: params?.[1] ?? 1000,
      created_at: new Date().toISOString()
    };
    inMemoryStore.wallets.set(newWallet.address, newWallet);
    return [newWallet] as unknown as T[];
  }

  // 21. UPDATE wallets SET balance = $1 WHERE address = $2
  if (sql.includes("UPDATE wallets SET balance = $1 WHERE address = $2")) {
    const w = inMemoryStore.wallets.get(params?.[1]);
    if (w) {
      w.balance = params?.[0];
    }
    return [] as unknown as T[];
  }

  // 22. SELECT recorded_at, odds_home, odds_away, implied_prob_home, implied_prob_away FROM odds_history WHERE match_id = $1 ORDER BY recorded_at ASC LIMIT $2
  if (sql.includes("FROM odds_history WHERE match_id = $1")) {
    const history = inMemoryStore.oddsHistory.get(params?.[0]) || [];
    const limit = params?.[1] || 100;
    return history.slice(-limit) as unknown as T[];
  }

  // 23. INSERT INTO odds_history
  if (sql.includes("INSERT INTO odds_history")) {
    const matchId = params?.[0];
    if (!inMemoryStore.oddsHistory.has(matchId)) {
      inMemoryStore.oddsHistory.set(matchId, []);
    }
    const newHistory = {
      recorded_at: new Date().toISOString(),
      odds_home: params?.[1],
      odds_away: params?.[2],
      implied_prob_home: params?.[3],
      implied_prob_away: params?.[4]
    };
    inMemoryStore.oddsHistory.get(matchId)?.push(newHistory);
    return [] as unknown as T[];
  }

  // 24. SELECT * FROM agent_logs WHERE strategy_id = $1 ORDER BY created_at DESC LIMIT 50
  if (sql.includes("FROM agent_logs WHERE strategy_id = $1")) {
    const stratLogs = inMemoryStore.logs.get(params?.[0]) || [];
    return stratLogs.slice(0, 50) as unknown as T[];
  }

  // 25. INSERT INTO agent_logs
  if (sql.includes("INSERT INTO agent_logs")) {
    const stratId = params?.[0];
    if (!inMemoryStore.logs.has(stratId)) {
      inMemoryStore.logs.set(stratId, []);
    }
    const rawSnapshot = params?.[4];
    const newLog = {
      id: randomUUID(),
      strategy_id: stratId,
      match_id: params?.[1],
      event_type: params?.[2],
      message: params?.[3],
      txline_snapshot: typeof rawSnapshot === "string" ? JSON.parse(rawSnapshot) : rawSnapshot,
      created_at: new Date().toISOString()
    };
    inMemoryStore.logs.get(stratId)?.unshift(newLog);
    return [newLog] as unknown as T[];
  }

  // 26. SELECT s.*, row_to_json(p.*) as positions FROM settlements s LEFT JOIN positions p ON s.position_id = p.id WHERE s.match_id = $1 ORDER BY s.settled_at DESC
  if (sql.includes("FROM settlements s LEFT JOIN positions p")) {
    const list = Array.from(inMemoryStore.settlements.values()).filter(s => s.match_id === params?.[0]);
    const results = list.map(s => {
      const p = inMemoryStore.positions.get(s.position_id);
      return {
        ...s,
        positions: p || null
      };
    });
    results.sort((a, b) => new Date(b.settled_at).getTime() - new Date(a.settled_at).getTime());
    return results as unknown as T[];
  }

  // 27. INSERT INTO settlements
  if (sql.includes("INSERT INTO settlements")) {
    const newSettle = {
      id: randomUUID(),
      position_id: params?.[0],
      match_id: params?.[1],
      final_outcome: params?.[2],
      final_score_home: params?.[3],
      final_score_away: params?.[4],
      txline_result_hash: params?.[5],
      anchor_settle_signature: params?.[6],
      pnl_credits: params?.[7] || 0,
      settled_at: new Date().toISOString()
    };
    inMemoryStore.settlements.set(newSettle.id, newSettle);
    return [newSettle] as unknown as T[];
  }

  // 28. INSERT INTO matches (with ON CONFLICT support)
  if (sql.includes("INSERT INTO matches")) {
    const matchId = params?.[0];
    const homeTeam = params?.[1];
    const awayTeam = params?.[2];
    const status = params?.[3];
    const scoreHome = params?.[4];
    const scoreAway = params?.[5];
    const kickoffTime = params?.[6];
    const oddsHome = params?.[7];
    const oddsAway = params?.[8];
    const oddsDraw = params?.[9];
    const impliedProbHome = params?.[10];
    const impliedProbAway = params?.[11];
    const txlineData = params?.[12];
    
    let parsedData = txlineData;
    if (typeof txlineData === "string") {
      try { parsedData = JSON.parse(txlineData); } catch {}
    }
    
    inMemoryStore.matches.set(matchId, {
      match_id: matchId,
      home_team: homeTeam,
      away_team: awayTeam,
      status,
      score_home: scoreHome,
      score_away: scoreAway,
      kickoff_time: kickoffTime,
      odds_home: oddsHome,
      odds_away: oddsAway,
      odds_draw: oddsDraw,
      implied_prob_home: impliedProbHome,
      implied_prob_away: impliedProbAway,
      txline_data: parsedData,
      txline_result_hash: null,
      updated_at: new Date().toISOString()
    });
    return [] as unknown as T[];
  }

  return [] as unknown as T[];
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: any[]
): Promise<T[]> {
  if (useInMemoryDb || !pool) {
    return runInMemoryQuery<T>(text, params);
  }
  try {
    const result = await pool.query(text, params);
    return result.rows as T[];
  } catch (err) {
    console.warn("Neon Database query failed. Falling back to In-Memory DB.", err);
    useInMemoryDb = true;
    return runInMemoryQuery<T>(text, params);
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
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

export function resetInMemoryStore() {
  inMemoryStore.matches.clear();
  inMemoryStore.strategies.clear();
  inMemoryStore.positions.clear();
  inMemoryStore.logs.clear();
  inMemoryStore.settlements.clear();
  inMemoryStore.wallets.clear();
  inMemoryStore.oddsHistory.clear();
  inMemoryStore.seed();
}

export async function resetDatabase() {
  if (useInMemoryDb || !pool) {
    resetInMemoryStore();
    return;
  }
  try {
    await pool.query("DELETE FROM settlements");
    await pool.query("DELETE FROM agent_logs");
    await pool.query("DELETE FROM positions");
    await pool.query("DELETE FROM strategies");
    await pool.query("DELETE FROM wallets");
    await pool.query("DELETE FROM odds_history");
    await pool.query(`
      UPDATE matches SET
        status = 'scheduled',
        score_home = 0,
        score_away = 0,
        txline_result_hash = null,
        updated_at = now()
    `);
    await pool.query("UPDATE matches SET odds_home = 2.10, odds_away = 3.40, odds_draw = 3.25 WHERE match_id = 'wc-2026-001'");
    await pool.query("UPDATE matches SET odds_home = 2.50, odds_away = 2.80, odds_draw = 3.10 WHERE match_id = 'wc-2026-002'");
    await pool.query("UPDATE matches SET odds_home = 2.30, odds_away = 3.00, odds_draw = 3.20 WHERE match_id = 'wc-2026-003'");
    await pool.query("UPDATE matches SET odds_home = 2.60, odds_away = 2.70, odds_draw = 3.15 WHERE match_id = 'wc-2026-004'");
    await pool.query("UPDATE matches SET odds_home = 2.40, odds_away = 2.90, odds_draw = 3.10 WHERE match_id = 'wc-2026-005'");
    await pool.query("UPDATE matches SET odds_home = 3.10, odds_away = 2.20, odds_draw = 3.30 WHERE match_id = 'wc-2026-006'");
  } catch (err) {
    console.error("Error resetting Postgres database:", err);
    resetInMemoryStore();
  }
}
