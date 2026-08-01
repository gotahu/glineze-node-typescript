const assert = require('node:assert/strict');
const test = require('node:test');

const { config } = require('../dist/config.js');
const { CronService } = require('../dist/services/cron/CronService.js');
const countdownFunctions = require('../dist/features/countdown/CountdownFunctions.js');
const practiceFunctions = require('../dist/features/practice/practiceUseCases.js');
const { logger } = require('../dist/utils/logger.js');

function patch(t, object, key, value) {
  const original = object[key];
  object[key] = value;
  t.after(() => {
    object[key] = original;
  });
}

test.beforeEach(() => config.replaceRuntimeValues(new Map()));
test.after(() => config.replaceRuntimeValues(new Map()));

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

test('logs and contains an asynchronous practice notification failure', async (t) => {
  const failure = new Error('practice notification failed');
  const errors = [];
  config.replaceRuntimeValues(new Map([['practice_remind_threadid', 'practice-channel']]));
  patch(t, practiceFunctions, 'notifyPractice', async () => {
    throw failure;
  });
  patch(t, logger, 'error', async (message) => {
    errors.push(message);
  });
  const cron = new CronService({ discord: {} });

  await cron.runNotifyPractice();

  assert.equal(errors.length, 1);
  assert.match(
    errors[0],
    /Scheduled job practice-notification failed: Error: practice notification failed/
  );
});

test('scheduled countdown callback waits for notification completion', async (t) => {
  const scheduled = [];
  let notificationCompleted = false;
  patch(t, countdownFunctions, 'updateBotProfile', () => {});
  patch(t, countdownFunctions, 'sendCountdownMessage', async () => {
    await Promise.resolve();
    notificationCompleted = true;
  });
  const cron = new CronService({ discord: {} });
  cron.schedule = (expression, task, options) => scheduled.push({ expression, task, options });
  cron.startCountdownScheduler();

  const execution = scheduled[0].task();
  assert.equal(typeof execution?.then, 'function');
  await execution;
  assert.equal(notificationCompleted, true);
});

test('Sesame job waits for every Discord channel update', async () => {
  let updateCompleted = false;
  const cron = new CronService({
    sesame: {
      getSesameDeviceStatus: async () => ({ lockStatus: 'locked' }),
    },
    discord: {
      sesameDiscordService: {
        updateSesameStatusAllVoiceChannels: async () => {
          await Promise.resolve();
          updateCompleted = true;
        },
      },
    },
  });

  await cron.runSesameScheduler();

  assert.equal(updateCompleted, true);
});

test('stop destroys every registered task in reverse order and permits restart', async (t) => {
  const events = [];
  const scheduled = [];
  patch(t, countdownFunctions, 'updateBotProfile', () => {});
  const cron = new CronService({ discord: {} });
  cron.schedule = (expression) => {
    scheduled.push(expression);
    return {
      stop: async () => events.push(`stop:${expression}`),
      destroy: async () => events.push(`destroy:${expression}`),
    };
  };
  cron.startCountdownScheduler();
  cron.startNotifyPractice();

  await cron.stop();
  cron.startNotifyPractice();

  assert.deepEqual(events, [
    'stop:0 17 * * *',
    'destroy:0 17 * * *',
    'stop:1 0 * * *',
    'destroy:1 0 * * *',
  ]);
  assert.deepEqual(scheduled, ['1 0 * * *', '0 17 * * *', '0 17 * * *']);
});
