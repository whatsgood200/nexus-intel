import './config'; // load .env first
import cron from 'node-cron';
import { logger } from './utils/logger';
import { runWorkflowCycle, getCurrentRun } from './core/workflow-engine';
import { config } from './config';

let isRunning = false;
let statusInterval: NodeJS.Timeout | null = null;

async function executeCycle(): Promise<void> {
  if (isRunning) {
    logger.warn('Cycle already in progress, skipping scheduled trigger');
    return;
  }

  isRunning = true;
  try {
    await runWorkflowCycle();
  } catch (err) {
    logger.error(
      `Unhandled error in workflow cycle: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    isRunning = false;
  }
}

function startStatusLogger(): void {
  statusInterval = setInterval(() => {
    const run = getCurrentRun();
    if (isRunning && run) {
      const completed = run.steps.filter((s) => s.status === 'success').length;
      const total = run.steps.length;
      logger.info(
        `[status] Cycle #${run.cycleNumber} in progress — step ${completed}/${total}`
      );
    } else {
      logger.info('[status] Agent idle — awaiting next cycle');
    }
  }, 30 * 60 * 1000); // every 30 minutes
}

function shutdown(signal: string): void {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  if (statusInterval) {
    clearInterval(statusInterval);
  }

  if (isRunning) {
    logger.info('Waiting for current cycle to finish before exit...');
    // In production you'd wait for the run to complete here
    // For now we exit after a brief delay
    setTimeout(() => {
      logger.info('Shutdown complete.');
      process.exit(0);
    }, 5000);
  } else {
    logger.info('Shutdown complete.');
    process.exit(0);
  }
}

async function main(): Promise<void> {
  logger.info(
    `\n╔══════════════════════════════════════════════════════╗\n` +
      `║            NEXUS INTEL — STARTING UP                  ║\n` +
      `║   Autonomous Crypto Intelligence Agent                 ║\n` +
      `║   OOBE Protocol SAP × Ace Data Cloud × Solana         ║\n` +
      `╚══════════════════════════════════════════════════════╝`
  );

  logger.info(`Config: assets=${config.trackedAssets.join(',')} | cron="${config.agentCronSchedule}"`);

  // Register signal handlers for graceful shutdown
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start periodic status logger
  startStatusLogger();

  // Run once and exit
  if (process.env.RUN_ONCE === 'true') {
    logger.info('RUN_ONCE=true — executing single cycle then exiting');
    await executeCycle();
    process.exit(0);
    return;
  }

  // Run first cycle immediately if requested
  if (process.env.IMMEDIATE === 'true') {
    logger.info('IMMEDIATE=true — running first cycle now');
    await executeCycle();
  }

  // Schedule recurring cycles
  if (!cron.validate(config.agentCronSchedule)) {
    throw new Error(`Invalid cron schedule: "${config.agentCronSchedule}"`);
  }

  logger.info(`Scheduling cycles with cron: "${config.agentCronSchedule}"`);

  cron.schedule(config.agentCronSchedule, () => {
    logger.info('Cron triggered — starting new cycle');
    executeCycle().catch((err) => {
      logger.error(`Cron cycle error: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  logger.info('Agent is running. Press Ctrl+C to stop.');
}

main().catch((err) => {
  logger.error(`Fatal startup error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
