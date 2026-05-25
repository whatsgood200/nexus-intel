import './config';
import fs from 'fs-extra';
import path from 'path';
import { SapClient, Pdas } from '@oobe-protocol-labs/synapse-sap-sdk';
import { Wallet } from '@coral-xyz/anchor';
import { Connection, SystemProgram } from '@solana/web3.js';
import { logger } from './utils/logger';
import { loadKeypair } from './utils/solana';
import { config } from './config';
import type { AgentRegistration } from './types/index';

const REGISTRATION_FILE = path.resolve('./agent-registration.json');

/**
 * Poll for confirmation using pure HTTP — no WebSocket.
 * connection.confirmTransaction() uses WS internally and fails on Synapse RPC
 * with "ws error: Unexpected server response: 400". This avoids it entirely.
 */
async function pollConfirmation(
  connection: Connection,
  signature: string,
  timeoutMs = 120_000,
  intervalMs = 3_500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      const { value } = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const status = value[0];

      if (status?.err) {
        // On-chain failure — decode common errors for a human-readable message
        const errStr = JSON.stringify(status.err);
        let hint = '';
        if (errStr.includes('InstructionError') || errStr.includes('0x1')) {
          hint =
            '\n\n  Most likely cause: insufficient SOL for account rent.\n' +
            '  The SAP registerAgent instruction creates 3 on-chain accounts' +
            ' (~0.039 SOL rent).\n' +
            `  Your wallet needs at least 0.05 SOL.\n` +
            `  Fund: 5vRJNk... then run: FORCE_REGISTER=true npm run register`;
        }
        throw new Error(`Transaction failed on-chain: ${errStr}${hint}`);
      }

      if (
        status?.confirmationStatus === 'confirmed' ||
        status?.confirmationStatus === 'finalized'
      ) {
        logger.info(`✓ Confirmed (${status.confirmationStatus}) after ~${Math.round(attempt * intervalMs / 1000)}s`);
        return;
      }

      logger.debug(`Poll #${attempt}: ${status?.confirmationStatus ?? 'pending'} — retrying in ${intervalMs}ms`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('failed on-chain')) throw err;
      logger.debug(`Poll #${attempt} RPC error (non-fatal): ${msg}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Timeout — throw so we don't save a registration that may not exist
  throw new Error(
    `Confirmation timed out after ${timeoutMs / 1000}s.\n` +
    `  Check the TX on Solscan before retrying:\n` +
    `  https://solscan.io/tx/${signature}\n\n` +
    `  If it shows FAIL → add more SOL and run FORCE_REGISTER=true npm run register\n` +
    `  If it shows SUCCESS → run FORCE_REGISTER=true npm run register (it will detect the PDA)`,
  );
}

async function registerAgent(): Promise<void> {
  logger.info(
    `\n╔══════════════════════════════════════════════════════╗\n` +
    `║         NEXUS INTEL — SAP MAINNET REGISTRATION        ║\n` +
    `╚══════════════════════════════════════════════════════╝`,
  );

  if (await fs.pathExists(REGISTRATION_FILE)) {
    const existing = (await fs.readJson(REGISTRATION_FILE)) as AgentRegistration;
    logger.info('Agent already registered:');
    logger.info(`  Agent ID: ${existing.agentId}`);
    logger.info(`  PDA:      ${existing.pdaAddress}`);
    logger.info(`  TX:       ${existing.txSignature}`);
    logger.info(`  Explorer: https://explorer.oobeprotocol.ai/agents/${existing.pdaAddress}`);
    if (process.env.FORCE_REGISTER !== 'true') {
      logger.info('Use FORCE_REGISTER=true to re-register.');
      return;
    }
    logger.warn('FORCE_REGISTER=true — re-registering...');
  }

  const keypair = loadKeypair(config.solanaPrivateKey);
  const rawRpc  = config.synapseRpcUrl;
  const rpcUrl  = `${rawRpc}?api_key=${config.synapseRpcApiKey}`;

  logger.info(`Wallet: ${keypair.publicKey.toBase58()}`);
  logger.info(`RPC:    ${rawRpc}`);

  // SapClient requires an Anchor Wallet (NodeWallet), not a raw Keypair
  const client = new SapClient({ rpcUrl, wallet: new Wallet(keypair) });

  const [agentPda] = Pdas.getAgentPDA(keypair.publicKey);
  logger.info(`Agent PDA: ${agentPda.toBase58()}`);

  // ── Capabilities ──────────────────────────────────────────────────────────
  //
  // IDL-verified field names (from client.agent.program._idl):
  //   id:          string          ← required
  //   description: option<string>  ← optional
  //   protocolId:  option<string>  ← optional, camelCase (NOT protocol_id)
  //   version:     option<string>  ← optional
  //
  // "indeterminate span" borsh error is caused by using snake_case field names
  // (protocol_id) when the IDL defines them as camelCase (protocolId).
  //
  // Capability ID format verified from live IDL docs: "protocol:capability" e.g. "jupiter:swap"
  // Hyphens-only IDs (crypto-intelligence) trigger error 6026 invalidCapabilityFormat
  const capabilities = [
    { id: 'ace-data:intelligence', description: 'Autonomous crypto market reports',       protocolId: 'ace-data', version: '1.0.0' },
    { id: 'ace-data:search',       description: 'Live news via Ace Data Cloud Search',    protocolId: 'ace-data', version: '1.0.0' },
    { id: 'ace-data:llm',          description: 'GPT-4o analysis via Ace Data Cloud LLM', protocolId: 'ace-data', version: '1.0.0' },
    { id: 'ace-data:image',        description: 'AI covers via Ace Image Generation',     protocolId: 'ace-data', version: '1.0.0' },
    { id: 'ace-data:x402',         description: 'Autonomous USDC payments via Ace x402', protocolId: 'ace-data', version: '1.0.0' },
    { id: 'oobe:sentinel',         description: 'Workflow audit via Synapse Sentinel',    protocolId: 'oobe',     version: '1.0.0' },
  ];

  // ── Build tx — use .transaction() not .rpc() ──────────────────────────────
  //
  // .rpc() also uses WebSocket for confirmation → ws 400 error.
  // .transaction() just builds the tx; we send + confirm manually below.
  //
  // IDL-verified arg order:
  //   name, description, capabilities, pricing, protocols,
  //   agentId (Option), agentUri (Option), x402Endpoint (Option)
  //
  // IDL-verified accounts — only wallet + systemProgram need passing;
  // agent, agentStats, globalRegistry are all PDA-derived by Anchor.
  //
  logger.info('Building registerAgent transaction...');

  const tx = await (client.agent as any).program.methods
    .registerAgent(
      config.sapAgentName,          // name: string
      config.sapAgentDescription,   // description: string
      capabilities,                 // capabilities: Capability[]
      [],                           // pricing: PricingTier[]  (empty = free tier)
      ['ace-data', 'oobe'],         // protocols: string[]
      config.sapAgentName,          // agentId: Option<string>
      null,                         // agentUri: Option<string>
      null,                         // x402Endpoint: Option<string>
    )
    .accounts({
      wallet:        keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  // ── Send via our own connection ───────────────────────────────────────────
  const connection = new Connection(rpcUrl, { commitment: 'confirmed' });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  tx.recentBlockhash     = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer            = keypair.publicKey;
  tx.sign(keypair);

  logger.info('Sending transaction...');
  const txSignature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight:       true,
    preflightCommitment: 'confirmed',
    maxRetries:          5,
  });

  logger.info(`TX sent:  ${txSignature}`);
  logger.info(`Solscan:  https://solscan.io/tx/${txSignature}`);
  logger.info('Polling for confirmation (no WebSocket)...');

  await pollConfirmation(connection, txSignature);

  // ── Persist ───────────────────────────────────────────────────────────────
  const registration: AgentRegistration = {
    agentId:      config.sapAgentName,
    pdaAddress:   agentPda.toBase58(),
    txSignature,
    name:         config.sapAgentName,
    description:  config.sapAgentDescription,
    registeredAt: new Date().toISOString(),
    network:      'mainnet',
  };

  await fs.writeJson(REGISTRATION_FILE, registration, { spaces: 2 });

  logger.info('\n✅  Agent registered successfully!\n');
  logger.info(`  Name:     ${registration.name}`);
  logger.info(`  PDA:      ${registration.pdaAddress}`);
  logger.info(`  TX:       ${registration.txSignature}`);
  logger.info(`  Explorer: https://explorer.oobeprotocol.ai/agents/${registration.pdaAddress}`);
  logger.info(`  Solscan:  https://solscan.io/tx/${registration.txSignature}`);
  logger.info(`\n  Saved to: ${REGISTRATION_FILE}`);

  const envPath = path.resolve('.env');
  if (await fs.pathExists(envPath)) {
    let env = await fs.readFile(envPath, 'utf8');
    env = env.replace(/SAP_AGENT_ID=.*/, `SAP_AGENT_ID=${config.sapAgentName}`);
    env = env.replace(/SAP_AGENT_PDA=.*/, `SAP_AGENT_PDA=${agentPda.toBase58()}`);
    await fs.writeFile(envPath, env, 'utf8');
    logger.info('  .env updated with SAP_AGENT_ID and SAP_AGENT_PDA.');
  }
}

registerAgent().catch((err) => {
  logger.error(`Registration failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
