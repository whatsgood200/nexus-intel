import { SapClient, Pdas } from '@oobe-protocol-labs/synapse-sap-sdk';
import { Wallet } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import type { SAPDiscoveryResult } from '../types/index';

let _sapClient: SapClient | null = null;

export function createSAPClient(
  keypair: Keypair,
  rpcUrl: string,
  apiKey: string,
): SapClient {
  if (_sapClient) return _sapClient;
  const fullRpcUrl = `${rpcUrl}?api_key=${apiKey}`;
  // SapClient requires Anchor NodeWallet, not raw Keypair
  _sapClient = new SapClient({ rpcUrl: fullRpcUrl, wallet: new Wallet(keypair) });
  logger.debug(`SAP client initialised`);
  return _sapClient;
}

export async function discoverSAPTools(client: SapClient): Promise<SAPDiscoveryResult> {
  logger.info('SAP: Starting tool discovery...');

  // Cast to any to access private .program property
  const agentProgram = (client.agent as any).program;
  const toolsProgram = (client.agent as any).program; // tools uses same program namespace

  let networkOverview = { totalAgents: 0, activeAgents: 0, toolsCount: 0 };
  let aceAgents: SAPDiscoveryResult['aceAgents'] = [];
  let dataTools: SAPDiscoveryResult['dataTools'] = [];

  // ── Global registry stats ─────────────────────────────────────────────────
  try {
    const [globalPda] = Pdas.getGlobalPDA();
    const global = await withRetry(
      () => agentProgram.account.globalRegistry.fetch(globalPda),
      { maxAttempts: 3, initialDelayMs: 2000 },
      'sap-global-registry',
    ) as Record<string, unknown>;

    networkOverview.totalAgents = Number(global.totalAgents ?? global.agentCount ?? 0);
    networkOverview.toolsCount  = Number(global.totalTools  ?? global.toolCount  ?? 0);
    logger.info(`SAP Network: ${networkOverview.totalAgents} agents, ${networkOverview.toolsCount} tools`);
  } catch (err) {
    logger.warn(`SAP global registry (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Enumerate all agent accounts ──────────────────────────────────────────
  try {
    const allAgents = await withRetry(
      () => agentProgram.account.agentAccount.all(),
      { maxAttempts: 3, initialDelayMs: 2000 },
      'sap-all-agents',
    ) as Array<{ publicKey: PublicKey; account: Record<string, unknown> }>;

    networkOverview.totalAgents  = Math.max(networkOverview.totalAgents, allAgents.length);
    networkOverview.activeAgents = allAgents.length;

    aceAgents = allAgents
      .filter(a => {
        const protos = (a.account.protocols as string[] | undefined) ?? [];
        return protos.some(p => p.toLowerCase().includes('ace') || p.toLowerCase().includes('data'));
      })
      .slice(0, 20)
      .map(a => ({
        name:         String(a.account.name ?? 'Unknown'),
        address:      a.publicKey.toBase58(),
        protocol:     'ace-data',
        capabilities: ((a.account.capabilities as Array<{ id: string }>) ?? []).map(c => c.id),
      }));

    logger.info(`SAP: ${allAgents.length} agents found, ${aceAgents.length} with ace-data protocol`);
  } catch (err) {
    logger.warn(`SAP agent enumeration (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Enumerate tool descriptors ────────────────────────────────────────────
  try {
    const allTools = await withRetry(
      () => toolsProgram.account.toolDescriptor.all(),
      { maxAttempts: 3, initialDelayMs: 2000 },
      'sap-all-tools',
    ) as Array<{ account: Record<string, unknown> }>;

    networkOverview.toolsCount = Math.max(networkOverview.toolsCount, allTools.length);

    dataTools = allTools
      .filter(t => {
        const cat = String(t.account.category ?? t.account.tags ?? '').toLowerCase();
        return cat.includes('data') || cat.includes('search') || cat.includes('ai') || cat.includes('llm');
      })
      .slice(0, 20)
      .map(t => ({
        name:        String(t.account.name ?? 'Unknown'),
        category:    String(t.account.category ?? 'data'),
        description: String(t.account.description ?? ''),
      }));

    logger.info(`SAP: ${allTools.length} tools found, ${dataTools.length} in data/AI category`);
  } catch (err) {
    logger.warn(`SAP tool enumeration (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }

  return { networkOverview, aceAgents, dataTools, discoveredAt: new Date().toISOString() };
}
