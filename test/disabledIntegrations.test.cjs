const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

globalThis.process.env.SESAME_ENABLED = 'false';
globalThis.process.env.NOTION_AUTOMATION_ENABLED = 'false';
globalThis.process.env.PORT = '0';

const { handleSesameStatusCommand } = require('../dist/services/discord/commands/SesameCommand.js');
const { WebServerService } = require('../dist/services/webapi/webServerService.js');

test('Sesame command remains disabled without constructing the integration', async () => {
  const replies = [];

  await handleSesameStatusCommand(
    {
      reply: async (message) => replies.push(message),
    },
    [],
    {}
  );

  assert.deepEqual(replies, ['Sesame 連携は停止中です']);
});

test('Notion automation endpoint returns service unavailable while disabled', async (t) => {
  const webServer = new WebServerService({
    discord: {
      client: { isReady: () => false },
      stats: {
        dailyMessages: new Map(),
        dailyReactions: new Map(),
        popularEmojis: new Map(),
      },
    },
  });
  t.after(async () => webServer.stop());

  if (!webServer.server.listening) {
    await once(webServer.server, 'listening');
  }
  const address = webServer.server.address();
  assert.equal(typeof address, 'object');

  const response = await globalThis.fetch(`http://127.0.0.1:${address.port}/automation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ignored: true }),
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'service_disabled' });

  const admin = await globalThis.fetch(`http://127.0.0.1:${address.port}/admin`);
  assert.equal(admin.status, 404);
  assert.deepEqual(await admin.json(), { error: 'not_found' });
});
