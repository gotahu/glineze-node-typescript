const assert = require('node:assert/strict');
const test = require('node:test');

const { EventEmitter } = require('node:events');
const { installProcessHandlers, main } = require('../dist/app.js');
const { logger } = require('../dist/utils/logger.js');

test('main creates and starts the application without starting services on module import', async (t) => {
  const originalInfo = logger.info;
  const messages = [];
  logger.info = async (message) => {
    messages.push(message);
  };
  t.after(() => {
    logger.info = originalInfo;
  });
  let created = false;
  let started = false;
  const application = {
    start: async () => {
      started = true;
    },
  };

  const result = await main(async () => {
    created = true;
    return application;
  });

  assert.equal(created, true);
  assert.equal(started, true);
  assert.equal(result, application);
  assert.deepEqual(messages, [
    'glineze アプリケーションを起動します',
    'glineze アプリケーションが起動しました',
  ]);
});

test('process handlers stop the application once and can be removed', async () => {
  const runtime = new EventEmitter();
  runtime.exitCode = undefined;
  let stopCount = 0;
  let resolveStopped;
  const stopped = new Promise((resolve) => {
    resolveStopped = resolve;
  });
  const application = {
    stop: async () => {
      stopCount++;
      resolveStopped();
    },
  };

  const removeHandlers = installProcessHandlers(application, runtime);
  assert.equal(runtime.listenerCount('SIGINT'), 1);
  assert.equal(runtime.listenerCount('SIGTERM'), 1);
  assert.equal(runtime.listenerCount('unhandledRejection'), 1);

  runtime.emit('SIGTERM');
  await stopped;
  runtime.emit('SIGINT');
  await Promise.resolve();
  assert.equal(stopCount, 1);

  removeHandlers();
  assert.equal(runtime.listenerCount('SIGINT'), 0);
  assert.equal(runtime.listenerCount('SIGTERM'), 0);
  assert.equal(runtime.listenerCount('unhandledRejection'), 0);
});
