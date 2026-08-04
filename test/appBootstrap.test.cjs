const assert = require('node:assert/strict');
const test = require('node:test');

const { formatDiscordLogMessage, main } = require('../dist/app.js');
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

test('formats Discord logs without a timestamp', () => {
  const timestamp = new Date('2026-08-04T09:52:40.070Z');

  assert.equal(
    formatDiscordLogMessage({ level: 'INFO', message: '練習を1件取得しました。', timestamp }),
    '[INFO] 練習を1件取得しました。'
  );
});
