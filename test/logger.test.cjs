const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

function checkLogRouting(channelId) {
  const loggerModule = path.resolve('dist/utils/logger.js');
  const script = `
    const assert = require('node:assert/strict');
    const { logger } = require(${JSON.stringify(loggerModule)});
    const messages = [];
    logger.on('discordLog', message => messages.push(message));
    Promise.all([
      logger.debug('debug message'),
      logger.info('info message', { debug: true }),
      logger.error('error message'),
    ]).then(() => {
      assert.equal(logger.getLoggerChannelId(), ${JSON.stringify(channelId || '')});
      assert.deepEqual(messages.map(message => message.message),
        ${JSON.stringify(channelId ? ['debug message', 'info message', 'error message'] : [])});
    }).catch(error => { console.error(error); process.exitCode = 1; });
  `;
  return spawnSync(globalThis.process.execPath, ['-e', script], {
    cwd: '/tmp',
    env: {
      PATH: globalThis.process.env.PATH,
      NODE_ENV: 'test',
      DISCORD_BOT_TOKEN: 'test-only-token',
      DISCORD_RELAY_WEBHOOK: 'https://example.com/webhook',
      NOTION_TOKEN: 'test-only-notion-token',
      NOTION_CONFIGURATION_DATABASEID: 'test-database-id',
      ...(channelId ? { DISCORD_LOG_CHANNEL_ID: channelId } : {}),
    },
    encoding: 'utf8',
  });
}

test('keeps console logging active without forwarding when no Discord destination is set', () => {
  const result = checkLogRouting();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /debug message/);
  assert.match(result.stdout, /info message/);
  assert.match(result.stderr, /error message/);
});

test('forwards debug, opted-in info and error messages to the configured Discord destination', () => {
  const result = checkLogRouting('123456789012345678');
  assert.equal(result.status, 0, result.stderr);
});
