import { HealthRegistry, healthRegistry } from '../health/HealthRegistry';

export const EXTERNAL_API_TIMEOUT_MS = 10_000;
export const EXTERNAL_API_MAX_ATTEMPTS = 3;
export const EXTERNAL_API_RETRY_DELAY_MS = 250;

export interface RetryOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  healthId?: string;
  health?: HealthRegistry;
  sleep?: (delayMs: number) => Promise<void>;
}

export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? EXTERNAL_API_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? EXTERNAL_API_RETRY_DELAY_MS;
  const shouldRetry = options.shouldRetry ?? (() => true);
  const health = options.health ?? healthRegistry;
  const sleep =
    options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const startedAt = Date.now();

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer');
  }
  if (options.healthId) health.started(options.healthId, new Date(startedAt));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation(attempt);
      if (options.healthId) health.succeeded(options.healthId, Date.now() - startedAt);
      return result;
    } catch (error) {
      if (attempt === maxAttempts || !shouldRetry(error)) {
        if (options.healthId) health.failed(options.healthId, error, Date.now() - startedAt);
        throw error;
      }
      await sleep(retryDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error('Retry loop completed without a result');
}
