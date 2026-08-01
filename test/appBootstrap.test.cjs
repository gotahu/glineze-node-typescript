const assert = require('node:assert/strict');
const test = require('node:test');

const { main } = require('../dist/app.js');
const { logger } = require('../dist/utils/logger.js');

test('main delegates service initialization without starting services on module import', async (t) => {
  const originalInfo = logger.info;
  const messages = [];
  logger.info = async (message) => {
    messages.push(message);
  };
  t.after(() => {
    logger.info = originalInfo;
  });
  let initialized = false;

  await main(async () => {
    initialized = true;
  });

  assert.equal(initialized, true);
  assert.deepEqual(messages, ['glineze アプリケーションを起動します']);
});
