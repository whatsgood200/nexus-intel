import dotenv from 'dotenv';

// Must run before any env var access
dotenv.config();

import type { AppConfig } from './types/index';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Please copy .env.example to .env and fill in all values.`
    );
  }
  return val.trim();
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function validateConfig(): AppConfig {
  const errors: string[] = [];

  const required: Array<[string, string]> = [
    ['SOLANA_PRIVATE_KEY', 'Base58-encoded Solana wallet private key'],
    ['SYNAPSE_RPC_API_KEY', 'Synapse RPC API key from https://synapse.oobeprotocol.ai'],
  ];

  for (const [key, desc] of required) {
    if (!process.env[key]?.trim()) {
      errors.push(`  • ${key} — ${desc}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `\n╔══════════════════════════════════════════════════════╗\n` +
        `║           NEXUS INTEL — MISSING CONFIGURATION         ║\n` +
        `╚══════════════════════════════════════════════════════╝\n\n` +
        `The following required environment variables are not set:\n\n` +
        errors.join('\n') +
        `\n\n` +
        `Run: cp .env.example .env  then fill in the missing values.\n`
    );
  }

  const assetsRaw = optionalEnv('TRACKED_ASSETS', 'BTC,ETH,SOL,BNB,AVAX');
  const assets = assetsRaw
    .split(',')
    .map((a) => a.trim().toUpperCase())
    .filter(Boolean);

  return {
    solanaPrivateKey: requireEnv('SOLANA_PRIVATE_KEY'),
    synapseRpcApiKey: requireEnv('SYNAPSE_RPC_API_KEY'),
    synapseRpcUrl: optionalEnv(
      'SYNAPSE_RPC_URL',
      'https://us-1-mainnet.oobeprotocol.ai/rpc'
    ),
    aceApiKey: optionalEnv('ACE_API_KEY', ''),
    aceBaseUrl: optionalEnv('ACE_BASE_URL', 'https://api.acedata.cloud'),
    acePaymentFacilitator: optionalEnv(
      'ACE_PAYMENT_FACILITATOR',
      'https://facilitator.acedata.cloud'
    ),
    sapAgentName: optionalEnv('SAP_AGENT_NAME', 'nexus-intel'),
    sapAgentDescription: optionalEnv(
      'SAP_AGENT_DESCRIPTION',
      'Autonomous crypto intelligence agent — daily market reports via Ace Data Cloud'
    ),
    sentinelAddress: optionalEnv(
      'SENTINEL_ADDRESS',
      'Ccr2yK3hLALU4p8oNRqrh4dGuvPJTth5KCLMio8cE1ph'
    ),
    agentCronSchedule: optionalEnv('AGENT_CRON_SCHEDULE', '0 */6 * * *'),
    trackedAssets: assets,
    maxRetries: parseInt(optionalEnv('MAX_RETRIES', '3'), 10),
    reportsDir: optionalEnv('REPORTS_DIR', './reports'),
    apiPort: parseInt(optionalEnv('API_PORT', '3001'), 10),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),
    logToFile: optionalEnv('LOG_TO_FILE', 'true') === 'true',
  };
}

export const config: AppConfig = validateConfig();

// ── Test / dry-run config ────────────────────────────────────────────────────
// Re-export a helper so other modules can check the mode without re-importing dotenv
export const TEST_MODE   = process.env.TEST_MODE   === 'true';
export const SKIP_ONCHAIN = process.env.SKIP_ONCHAIN === 'true' || TEST_MODE;
