const assert = require('node:assert/strict');
const test = require('node:test');

const { HealthRegistry } = require('../dist/shared/health/HealthRegistry.js');
const { executeWithRetry } = require('../dist/shared/resilience/externalApiPolicy.js');
const { ScheduledJob } = require('../dist/services/cron/ScheduledJob.js');

test('ScheduledJob skips an overlapping run and records operational health', async () => {
  const health = new HealthRegistry();
  let release;
  let executions = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const job = new ScheduledJob(
    'overlap-test',
    async () => {
      executions++;
      await pending;
    },
    health
  );

  const firstRun = job.run();
  await Promise.resolve();
  assert.equal(await job.run(), 'skipped');
  release();
  assert.equal(await firstRun, 'succeeded');

  assert.equal(executions, 1);
  assert.deepEqual(
    {
      state: health.get('job:overlap-test').state,
      attempts: health.get('job:overlap-test').attempts,
      skipped: health.get('job:overlap-test').skipped,
    },
    { state: 'operational', attempts: 1, skipped: 1 }
  );
});

test('ScheduledJob contains failures and exposes the last error', async () => {
  const health = new HealthRegistry();
  const job = new ScheduledJob(
    'failure-test',
    async () => {
      throw new Error('job unavailable');
    },
    health
  );

  assert.equal(await job.run(), 'failed');
  assert.equal(health.get('job:failure-test').state, 'degraded');
  assert.equal(health.get('job:failure-test').lastError, 'job unavailable');
});

test('executeWithRetry uses bounded exponential backoff and records success', async () => {
  const health = new HealthRegistry();
  const delays = [];
  let attempts = 0;

  const result = await executeWithRetry(
    async () => {
      attempts++;
      if (attempts < 3) throw new Error('temporary failure');
      return 'ok';
    },
    {
      maxAttempts: 3,
      retryDelayMs: 10,
      healthId: 'integration:test',
      health,
      sleep: async (delay) => delays.push(delay),
    }
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [10, 20]);
  assert.equal(health.get('integration:test').state, 'operational');
});

test('executeWithRetry stops immediately for non-retryable failures', async () => {
  let attempts = 0;
  await assert.rejects(
    executeWithRetry(
      async () => {
        attempts++;
        throw new Error('invalid request');
      },
      { shouldRetry: () => false, sleep: async () => {} }
    ),
    /invalid request/
  );
  assert.equal(attempts, 1);
});
