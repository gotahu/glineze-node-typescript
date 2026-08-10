const assert = require('node:assert/strict');
const test = require('node:test');

const { config } = require('../dist/config.js');
const {
  calculateDiffBetweenTodayAndEventDate,
  forceSendCountdownMessage,
  sendCountdownMessage,
  renderCountdownMessage,
} = require('../dist/services/discord/functions/CountdownFunctions.js');

function jstDateString(daysFromToday) {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 + daysFromToday * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function setCountdownConfig(overrides = {}) {
  config.notionConfigs.clear();
  const values = {
    countdown_date: jstDateString(7),
    countdown_title: 'テスト演奏会',
    countdown_message: '{title}まであと{days}日',
    countdown_channelid: 'countdown-channel',
    countdown_notify_days: '30,7,1,0',
    discord_general_channelid: 'general-channel',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) config.notionConfigs.set(key, value);
}

test.beforeEach(() => setCountdownConfig());
test.after(() => config.notionConfigs.clear());

test('calculates whole calendar days in Asia/Tokyo', (t) => {
  const originalLog = globalThis.console.log;
  globalThis.console.log = () => {};
  t.after(() => {
    globalThis.console.log = originalLog;
  });

  assert.equal(calculateDiffBetweenTodayAndEventDate(), 7);
  config.notionConfigs.set('countdown_date', jstDateString(0));
  assert.equal(calculateDiffBetweenTodayAndEventDate(), 0);
});

test('formats and sends a forced countdown notification', async (t) => {
  const originalLog = globalThis.console.log;
  globalThis.console.log = () => {};
  t.after(() => {
    globalThis.console.log = originalLog;
  });
  const sends = [];

  await forceSendCountdownMessage({
    discord: {
      sendStringsToChannel: async (messages, channelId) => sends.push({ messages, channelId }),
    },
  });

  assert.deepEqual(sends, [
    {
      messages: ['テスト演奏会まであと7日'],
      channelId: 'countdown-channel',
    },
  ]);
});

test('renders both readable double-brace and legacy countdown placeholders', () => {
  assert.equal(
    renderCountdownMessage('{{title}}まであと{{days}}日', '定期演奏会', 8),
    '定期演奏会まであと8日'
  );
  assert.equal(renderCountdownMessage('{title}: {days}', '定期演奏会', 8), '定期演奏会: 8');
});

test('only sends scheduled notifications on configured remaining days', async (t) => {
  const originalLog = globalThis.console.log;
  globalThis.console.log = () => {};
  t.after(() => {
    globalThis.console.log = originalLog;
  });
  const sends = [];
  const services = {
    discord: {
      sendStringsToChannel: async (messages, channelId) => sends.push({ messages, channelId }),
    },
  };

  await sendCountdownMessage(services);
  assert.equal(sends.length, 1);

  config.notionConfigs.set('countdown_notify_days', '30,1,0');
  await sendCountdownMessage(services);
  assert.equal(sends.length, 1);
});
