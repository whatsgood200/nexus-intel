# ⚡ Nexus Intel — Autonomous Crypto Intelligence Agent

> **OOBE Protocol × Ace Data Cloud Bounty Submission**
> Category: Ace Data Cloud Usage — targeting 1st place ($700)

---

## What Problem It Solves

Professional crypto market intelligence requires teams of analysts, expensive data subscriptions, and hours of daily work. Nexus Intel automates the entire pipeline end-to-end — from live news aggregation to AI-written reports with generated cover art — running autonomously every 6 hours with zero human intervention. Every action is paid for autonomously in USDC via x402, logged on-chain for verifiability, and audited by Synapse Sentinel.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       NEXUS INTEL AGENT                          │
│                                                                   │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────────┐ │
│  │  Cron    │───▶│  Workflow    │───▶│   SAP Discovery        │ │
│  │ Scheduler│    │  Engine      │    │ (OOBE Protocol SAP)    │ │
│  └──────────┘    │  (11 steps)  │    └────────────────────────┘ │
│                  │              │                                 │
│                  │              │───▶┌────────────────────────┐ │
│                  │              │    │  Synapse Sentinel      │ │
│                  │              │    │  Verification          │ │
│                  │              │    └────────────────────────┘ │
│                  │              │                                 │
│                  │              │───▶┌────────────────────────┐ │
│                  │              │    │  Ace Data Cloud        │ │
│                  │              │    │  ├─ Web Search         │ │
│                  │              │    │  ├─ LLM (GPT-4o)       │ │
│                  │              │    │  └─ Image Gen          │ │
│                  │              │    │  (paid via x402 USDC)  │ │
│                  │              │    └────────────────────────┘ │
│                  │              │                                 │
│                  │              │───▶┌────────────────────────┐ │
│                  │              │    │  HTML Report Assembly  │ │
│                  └──────────────┘    └────────────────────────┘ │
│                         │                                         │
│                         ▼                                         │
│                  ┌──────────────┐    ┌────────────────────────┐ │
│                  │  On-chain    │───▶│  Solana Mainnet        │ │
│                  │  SPL Memo   │    │  (immutable audit log) │ │
│                  └──────────────┘    └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     NEXUS INTEL DASHBOARD                         │
│                                                                   │
│  React + Tailwind  ──▶  Express API  ──▶  Agent run-log.json   │
│  (port 5173)              (port 3001)                             │
│                                                                   │
│  Pages: Dashboard | Reports Gallery | On-Chain Verification      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11-Step Autonomous Workflow

| Step | Name | Description |
|------|------|-------------|
| 1 | Initialization | Load wallet, check SOL + USDC balances |
| 2 | SAP Tool Discovery | Discover agents/tools via OOBE Protocol SAP |
| 3 | Sentinel Verification | Verify Synapse Sentinel is active on mainnet |
| 4 | Ace Web Search | Gather live crypto news (x402 USDC payment) |
| 5 | Ace LLM: Analysis | Structured JSON sentiment analysis (x402 USDC) |
| 6 | Ace LLM: Narrative | 1,500-word market report (x402 USDC) |
| 7 | Ace LLM: Insights | Key insights, risks, opportunities (x402 USDC) |
| 8 | Ace Image Generation | AI-generated report cover (x402 USDC) |
| 9 | Report Assembly | Self-contained dark-themed HTML report |
| 10 | On-Chain Log | SPL Memo transaction on Solana mainnet |
| 11 | Sentinel Proof | SHA-256 proof hash submitted to Sentinel |

---

## Tech Stack

| Library | Role |
|---------|------|
| `@synapse-sap/sdk` | SAP mainnet registration + tool discovery |
| `@oobe-protocol-labs/synapse-client-sdk` | Synapse RPC connection layer |
| `@acedatacloud/sdk` | Ace Data Cloud — search, LLM, image gen |
| `@acedatacloud/x402-client` | Autonomous USDC x402 payment handler |
| `@coral-xyz/anchor` | Required peer dep for SAP SDK |
| `@solana/web3.js` | Solana transactions, SPL Memo |
| `@solana/spl-token` | USDC token balance checking |
| `bs58` | Base58 keypair decoding |
| `node-cron` | Cron scheduling (every 6h) |
| `winston` | Structured logging with file rotation |
| `express` | API server bridging frontend ↔ agent |
| React + Vite | Dashboard frontend |
| Tailwind CSS | Styling |
| `recharts` | Charts in dashboard |

---

## Bounty Compliance

| Requirement | File | Implementation |
|-------------|------|----------------|
| SAP Mainnet registration | `src/register-agent.ts` | `SapConnection.fromKeypair()` + `client.agent.register()` |
| End-to-end autonomous workflow | `src/core/workflow-engine.ts` | 11-step orchestrator, zero human intervention |
| ≥3 Ace Data Cloud services | `src/services/ace-client.ts` | Web Search + LLM (3 calls) + Image Gen |
| x402 USDC payment | `src/services/ace-client.ts` | `createX402PaymentHandler({ network: 'solana' })` |
| Ace facilitator URL | `src/config.ts` | `https://facilitator.acedata.cloud` |
| Synapse RPC | `src/utils/solana.ts` | `https://us-1-mainnet.oobeprotocol.ai/rpc` |
| Synapse Sentinel invoked | `src/services/sentinel.ts` | `client.discovery.getAgentProfile(sentinelPubkey)` |
| Sentinel address | `src/services/sentinel.ts` | `Ccr2yK3hLALU4p8oNRqrh4dGuvPJTth5KCLMio8cE1ph` |
| On-chain logging | `src/core/storage.ts` | SPL Memo program `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` |
| Unique content per cycle | `src/services/ace-client.ts` | Live news → live analysis → unique report ID |

---

## Prerequisites

- **Node.js 18+**
- **Solana wallet** funded with:
  - At least **0.05 SOL** for transaction fees (registration + memo txs)
  - At least **1 USDC** (SPL, Solana mainnet) for Ace x402 payments
- **Synapse RPC API key** — free tier at https://synapse.oobeprotocol.ai
- **Ace Data Cloud** — x402 mode works without an API key (pays per request in USDC)

USDC Solana mainnet mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `SOLANA_PRIVATE_KEY` — your base58 private key
- `SYNAPSE_RPC_API_KEY` — from https://synapse.oobeprotocol.ai
- All other values have sensible defaults

### 3. Register on SAP Mainnet (one time)

```bash
npm run register
```

This registers your agent on OOBE Protocol SAP mainnet and saves the registration to `agent-registration.json`.

### 4. Test a single cycle

```bash
RUN_ONCE=true npm start
```

Watch it:
1. Discover SAP tools
2. Verify Sentinel
3. Search crypto news via Ace (USDC payment)
4. Generate analysis via GPT-4o via Ace (USDC payment)
5. Generate cover image via Ace (USDC payment)
6. Write HTML report to `./reports/`
7. Log to Solana mainnet via SPL Memo

### 5. Production (PM2)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 logs nexus-intel-agent
```

### 6. Launch dashboard

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Verification

### Find your agent on Synapse Explorer

After registration:
```
https://explorer.oobeprotocol.ai/agents/{SAP_AGENT_ID}
```

The agent ID is saved in `agent-registration.json`.

### Find memo transactions on Solscan

Every cycle writes a memo tx. Find them at:
```
https://solscan.io/account/{YOUR_WALLET_ADDRESS}
```

Filter by "SPL Memo" program interactions, or check the **On-Chain** page in the dashboard.

### Verify x402 USDC payments

On-chain USDC transfers are visible on Solscan under your wallet's token transfers.

---

## X Post Template

```
Introducing Nexus Intel 🤖 — a fully autonomous crypto intelligence agent

Every 6 hours it:
→ Discovers tools via @OOBEonSol SAP mainnet
→ Searches live crypto news (Ace Data Cloud)
→ Generates 1,500-word analysis (GPT-4o via Ace)
→ Creates AI cover art (Image Gen via Ace)
→ Pays autonomously in USDC via x402
→ Logs everything on Solana mainnet

Zero human intervention. Real USDC payments. Verifiable on-chain.

Built with: @solana @coral-xyz/anchor + official SAP SDK + @AceDataCloud SDK

Bounty submission: @OOBEonSol × @AceDataCloud 🏆

#Solana #AI #Web3 #AutonomousAgents #OOBE #AceDataCloud
```

---

## Demo Script

1. **Show the dashboard** at http://localhost:5173 — agent idle, 0 cycles
2. **Run: `RUN_ONCE=true npm start`** — watch the terminal, narrate each step
3. **Switch to Dashboard** — show cycle timeline updating in real time
4. **Open Reports page** — click the generated report to open it in full screen
5. **Open On-Chain page** — show the memo TX, click through to Solscan
6. **Show Solscan** — show the SPL Memo tx confirming on mainnet
7. **Show Synapse Explorer** — show the registered agent profile

Total demo time: ~5 minutes per cycle run.

---

## Project Structure

```
nexus-intel/
├── src/
│   ├── agent.ts                    # Main entry — cron loop + graceful shutdown
│   ├── register-agent.ts           # One-time SAP mainnet registration
│   ├── config.ts                   # Env validation + typed config
│   ├── types/index.ts              # All TypeScript interfaces
│   ├── utils/
│   │   ├── logger.ts               # Winston + file rotation
│   │   ├── retry.ts                # Exponential backoff with jitter
│   │   └── solana.ts               # Keypair, balances, SPL Memo tx
│   ├── services/
│   │   ├── ace-client.ts           # Ace SDK + x402 handler (3 services)
│   │   ├── sap-registry.ts         # SAP tool discovery
│   │   └── sentinel.ts             # Sentinel verification + proof
│   ├── core/
│   │   ├── workflow-engine.ts      # 11-step orchestrator
│   │   ├── report-generator.ts     # Dark HTML report generator
│   │   └── storage.ts              # Local + on-chain persistence
│   └── server/api.ts               # Express API + SSE log stream
├── frontend/src/
│   ├── App.tsx                     # Router + nav
│   ├── pages/
│   │   ├── Dashboard.tsx           # Live monitoring + stats
│   │   ├── Reports.tsx             # Report gallery with modal viewer
│   │   └── OnChain.tsx             # On-chain verification table
│   ├── components/
│   │   ├── AgentStatusCard.tsx     # Pulsing status indicator
│   │   ├── CycleTimeline.tsx       # 11-step visual stepper
│   │   ├── PaymentHistory.tsx      # x402 USDC payment list
│   │   └── ReportCard.tsx          # Report preview card
│   └── hooks/
│       ├── useAgentData.ts         # 5s polling hook
│       └── useLogs.ts              # SSE live log stream hook
├── reports/                        # Generated HTML reports
├── logs/                           # Winston log files
├── run-log.json                    # Run history
├── agent-registration.json         # SAP registration record
├── .env.example                    # All env vars documented
├── package.json                    # Backend deps + scripts
├── tsconfig.json                   # Strict TypeScript config
├── ecosystem.config.js             # PM2 config
└── README.md                       # This file
```

---

*Built for the OOBE Protocol × Ace Data Cloud Bounty. Every line of code is production-ready, fully autonomous, and verifiable on Solana mainnet.*
