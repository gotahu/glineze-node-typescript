const assert = require('node:assert/strict');
const test = require('node:test');

const { config } = require('../dist/config.js');
const { CronService } = require('../dist/services/cron/CronService.js');
const countdownFunctions = require('../dist/services/discord/functions/CountdownFunctions.js');
const practiceFunctions = require('../dist/services/notion/practiceFunctions.js');
const { logger } = require('../dist/utils/logger.js');

function patch(t, object, key, value) {
  const original = object[key];
  object[key] = value;
  t.after(() => {
    object[key] = original;
  });
}

test.beforeEach(() => config.notionConfigs.clear());
test.after(() => config.notionConfigs.clear());

test('registers countdown and practice jobs once with the documented JST schedules', (t) => {
  const scheduled = [];
  let profileUpdates = 0;
  patch(t, countdownFunctions, 'updateBotProfile', () => {
    profileUpdates++;
  });
  const cron = new CronService({ discord: {} });
  cron.schedule = (expression, task, options) => scheduled.push({ expression, task, options });

  cron.startCountdownScheduler();
  cron.startCountdownScheduler();
  cron.startNotifyPractice();
  cron.startNotifyPractice();
  cron.startRemindBashotori();
  cron.startRemindBashotori();

  assert.equal(profileUpdates, 1);
  assert.deepEqual(
    scheduled.map(({ expression, options }) => ({ expression, options })),
    [
      { expression: '1 0 * * *', options: { timezone: 'Asia/Tokyo' } },
      { expression: '0 17 * * *', options: { timezone: 'Asia/Tokyo' } },
      { expression: '0 8 * * *', options: { timezone: 'Asia/Tokyo' } },
    ]
  );
});

test('registers the shared config sync job only once', () => {
  const scheduled = [];
  const cron = new CronService({ discord: {} });
  cron.schedule = (expression, task, options) => scheduled.push({ expression, task, options });

  cron.startConfigSyncScheduler();
  cron.startConfigSyncScheduler();

  assert.deepEqual(
    scheduled.map(({ expression, options }) => ({ expression, options })),
    [{ expression: '*/1 * * * *', options: undefined }]
  );
});

test('registers the Sesame job only once when explicitly started', () => {
  const scheduled = [];
  const cron = new CronService({ discord: {} });
  cron.schedule = (expression, task, options) => scheduled.push({ expression, task, options });

  cron.startSesameScheduler();
  cron.startSesameScheduler();

  assert.deepEqual(
    scheduled.map(({ expression, options }) => ({ expression, options })),
    [{ expression: '*/5 * * * *', options: undefined }]
  );
});

test('registers and contains the admin login-link rotation job', async () => {
  const scheduled = [];
  let rotations = 0;
  let nextRotation;
  const nextRun = new Date('2026-08-08T19:05:00.000Z');
  const cron = new CronService(
    { discord: {} },
    {
      rotate: async () => {
        rotations++;
      },
      setNextRotationAt: (value) => {
        nextRotation = value;
      },
    }
  );
  cron.schedule = (expression, task, options) => {
    scheduled.push({ expression, task, options });
    return { getNextRun: () => nextRun };
  };

  cron.startAdminLoginLinkScheduler();
  cron.startAdminLoginLinkScheduler();
  await new Promise((resolve) => globalThis.setImmediate(resolve));

  assert.equal(rotations, 1);
  assert.equal(nextRotation, nextRun);
  assert.deepEqual(
    scheduled.map(({ expression, options }) => ({ expression, options })),
    [{ expression: '5 4 * * *', options: { timezone: 'Asia/Tokyo' } }]
  );
});

test('logs and contains an asynchronous practice notification failure', async (t) => {
  const failure = new Error('practice notification failed');
  const errors = [];
  config.notionConfigs.set('practice_remind_threadid', 'practice-channel');
  patch(t, practiceFunctions, 'notifyPractice', async () => {
    throw failure;
  });
  patch(t, logger, 'error', async (message) => {
    errors.push(message);
  });
  const cron = new CronService({ discord: {} });

  await cron.runNotifyPractice();

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Error notify practice: Error: practice notification failed/);
});
