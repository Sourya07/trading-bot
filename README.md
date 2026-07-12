# TxHedge — Cinematic Sports Hedging Terminal

An autonomous strategy execution terminal and risk-hedging agent for live World Cup fixtures, powered by cryptographically-anchored **TxLINE** sports odds data and simulated **Solana** settlement proofs.

Designed for the **TxLINE Data Layer Track** on Superteam Earn.

---

## 🌟 Key Highlights & Features

*   **Cinematic Scroll-Driven Video Backdrop**: Features an optimized GPU frame pre-caching canvas engine that preloads `/football.mp4` into `ImageBitmap` buffers. On scroll, it draws pre-decoded frames directly to an HTML5 `<canvas>` at **60FPS fluid video scrubbing** with zero browser seek-latency.
*   **Autonomous Strategy Agent Engine**: Deploy automated hedging bots in real-time. Supports three core programmatic strategy templates:
    1.  **Goal-Shift Hedge**: Automatically places cover positions on the opposing side when a goal is conceded to hedge downside exposure.
    2.  **Momentum Engine**: Detects rapid changes in implied probabilities and enters positions to ride shifts in score momentum.
    3.  **Mean Reversion**: Capitalizes on temporary odds spikes that drift away from the historical base rates.
*   **Cryptographic Proof Anchoring**: Every odds update and agent trade is hashed using SHA256 and anchored to a simulated Solana proof ledger. Users can view verification logs, block timestamps, and cryptographic proof hashes directly on the terminal dashboard.
*   **Live Area Charts & Live Counters**: Full SVG probability trend visualization showing active odds histories with glowing cyber-neon themes, side-by-side with animated score counters and live event ticker logs.
*   **Serverless Database Layer**: Built on **Neon DB** using raw parameterized SQL migrations and seeding for ultra-fast, robust state persistence.

---

## ⚡ Quickstart

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Database Setup
Ensure you have a PostgreSQL or Neon connection string configured in `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/txhedge
```

Run database migrations to initialize matches, strategies, positions, and logs:
```bash
npm run migrate
```

### 3. Run Development Server
Start the client and the backend background worker concurrently:
```bash
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

## 📂 Project Architecture

```
├── anchor/                  # Anchor Rust Solana smart contract (mocked)
├── server/                  
│   ├── agent/               # Strategy Engine (Goal-Shift, Momentum, Mean Reversion)
│   ├── workers/             # TxLINE feed ingestion worker & Match simulation loop
│   ├── db.ts                # Neon Database clients & SQL queries
│   ├── index.ts             # REST API & WebSocket server
│   └── txline.ts            # TxLINE data schema parsing & odds calculations
├── src/                     
│   ├── components/          # React components (HomeHero, FixtureLobby, TradingTerminal, Charts)
│   ├── lib/                 # Phantom Wallet integration, API client, & WebSocket hooks
│   └── App.tsx              # Page navigation & GPU Canvas video scrubber
```

---

## 🛰️ TxLINE API & Data Ingestion

TxHedge ingests granular feeds structured under the unified TxLINE schema:

1.  **`/fixtures`**: Fetches all 6 World Cup demo matches, status indicators (`scheduled` / `live` / `final`), and base odds.
2.  **`/fixtures/{fixture_id}/odds`**: Used by the `strategyEngine` to track live 3-way moneyline odds (Home, Draw, Away) and calculate implied probabilities (`1 / odds`).
3.  **`/fixtures/{fixture_id}/scores`**: Listens to score change events and minute-by-minute updates. If a goal is detected, it triggers the active **Goal-Shift Hedge** strategy instantly.

---

## 💬 Hackathon Feedback & Developer Experience

### What We Liked Most
*   **Normalized JSON Schema**: The single, normalized schema across leagues and events made parsing odds and scoring objects incredibly simple. It saved us from writing custom adapters for different team structures.
*   **Granularity of Feeds**: Having minute-by-minute progression and live events as separate fields made building the event-driven **Goal-Shift** agent logic clean and deterministic.

### Areas of Friction
*   **WebSocket Documentation**: Clarifying the exact real-time payload structures and event frames for live games in the developer docs would speed up initial mock integrations. We ended up writing our own robust socket worker wrapper (`useTxLineSocket`) to abstract reconnects and payload formatting.
