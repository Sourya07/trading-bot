# TxHedge — Cinematic Sports Hedging Terminal

An autonomous strategy execution terminal and risk-hedging agent for live World Cup fixtures, powered by cryptographically-anchored **TxLINE** sports odds data and simulated **Solana** settlement proofs.

Designed for the **TxLINE Data Layer Track** on Superteam Earn.

---

##  Key Highlights & Features

*   **Cinematic Scroll-Driven Video Backdrop**: Features an optimized GPU frame pre-caching canvas engine that preloads `/football.mp4` into `ImageBitmap` buffers. On scroll, it draws pre-decoded frames directly to an HTML5 `<canvas>` at **60FPS fluid video scrubbing** with zero browser seek-latency.
*   **Autonomous Strategy Agent Engine**: Deploy automated hedging bots in real-time. Supports three core programmatic strategy templates:
    1.  **Goal-Shift Hedge**: Automatically places cover positions on the opposing side when a goal is conceded to hedge downside exposure.
    2.  **Momentum Engine**: Detects rapid changes in implied probabilities and enters positions to ride shifts in score momentum.
    3.  **Mean Reversion**: Capitalizes on temporary odds spikes that drift away from the historical base rates.
*   **Institutional Quant Mathematics**:
    - **Dynamic Stake Sizing (Kelly Criterion)**: The agent dynamically calculates its mathematical edge against implied market probabilities to execute optimal fractional Half-Kelly stakes instead of flat bets.
    - **Time-Decay (Theta) Poisson Model**: Evaluates the match clock to safely bypass hedges if a lead is statistically secure late in the match, avoiding mathematically inefficient risk offsets.
*   **Immutable Execution Proofs**: Every LLM-reasoned trade generates a verifiable JSON state snapshot of the live TxLINE odds and clock. This payload is hashed and visualized in a cyberpunk-styled **[Verify Proof]** UI modal, simulating Solana Anchor on-chain transparency for hackathon demonstrations.
*   **On-Chain Solana Integration**: Strategy registries and position entries are executed directly on the **Solana Devnet** via Phantom. When a match ends, the user signs a transaction on-chain calling the program's `settle_position` instruction to claim their payout.
*   **Gemini 2.5 Flash Reasoning**: Integrates the **Gemini API** to analyze live scorelines, strategies, and odds in real-time, outputting dynamic quant-style reasoning logs directly to the terminal feed.
*   **Neon DB with In-Memory Fallback**: Built on **Neon DB** using raw SQL migrations. If the remote database is unreachable, the server automatically falls back to an in-memory database mode with full live streams and simulations active.

---

## ⚡ Quickstart

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Configuration (.env)
Configure the following keys in your `.env` file:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/txhedge

# Solana (Devnet)
SOLANA_PRIVATE_KEY=your_base58_private_key
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# TxLINE Live Feed Credentials
TXLINE_NETWORK=devnet
TXLINE_JWT=your_jwt_token
TXLINE_API_TOKEN=your_activated_api_token

# Gemini AI reasoning
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Development Server
Start the client and Express backend concurrently:
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## Project Architecture

![System Architecture Diagram](./image.png)
```
├── anchor/                  # Anchor Rust Solana smart contract
│   └── programs/txhedge     # Instruction logic (create_strategy, create_position, settle_position)
├── server/                  
│   ├── agent/               # Strategy Engine & Gemini 2.5 reasoning logic
│   ├── workers/             # TxLINE SSE feed worker & Simulation ticker loop
│   ├── db.ts                # Neon Database clients & In-Memory fallback store
│   ├── index.ts             # REST API, WebSocket server, & static asset serving
│   └── txline.ts            # Fixture sync helper & snapshot parsing
├── src/                     
│   ├── components/          # React views (Lobby, TradingTerminal, Charts, ProofPanel)
│   ├── lib/                 # Phantom Wallet adapter, API client, & Solana Anchor client
│   └── App.tsx              # Page routing & 60FPS Video backdrop canvas
```

---

## TxLINE API & Data Ingestion

TxHedge ingests real-time sports odds and progression feeds from the following devnet endpoints:

1.  **`/api/fixtures/snapshot?competitionId=72`** (HTTP GET): Fetches the initial fixtures, kickoff times, and participant details to seed the database on server start.
2.  **`https://txline-dev.txodds.com/odds/stream`** (SSE): Persistently streams live 3-way moneyline odds (Home, Draw, Away) and updates implied probabilities dynamically.
3.  **`https://txline-dev.txodds.com/scores/stream`** (SSE): Streams real-time score changes, elapsed minutes, and match status updates to trigger the agent's automated hedging decisions.

---

##  On-Chain Anchor Program Details

- **Program ID**: `BZ6W4B9Te3nnZWXd19QSaTXDxTF1rtC1je8roTDrorrk` (Deployed on Solana Devnet)
- **Instructions Used**:
  - `create_strategy`: Registers the active trading rules and SHA256 parameters on-chain.
  - `create_position`: Deposits the credit stakes and entry odds bps on-chain.
  - `settle_position`: Resolves payouts against verified final scores on-chain.

---

## Hackathon Feedback & Developer Experience

### What We Liked Most
*   **Normalized JSON Schema**: The single, normalized schema across competitions made parsing odds and scoring updates incredibly simple. It saved us from writing custom adapters.
*   **Granularity of Feeds**: Having minute-by-minute progression and live events as separate SSE channels made building the event-driven **Goal-Shift** agent logic clean and deterministic.

### Areas of Friction
*   **SSE Authentication Challenges**: The token challenge registration is a bit complex for newcomers. We solved this by writing a custom one-time setup script (`txlineSetup.ts`) to manage registration and challenge signing programmatically.

