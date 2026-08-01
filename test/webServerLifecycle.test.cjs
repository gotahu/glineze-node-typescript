const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

globalThis.process.env.SESAME_ENABLED = 'false';
globalThis.process.env.NOTION_AUTOMATION_ENABLED = 'false';
globalThis.process.env.PORT = '0';

const { WebServerService } = require('../dist/services/webapi/webServerService.js');

function createServices() {
  return {
    discord: {
      client: { isReady: () => true },
      stats: {
        dailyMessages: new Map(),
        dailyReactions: new Map(),
        popularEmojis: new Map([['👍', 2]]),
      },
    },
  };
}

test('serves health and status data and stops the listening server', async (t) => {
  const webServer = new WebServerService(createServices());
  assert.equal(webServer.server, undefined);
  await webServer.start();
  t.after(async () => webServer.stop());
  if (!webServer.server.listening) await once(webServer.server, 'listening');

  const address = webServer.server.address();
  assert.equal(typeof address, 'object');
  const origin = `http://127.0.0.1:${address.port}`;

  const statusPage = await globalThis.fetch(origin);
  assert.equal(statusPage.status, 200);
  assert.match(statusPage.headers.get('content-type'), /^text\/html/);
  assert.match(await statusPage.text(), /<title>Glineze System Status<\/title>/);

  const statusImage = await globalThis.fetch(`${origin}/assets/status-operational.png`);
  assert.equal(statusImage.status, 200);
  assert.match(statusImage.headers.get('content-type'), /^image\/png/);

  const health = await globalThis.fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  const healthPayload = await health.json();
  assert.equal(healthPayload.status, 'operational');
  assert.ok(Array.isArray(healthPayload.services));

  const status = await globalThis.fetch(`${origin}/api/status`);
  assert.equal(status.status, 200);
  const snapshot = await status.json();
  assert.equal(snapshot.overall, 'operational');
  assert.equal(snapshot.services.find((service) => service.id === 'discord').state, 'operational');
  assert.deepEqual(snapshot.activity.popularReactions, [{ emoji: '👍', count: 2 }]);

  await webServer.stop();
  assert.equal(webServer.server, undefined);
});
