const assert = require('node:assert/strict');
const test = require('node:test');

const { config } = require('../dist/config.js');
const {
  calculateDiffBetweenTodayAndEventDate,
  forceSendCountdownMessage,
  sendCountdownMessage,
} = require('../dist/features/countdown/CountdownFunctions.js');

function jstDateString(daysFromToday) {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 + daysFromToday * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function setCountdownConfig(overrides = {}) {
  const values = {
    countdown_date: jstDateString(7),
    countdown_title: 'テスト演奏会',
    countdown_message: '{title}まであと{days}日',
    countdown_channelid: 'countdown-channel',
    countdown_notify_days: '30,7,1,0',
    discord_general_channelid: 'general-channel',
    ...overrides,
  };
  config.replaceRuntimeValues(new Map(Object.entries(values)));
}

test.beforeEach(() => setCountdownConfig());
test.after(() => config.replaceRuntimeValues(new Map()));

test('calculates whole calendar days in Asia/Tokyo', (t) => {
  const originalLog = globalThis.console.log;
  globalThis.console.log = () => {};
  t.after(() => {
    globalThis.console.log = originalLog;
  });

  assert.equal(calculateDiffBetweenTodayAndEventDate(), 7);
  setCountdownConfig({ countdown_date: jstDateString(0) });
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

test('falls back to the general channel when no countdown channel is configured', async (t) => {
  const originalLog = globalThis.console.log;
  globalThis.console.log = () => {};
  t.after(() => {
    globalThis.console.log = originalLog;
  });
  const values = new Map(config.getAll());
  values.delete('countdown_channelid');
  config.replaceRuntimeValues(values);
  const sends = [];

  await forceSendCountdownMessage({
    discord: {
      sendStringsToChannel: async (messages, channelId) => sends.push({ messages, channelId }),
    },
  });

  assert.equal(sends[0].channelId, 'general-channel');
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

  setCountdownConfig({ countdown_notify_days: '30,1,0' });
  await sendCountdownMessage(services);
  assert.equal(sends.length, 1);
});
