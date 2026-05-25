import fs from 'fs-extra';
import path from 'path';
import type { Keypair } from '@solana/web3.js';
import type { Connection } from '@solana/web3.js';
import { sendMemoTransaction } from '../utils/solana';
import { logger } from '../utils/logger';
import type {
  WorkflowRun,
  RunLog,
  ReportData,
  OnChainRecord,
  OnChainMemo,
  ReportMetadata,
} from '../types/index';

const RUN_LOG_PATH = path.resolve('./run-log.json');
const REPORTS_DIR = process.env.REPORTS_DIR || './reports';

async function loadRunLog(): Promise<RunLog> {
  try {
    if (await fs.pathExists(RUN_LOG_PATH)) {
      return (await fs.readJson(RUN_LOG_PATH)) as RunLog;
    }
  } catch {
    logger.warn('Could not load run-log.json, starting fresh');
  }
  return {
    totalCycles: 0,
    totalUSDC: 0,
    lastRunAt: null,
    runs: [],
    onChainRecords: [],
  };
}

async function saveRunLog(log: RunLog): Promise<void> {
  await fs.writeJson(RUN_LOG_PATH, log, { spaces: 2 });
}

export async function saveWorkflowRun(run: WorkflowRun): Promise<void> {
  const log = await loadRunLog();

  // Update or add run
  const existingIndex = log.runs.findIndex((r) => r.runId === run.runId);
  if (existingIndex >= 0) {
    log.runs[existingIndex] = run;
  } else {
    log.runs.unshift(run);
  }

  // Keep only last 100 runs
  log.runs = log.runs.slice(0, 100);

  log.totalCycles = Math.max(log.totalCycles, run.cycleNumber);
  log.lastRunAt = run.completedAt || run.startedAt;
  log.totalUSDC = log.runs.reduce((sum, r) => sum + (r.totalUSDC || 0), 0);

  await saveRunLog(log);
}

export async function getRunLog(): Promise<RunLog> {
  return loadRunLog();
}

export async function getLatestRun(): Promise<WorkflowRun | null> {
  const log = await loadRunLog();
  return log.runs[0] || null;
}

export async function saveReport(reportData: ReportData, htmlContent: string): Promise<void> {
  await fs.ensureDir(path.resolve(REPORTS_DIR));

  const htmlPath = path.resolve(REPORTS_DIR, `${reportData.metadata.reportId}.html`);
  const jsonPath = path.resolve(REPORTS_DIR, `${reportData.metadata.reportId}.json`);

  await fs.writeFile(htmlPath, htmlContent, 'utf8');
  await fs.writeJson(jsonPath, reportData, { spaces: 2 });

  logger.info(`Report saved: ${htmlPath}`);
}

export async function listReports(): Promise<ReportMetadata[]> {
  await fs.ensureDir(path.resolve(REPORTS_DIR));

  const files = await fs.readdir(path.resolve(REPORTS_DIR));
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const metadataList: ReportMetadata[] = [];

  for (const file of jsonFiles) {
    try {
      const data = (await fs.readJson(
        path.resolve(REPORTS_DIR, file)
      )) as ReportData;
      metadataList.push(data.metadata);
    } catch {
      // Skip malformed files
    }
  }

  return metadataList.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getReport(reportId: string): Promise<ReportData | null> {
  const jsonPath = path.resolve(REPORTS_DIR, `${reportId}.json`);
  try {
    if (await fs.pathExists(jsonPath)) {
      return (await fs.readJson(jsonPath)) as ReportData;
    }
  } catch {
    logger.warn(`Could not load report ${reportId}`);
  }
  return null;
}

export async function logOnChain(
  keypair: Keypair,
  connection: Connection,
  run: WorkflowRun
): Promise<string | null> {
  try {
    const memo: OnChainMemo = {
      agent: 'nexus-intel',
      net: 'mainnet',
      run: run.runId.slice(0, 8),
      cycle: run.cycleNumber,
      status: run.status,
      report: (run.reportId || '').slice(0, 8),
      words: run.wordCount,
      svcs: ['ace-search', 'ace-llm', 'ace-img'],
      usdc: Math.round(run.totalUSDC * 10000) / 10000,
      ts: Math.floor(Date.now() / 1000),
    };

    const memoText = JSON.stringify(memo);
    logger.info(`On-chain memo (${memoText.length} bytes): ${memoText}`);

    const signature = await sendMemoTransaction(keypair, connection, memoText);

    // Record in run log
    const log = await loadRunLog();
    const record: OnChainRecord = {
      txSignature: signature,
      memo,
      solscanUrl: `https://solscan.io/tx/${signature}`,
      confirmedAt: new Date().toISOString(),
    };

    log.onChainRecords.unshift(record);
    log.onChainRecords = log.onChainRecords.slice(0, 200);
    await saveRunLog(log);

    return signature;
  } catch (err) {
    logger.error(
      `On-chain logging failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

export async function getOnChainRecords(): Promise<OnChainRecord[]> {
  const log = await loadRunLog();
  return log.onChainRecords;
}
