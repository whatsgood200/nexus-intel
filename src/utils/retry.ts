import { logger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  jitter: true,
  onRetry: () => undefined,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateDelay(
  attempt: number,
  initialDelay: number,
  backoffFactor: number,
  maxDelay: number,
  jitter: boolean
): number {
  const exponential = initialDelay * Math.pow(backoffFactor, attempt - 1);
  const capped = Math.min(exponential, maxDelay);
  if (!jitter) return capped;
  // Add ±25% jitter
  const jitterRange = capped * 0.25;
  return capped + (Math.random() * jitterRange * 2 - jitterRange);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  label = 'operation'
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === opts.maxAttempts) {
        logger.error(`[retry] ${label} failed after ${opts.maxAttempts} attempts: ${lastError.message}`);
        throw lastError;
      }

      const delayMs = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.backoffFactor,
        opts.maxDelayMs,
        opts.jitter
      );

      logger.warn(
        `[retry] ${label} attempt ${attempt}/${opts.maxAttempts} failed: ${lastError.message}. ` +
          `Retrying in ${Math.round(delayMs)}ms...`
      );

      opts.onRetry(attempt, lastError, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label = 'operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[timeout] ${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
