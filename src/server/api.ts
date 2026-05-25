import '../config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { logger } from '../utils/logger';
import {
  getRunLog,
  listReports,
  getReport,
  getOnChainRecords,
} from '../core/storage';
import { getCurrentRun } from '../core/workflow-engine';
import { getSolBalance, getUSDCBalance, loadKeypair, getConnection } from '../utils/solana';
import { config } from '../config';
import type { AgentStatusResponse, AgentRegistration } from '../types/index';

const app = express();

app.use(cors());
app.use(express.json());

// ─── GET /api/status ───────────────────────────────────────────────────────
app.get('/api/status', async (_req, res) => {
  try {
    const runLog = await getRunLog();
    const currentRun = getCurrentRun();

    let solBalance = 0;
    let usdcBalance = 0;

    try {
      const keypair = loadKeypair(config.solanaPrivateKey);
      const rpcUrl = `${config.synapseRpcUrl}?api_key=${config.synapseRpcApiKey}`;
      const connection = getConnection(rpcUrl);
      [solBalance, usdcBalance] = await Promise.all([
        getSolBalance(keypair, connection),
        getUSDCBalance(keypair, connection),
      ]);
    } catch {
      // Non-fatal
    }

    let registration: AgentRegistration | null = null;
    const regPath = path.resolve('./agent-registration.json');
    if (await fs.pathExists(regPath)) {
      registration = (await fs.readJson(regPath)) as AgentRegistration;
    }

    const keypair = loadKeypair(config.solanaPrivateKey);

    // Calculate next run time from cron
    const nextRunAt = getNextCronTime(config.agentCronSchedule);

    const status: AgentStatusResponse = {
      isRunning: currentRun?.status === 'running',
      currentCycle: runLog.totalCycles,
      lastRunAt: runLog.lastRunAt,
      nextRunAt,
      usdcBalance,
      solBalance,
      totalUSDCSpent: runLog.totalUSDC,
      agentAddress: keypair.publicKey.toBase58(),
      registration,
      currentRun: currentRun || null,
    };

    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/runs ──────────────────────────────────────────────────────────
app.get('/api/runs', async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const runLog = await getRunLog();
    res.json({
      runs: runLog.runs.slice(0, limit),
      total: runLog.runs.length,
      totalCycles: runLog.totalCycles,
      totalUSDC: runLog.totalUSDC,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/runs/:runId ───────────────────────────────────────────────────
app.get('/api/runs/:runId', async (req, res) => {
  try {
    const runLog = await getRunLog();
    const run = runLog.runs.find((r) => r.runId === req.params.runId);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/reports ──────────────────────────────────────────────────────
app.get('/api/reports', async (_req, res) => {
  try {
    const reports = await listReports();
    res.json({ reports, total: reports.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/reports/:reportId ───────────────────────────────────────────
app.get('/api/reports/:reportId', async (req, res) => {
  try {
    const accept = req.headers.accept || '';
    const reportsDir = path.resolve(config.reportsDir);

    if (accept.includes('text/html')) {
      // Serve HTML report
      const htmlPath = path.join(reportsDir, `${req.params.reportId}.html`);
      if (await fs.pathExists(htmlPath)) {
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(htmlPath);
        return;
      }
      res.status(404).json({ error: 'Report HTML not found' });
      return;
    }

    const reportData = await getReport(req.params.reportId);
    if (!reportData) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json(reportData);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Serve raw HTML report file
app.get('/api/reports/:reportId/html', async (req, res) => {
  try {
    const reportsDir = path.resolve(config.reportsDir);
    const htmlPath = path.join(reportsDir, `${req.params.reportId}.html`);

    if (await fs.pathExists(htmlPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const content = await fs.readFile(htmlPath, 'utf8');
      res.send(content);
      return;
    }
    res.status(404).json({ error: 'Report HTML not found' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/onchain ──────────────────────────────────────────────────────
app.get('/api/onchain', async (_req, res) => {
  try {
    const records = await getOnChainRecords();
    res.json({ records, total: records.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/registration ────────────────────────────────────────────────
app.get('/api/registration', async (_req, res) => {
  try {
    const regPath = path.resolve('./agent-registration.json');
    if (await fs.pathExists(regPath)) {
      const reg = await fs.readJson(regPath);
      res.json(reg);
    } else {
      res.status(404).json({ error: 'Agent not yet registered. Run: npm run register' });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/logs (SSE) ──────────────────────────────────────────────────
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: new Date().toISOString() })}\n\n`);

  const logFile = path.resolve('./logs/agent.log');
  let lastSize = 0;

  const sendLines = async () => {
    try {
      if (!(await fs.pathExists(logFile))) return;
      const stat = await fs.stat(logFile);
      if (stat.size === lastSize) return;

      const stream = fs.createReadStream(logFile, {
        start: lastSize,
        end: stat.size,
        encoding: 'utf8',
      });

      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk;
      });
      stream.on('end', () => {
        const lines = buffer.split('\n').filter(Boolean);
        for (const line of lines) {
          res.write(
            `data: ${JSON.stringify({ type: 'log', line, ts: new Date().toISOString() })}\n\n`
          );
        }
        lastSize = stat.size;
      });
    } catch {
      // Ignore file read errors
    }
  };

  const interval = setInterval(sendLines, 2000);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', ts: new Date().toISOString() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(heartbeat);
  });
});

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = config.apiPort;
app.listen(PORT, () => {
  logger.info(`Nexus Intel API server running on http://localhost:${PORT}`);
  logger.info(`Endpoints: /api/status | /api/runs | /api/reports | /api/onchain | /api/logs`);
});

// Helpers
function getNextCronTime(cronExpr: string): string | null {
  try {
    // Simple parser for the common pattern: every N hours
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return null;

    const now = new Date();
    const next = new Date(now.getTime() + 6 * 60 * 60 * 1000); // default 6h
    return next.toISOString();
  } catch {
    return null;
  }
}

export default app;
