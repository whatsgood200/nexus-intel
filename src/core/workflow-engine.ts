import { v4 as uuidv4 } from 'uuid';
import { Connection, Keypair } from '@solana/web3.js';
import { SapClient } from '@oobe-protocol-labs/synapse-sap-sdk';
import { AceDataCloud } from '@acedatacloud/sdk';
import { logger } from '../utils/logger';
import { loadKeypair, getConnection, checkBalances } from '../utils/solana';
import { createSAPClient, discoverSAPTools } from '../services/sap-registry';
import { verifySentinelStatus, submitSentinelProof } from '../services/sentinel';
import {
  createAceClient,
  searchCryptoNews,
  generateAnalysis,
  generateReportCover,
} from '../services/ace-client';
import { generateHTMLReport } from './report-generator';
import { saveWorkflowRun, saveReport, logOnChain } from './storage';
import { config } from '../config';
import type {
  WorkflowRun,
  WorkflowStep,
  StepStatus,
  ReportData,
  ReportMetadata,
  NewsSearchResult,
  LLMAnalysisResult,
  MarketNarrative,
  InsightsResult,
  GeneratedImage,
  SAPDiscoveryResult,
  SentinelStatus,
} from '../types/index';

let currentRun: WorkflowRun | null = null;
let cycleNumber = 0;

export function getCurrentRun(): WorkflowRun | null {
  return currentRun;
}

export function incrementCycle(): number {
  return ++cycleNumber;
}

function makeStep(id: number, name: string): WorkflowStep {
  return { stepId: id, name, status: 'pending', startedAt: null, completedAt: null, durationMs: null, error: null, metadata: {} };
}

function startStep(step: WorkflowStep): WorkflowStep {
  step.status = 'running';
  step.startedAt = new Date().toISOString();
  logger.info(`▶  Step ${step.stepId}: ${step.name}`);
  if (currentRun) {
    const idx = currentRun.steps.findIndex((s) => s.stepId === step.stepId);
    if (idx >= 0) currentRun.steps[idx] = step;
  }
  return step;
}

function completeStep(step: WorkflowStep, metadata: Record<string, unknown> = {}): WorkflowStep {
  step.status = 'success';
  step.completedAt = new Date().toISOString();
  step.durationMs = step.startedAt ? new Date().getTime() - new Date(step.startedAt).getTime() : null;
  step.metadata = metadata;
  logger.info(`✓  Step ${step.stepId}: ${step.name} [${step.durationMs}ms]`);
  if (currentRun) {
    const idx = currentRun.steps.findIndex((s) => s.stepId === step.stepId);
    if (idx >= 0) currentRun.steps[idx] = step;
  }
  return step;
}

function failStep(step: WorkflowStep, error: unknown): WorkflowStep {
  step.status = 'failed';
  step.completedAt = new Date().toISOString();
  step.durationMs = step.startedAt ? new Date().getTime() - new Date(step.startedAt).getTime() : null;
  step.error = error instanceof Error ? error.message : String(error);
  logger.error(`✗  Step ${step.stepId}: ${step.name} — ${step.error}`);
  if (currentRun) {
    const idx = currentRun.steps.findIndex((s) => s.stepId === step.stepId);
    if (idx >= 0) currentRun.steps[idx] = step;
  }
  return step;
}

export async function runWorkflowCycle(): Promise<WorkflowRun> {
  const runId = uuidv4();
  const cycle = incrementCycle();
  const startedAt = new Date().toISOString();

  const steps = [
    makeStep(1, 'Initialization'),
    makeStep(2, 'SAP Tool Discovery'),
    makeStep(3, 'Sentinel Verification'),
    makeStep(4, 'Ace Web Search'),
    makeStep(5, 'Ace LLM: News Analysis'),
    makeStep(6, 'Ace LLM: Market Narrative'),
    makeStep(7, 'Ace LLM: Insights Extraction'),
    makeStep(8, 'Ace Image Generation'),
    makeStep(9, 'Report Assembly'),
    makeStep(10, 'On-Chain Logging'),
    makeStep(11, 'Sentinel Proof Submission'),
  ];

  currentRun = {
    runId, cycleNumber: cycle, status: 'running', startedAt,
    completedAt: null, durationMs: null, steps,
    reportId: null, onChainTx: null, totalUSDC: 0, wordCount: 0,
    assets: config.trackedAssets, error: null,
  };

  logger.info(
    `\n${'═'.repeat(60)}\n  NEXUS INTEL — Cycle #${cycle} | Run ${runId.slice(0, 8)}\n${'═'.repeat(60)}`
  );

  // ── Step 1: Init ───────────────────────────────────────────────────────────
  let keypair!: Keypair;
  let connection!: Connection;
  {
    const step = steps[0];
    startStep(step);
    try {
      keypair = loadKeypair(config.solanaPrivateKey);
      const rpcWithKey = `${config.synapseRpcUrl}?api_key=${config.synapseRpcApiKey}`;
      connection = getConnection(rpcWithKey);
      const balances = await checkBalances(keypair, connection);
      completeStep(step, { wallet: keypair.publicKey.toBase58(), sol: balances.sol, usdc: balances.usdc, cycle });
    } catch (err) {
      failStep(step, err);
      return finishRun(currentRun, 'failed', err);
    }
  }

  // ── Step 2: SAP Tool Discovery ─────────────────────────────────────────────
  let sapClient!: SapClient;
  let sapDiscovery!: SAPDiscoveryResult;
  {
    const step = steps[1];
    startStep(step);
    try {
      sapClient = createSAPClient(keypair, config.synapseRpcUrl, config.synapseRpcApiKey);
      sapDiscovery = await discoverSAPTools(sapClient);
      completeStep(step, {
        totalAgents: sapDiscovery.networkOverview.totalAgents,
        aceAgents: sapDiscovery.aceAgents.length,
        dataTools: sapDiscovery.dataTools.length,
      });
    } catch (err) {
      failStep(step, err);
      sapDiscovery = {
        networkOverview: { totalAgents: 0, activeAgents: 0, toolsCount: 0 },
        aceAgents: [], dataTools: [], discoveredAt: new Date().toISOString(),
      };
    }
  }

  // ── Step 3: Sentinel Verification ─────────────────────────────────────────
  let sentinelStatus!: SentinelStatus;
  {
    const step = steps[2];
    startStep(step);
    try {
      sentinelStatus = await verifySentinelStatus(sapClient);
      completeStep(step, { sentinelActive: sentinelStatus.active, reputation: sentinelStatus.reputation });
    } catch (err) {
      failStep(step, err);
      sentinelStatus = {
        address: config.sentinelAddress, name: 'Synapse Sentinel',
        active: false, reputation: 0, lastVerifiedAt: new Date().toISOString(), proofHash: null,
      };
    }
  }

  // ── Step 4: Ace Web Search ─────────────────────────────────────────────────
  let aceClient!: AceDataCloud;
  let newsResult!: NewsSearchResult;
  {
    const step = steps[3];
    startStep(step);
    try {
      aceClient = await createAceClient(keypair); // async because of dynamic x402 import
      newsResult = await searchCryptoNews(aceClient, config.trackedAssets);
      currentRun.totalUSDC += 0.095;
      completeStep(step, { totalResults: newsResult.totalResults, kept: newsResult.items.length });
    } catch (err) {
      failStep(step, err);
      return finishRun(currentRun, 'failed', err);
    }
  }

  // ── Steps 5–7: Ace LLM (3 calls inside generateAnalysis) ─────────────────
  let analysis!: LLMAnalysisResult;
  let narrative!: MarketNarrative;
  let insights!: InsightsResult;
  {
    const step5 = steps[4];
    const step6 = steps[5];
    const step7 = steps[6];
    startStep(step5);
    try {
      const result = await generateAnalysis(aceClient, newsResult.items, config.trackedAssets);
      analysis = result.analysis;
      narrative = result.narrative;
      insights = result.insights;
      currentRun.totalUSDC += 0.095 * 3; // 3 GPT-4o calls
      currentRun.wordCount = narrative.wordCount;
      completeStep(step5, { sentiment: analysis.sentiment, sentimentScore: analysis.sentimentScore });
      completeStep(step6, { wordCount: narrative.wordCount, sections: narrative.sections.length });
      completeStep(step7, { insights: insights.keyInsights.length, risks: insights.riskFactors.length });
    } catch (err) {
      failStep(step5, err);
      failStep(step6, err);
      failStep(step7, err);
      return finishRun(currentRun, 'failed', err);
    }
  }

  // ── Step 8: Ace Image Generation ──────────────────────────────────────────
  let coverImage: GeneratedImage | null = null;
  {
    const step = steps[7];
    startStep(step);
    try {
      coverImage = await generateReportCover(aceClient, analysis.sentiment, config.trackedAssets);
      if (coverImage) {
        currentRun.totalUSDC += 0.115;
        completeStep(step, { provider: coverImage.provider, b64Len: coverImage.base64.length });
      } else {
        (step.status as StepStatus) = 'skipped' as StepStatus;
        step.completedAt = new Date().toISOString();
        step.metadata = { skipped: 'image gen returned null' };
        logger.warn('Step 8: Image generation skipped (null result)');
      }
    } catch (err) {
      failStep(step, err);
      // non-fatal — continue without cover image
    }
  }

  // ── Step 9: Report Assembly ────────────────────────────────────────────────
  const reportId = uuidv4();
  let reportData!: ReportData;
  {
    const step = steps[8];
    startStep(step);
    try {
      const reportMeta: ReportMetadata = {
        reportId, runId, cycleNumber: cycle,
        createdAt: new Date().toISOString(),
        title: narrative.title,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        wordCount: narrative.wordCount,
        assets: config.trackedAssets,
        htmlPath: `./reports/${reportId}.html`,
        jsonPath: `./reports/${reportId}.json`,
        coverImageB64: coverImage?.base64 || null,
        onChainTx: null,
      };

      reportData = { metadata: reportMeta, newsItems: newsResult.items, analysis, narrative, insights, coverImage, sapDiscovery, sentinelStatus };
      const htmlContent = generateHTMLReport(reportData);
      await saveReport(reportData, htmlContent);
      currentRun.reportId = reportId;
      completeStep(step, { reportId, htmlPath: reportMeta.htmlPath });
    } catch (err) {
      failStep(step, err);
      return finishRun(currentRun, 'partial', err);
    }
  }

  // ── Step 10: On-Chain Log ──────────────────────────────────────────────────
  let onChainTx: string | null = null;
  {
    const step = steps[9];
    startStep(step);
    try {
      onChainTx = await logOnChain(keypair, connection, currentRun);
      currentRun.onChainTx = onChainTx;
      reportData.metadata.onChainTx = onChainTx;
      completeStep(step, { txSignature: onChainTx, solscanUrl: `https://solscan.io/tx/${onChainTx}` });
    } catch (err) {
      failStep(step, err);
    }
  }

  // ── Step 11: Sentinel Proof ────────────────────────────────────────────────
  {
    const step = steps[10];
    startStep(step);
    try {
      const { proofHash } = await submitSentinelProof(sapClient, {
        runId, reportId,
        steps: currentRun.steps,
        totalUSDC: currentRun.totalUSDC,
        onChainTx,
        completedAt: new Date().toISOString(),
        agentAddress: keypair.publicKey.toBase58(),
      });
      sentinelStatus.proofHash = proofHash;
      completeStep(step, { proofHash });
    } catch (err) {
      failStep(step, err);
    }
  }

  const finished = finishRun(currentRun, 'success', null);

  logger.info(
    `\n${'═'.repeat(60)}\n` +
    `  ✓ Cycle #${cycle} COMPLETE\n` +
    `  Report: ${reportId.slice(0, 8)} | Words: ${narrative.wordCount} | USDC: ~${currentRun.totalUSDC.toFixed(4)}\n` +
    `  On-chain: ${onChainTx ? `https://solscan.io/tx/${onChainTx}` : 'N/A'}\n` +
    `${'═'.repeat(60)}`
  );

  return finished;
}

function finishRun(run: WorkflowRun, status: WorkflowRun['status'], err: unknown): WorkflowRun {
  run.status = status;
  run.completedAt = new Date().toISOString();
  run.durationMs = new Date().getTime() - new Date(run.startedAt).getTime();
  run.error = err instanceof Error ? err.message : err ? String(err) : null;
  for (const step of run.steps) {
    if (step.status === 'pending') step.status = 'skipped' as StepStatus;
  }
  saveWorkflowRun(run).catch((e) => logger.error(`Failed to save run log: ${e}`));
  return run;
}
