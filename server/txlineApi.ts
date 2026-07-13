/**
 * TxLINE API Client
 * Connects to the TxLINE data feed for real-time World Cup odds & scores.
 * Uses the free World Cup tier (service level 1) on devnet.
 */
import { config } from "dotenv";
config();

// ─── Network Configuration ───────────────────────────────────────────
const TXLINE_CONFIG = {
  devnet: {
    apiOrigin: "https://txline-dev.txodds.com",
    programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
    txlTokenMint: "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
  },
  mainnet: {
    apiOrigin: "https://txline.txodds.com",
    programId: "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
    txlTokenMint: "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL",
  },
} as const;

type Network = keyof typeof TXLINE_CONFIG;
const network = (process.env.TXLINE_NETWORK || "devnet") as Network;
const cfg = TXLINE_CONFIG[network];

export const TXLINE_API_ORIGIN = cfg.apiOrigin;
export const TXLINE_API_BASE = `${cfg.apiOrigin}/api`;
export const TXLINE_PROGRAM_ID = cfg.programId;

// ─── Credential Management ──────────────────────────────────────────
let guestJwt = process.env.TXLINE_JWT || "";
let apiToken = process.env.TXLINE_API_TOKEN || "";

export function hasTxLineCredentials(): boolean {
  return Boolean(guestJwt && apiToken);
}

export function setTxLineCredentials(jwt: string, token: string) {
  guestJwt = jwt;
  apiToken = token;
}

/** Acquire a fresh guest JWT from TxLINE */
export async function refreshGuestJwt(): Promise<string> {
  try {
    const res = await fetch(`${cfg.apiOrigin}/auth/guest/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Guest auth failed: ${res.status}`);
    const data = await res.json();
    guestJwt = data.token;
    console.log("[TxLINE] Guest JWT refreshed successfully");
    return guestJwt;
  } catch (err) {
    console.error("[TxLINE] Failed to refresh guest JWT:", err);
    throw err;
  }
}

/** Build auth headers for TxLINE data API requests */
function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${guestJwt}`,
    "X-Api-Token": apiToken,
    "Content-Type": "application/json",
  };
}

// ─── Odds Endpoints ─────────────────────────────────────────────────

export type TxLineOddsSnapshot = {
  FixtureId: number;
  SuperOddsType: string;
  Timestamp: string;
  Odds: Array<{
    OddsId: number;
    Param1?: number;
    Param2?: number;
    SP?: number;
    StablePrice?: number;
    StablePricePerc?: number;
    OtbFL?: boolean;
  }>;
};

/** Fetch the latest odds snapshot for a specific fixture */
export async function getOddsSnapshot(fixtureId: number): Promise<TxLineOddsSnapshot | null> {
  try {
    const res = await fetch(`${TXLINE_API_BASE}/odds/snapshot/${fixtureId}`, {
      headers: authHeaders(),
    });
    if (res.status === 401) {
      await refreshGuestJwt();
      return getOddsSnapshot(fixtureId);
    }
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[TxLINE] Odds snapshot failed for fixture ${fixtureId}:`, err);
    return null;
  }
}

// ─── Scores Endpoints ───────────────────────────────────────────────

export type TxLineScoreUpdate = {
  fixtureId: number;
  seq: number;
  ts: string;
  gameState?: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  [key: string]: unknown;
};

/** Fetch historical score updates for a fixture */
export async function getHistoricalScores(fixtureId: number): Promise<TxLineScoreUpdate[]> {
  try {
    const res = await fetch(`${TXLINE_API_BASE}/scores/historical/${fixtureId}`, {
      headers: authHeaders(),
    });
    if (res.status === 401) {
      await refreshGuestJwt();
      return getHistoricalScores(fixtureId);
    }
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error(`[TxLINE] Historical scores failed for fixture ${fixtureId}:`, err);
    return [];
  }
}

// ─── SSE Stream Connections ─────────────────────────────────────────

export type SseMessage = {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
};

function parseSseBlock(block: string): SseMessage | null {
  const message: SseMessage = { data: "" };

  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;

    const separatorIndex = rawLine.indexOf(":");
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const value =
      separatorIndex === -1
        ? ""
        : rawLine.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "data") message.data += `${value}\n`;
    if (field === "event") message.event = value;
    if (field === "id") message.id = value;
    if (field === "retry") message.retry = Number(value);
  }

  message.data = message.data.replace(/\n$/, "");
  return message.data || message.event || message.id ? message : null;
}

export function parseSseData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export type StreamCallback = (event: string, data: unknown) => void;

/**
 * Connect to a TxLINE SSE stream. Returns a cleanup function.
 * Handles auto-reconnection and JWT refresh on 401.
 */
export async function connectSseStream(
  path: string,
  onMessage: StreamCallback,
  onError?: (err: Error) => void
): Promise<() => void> {
  let aborted = false;
  let controller = new AbortController();

  async function connect() {
    if (aborted) return;

    try {
      console.log(`[TxLINE] Connecting to SSE stream: ${path}`);
      const res = await fetch(`${TXLINE_API_BASE}${path}`, {
        headers: {
          ...authHeaders(),
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      });

      if (res.status === 401) {
        console.log("[TxLINE] SSE 401 — refreshing JWT and reconnecting...");
        await refreshGuestJwt();
        setTimeout(connect, 1000);
        return;
      }

      if (!res.ok) {
        throw new Error(`SSE stream failed: ${res.status} ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error("SSE response has no body");
      }

      console.log(`[TxLINE] SSE stream connected: ${path}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done || aborted) break;

        buffer += decoder.decode(value, { stream: true });

        let separator = buffer.match(/\r?\n\r?\n/);
        while (separator?.index !== undefined) {
          const block = buffer.slice(0, separator.index);
          buffer = buffer.slice(separator.index + separator[0].length);

          const message = parseSseBlock(block);
          if (message) {
            onMessage(message.event ?? "message", parseSseData(message.data));
          }

          separator = buffer.match(/\r?\n\r?\n/);
        }
      }
    } catch (err) {
      if (aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[TxLINE] SSE stream error (${path}):`, error.message);
      onError?.(error);
    }

    // Auto-reconnect after 3s unless aborted
    if (!aborted) {
      console.log(`[TxLINE] Reconnecting SSE stream in 3s: ${path}`);
      setTimeout(connect, 3000);
    }
  }

  connect();

  return () => {
    aborted = true;
    controller.abort();
  };
}

/**
 * Connect to TxLINE odds stream
 */
export function connectOddsStream(onMessage: StreamCallback): Promise<() => void> {
  return connectSseStream("/odds/stream", onMessage);
}

/**
 * Connect to TxLINE scores stream
 */
export function connectScoresStream(onMessage: StreamCallback): Promise<() => void> {
  return connectSseStream("/scores/stream", onMessage);
}
