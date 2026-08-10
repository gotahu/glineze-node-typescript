const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CONFIG_DEFINITIONS,
  ConfigValidationError,
  isSensitiveConfigKey,
  normalizeConfigValue,
} = require('../dist/config/definitions.js');
const {
  ConfigService,
  ConfigEffectError,
  ConfigPartialUpdateError,
} = require('../dist/config/service.js');
const { ConfigStore } = require('../dist/config/store.js');

test('defines every configuration key currently consumed by the application', () => {
  const expected = [
    'bashotori_remind_threadid',
    'countdown_channelid',
    'countdown_date',
    'countdown_message',
    'countdown_notify_days',
    'countdown_title',
    'discord_and_notion_pairs_databaseid',
    'discord_general_channelid',
    'facility_databaseid',
    'practice_announcement_template_page_id',
    'practice_databaseid',
    'practice_remind_threadid',
    'sesame_app_api_key',
    'sesame_app_api_url',
    'sesame_device_publickey',
    'sesame_device_uuid',
    'sesame_enabled',
    'sesame_message_when_loading',
    'sesame_message_when_locked',
    'sesame_message_when_unlocked',
    'shukin_databaseid',
  ];

  assert.deepEqual(Object.keys(CONFIG_DEFINITIONS).sort(), expected);
});

test('normalizes shared countdown inputs and rejects invalid identifiers', () => {
  assert.equal(normalizeConfigValue('countdown_notify_days', '1, 30,1,0'), '30,1,0');
  assert.equal(normalizeConfigValue('countdown_date', '2028-02-29'), '2028-02-29');
  assert.throws(() => normalizeConfigValue('countdown_date', '2027-02-29'), ConfigValidationError);
  assert.throws(
    () => normalizeConfigValue('practice_remind_threadid', 'not-a-discord-id'),
    ConfigValidationError
  );
  assert.equal(
    normalizeConfigValue('practice_databaseid', '1b21ea2409888007977ad23654285ece'),
    '1b21ea2409888007977ad23654285ece'
  );
  assert.equal(
    normalizeConfigValue(
      'practice_databaseid',
      'https://app.notion.com/p/chorglanze/70272343a6ae48888feeda84566c499e?v=a73fbc09bd324328991c7d49591d85d8&source=copy_link'
    ),
    '70272343a6ae48888feeda84566c499e'
  );
  assert.throws(
    () =>
      normalizeConfigValue(
        'practice_databaseid',
        'https://example.com/70272343a6ae48888feeda84566c499e?v=a73fbc09bd324328991c7d49591d85d8'
      ),
    ConfigValidationError
  );
  assert.equal(normalizeConfigValue('sesame_enabled', 'true'), 'true');
  assert.throws(() => normalizeConfigValue('sesame_enabled', 'yes'), ConfigValidationError);
});

test('classifies secrets without exposing their values', () => {
  assert.equal(isSensitiveConfigKey('sesame_app_api_key'), true);
  assert.equal(isSensitiveConfigKey('sesame_device_publickey'), true);
  assert.equal(isSensitiveConfigKey('countdown_title'), false);
  assert.equal(isSensitiveConfigKey('future_webhook_secret'), true);
});

test('validates all updates before writing and runs only relevant effects', async () => {
  const updates = [];
  const effects = [];
  const repository = {
    pages: new Map(),
    load: async () => ({ values: new Map(), pages: new Map() }),
    update: async (key, value) => updates.push([key, value]),
  };
  const service = new ConfigService(repository, new ConfigStore());
  service.setEffectHandlers({
    'bot-profile': () => effects.push('bot-profile'),
    sesame: () => effects.push('sesame'),
  });

  await service.updateMany({
    countdown_title: '演奏会',
    countdown_date: '2028-02-29',
  });
  assert.deepEqual(updates, [
    ['countdown_title', '演奏会'],
    ['countdown_date', '2028-02-29'],
  ]);
  assert.deepEqual(effects, ['bot-profile']);

  updates.length = 0;
  await assert.rejects(
    service.updateMany({ countdown_title: '変更前', countdown_date: '2027-02-29' }),
    ConfigValidationError
  );
  assert.deepEqual(updates, []);
});

test('reloads persistent state after a partial multi-update failure', async () => {
  let writes = 0;
  let loads = 0;
  const repository = {
    pages: new Map(),
    load: async () => {
      loads++;
      return { values: new Map([['countdown_title', 'Notion上の値']]), pages: new Map() };
    },
    update: async () => {
      writes++;
      if (writes === 2) throw new Error('Notion unavailable');
    },
  };
  const store = new ConfigStore();
  store.values.set('countdown_title', '古い値');
  const service = new ConfigService(repository, store);

  await assert.rejects(
    service.updateMany({ countdown_title: '新しい値', countdown_date: '2028-02-29' }),
    ConfigPartialUpdateError
  );
  assert.equal(loads, 1);
  assert.equal(store.get('countdown_title'), 'Notion上の値');
});

test('reports effect failures separately after persisting settings and runs remaining effects', async () => {
  const updates = [];
  const effects = [];
  const repository = {
    pages: new Map(),
    load: async () => ({ values: new Map(), pages: new Map() }),
    update: async (key, value) => updates.push([key, value]),
  };
  const store = new ConfigStore();
  const service = new ConfigService(repository, store);
  service.setEffectHandlers({
    'bot-profile': async () => {
      effects.push('bot-profile');
      throw new Error('Discord unavailable');
    },
    'practice-template': () => effects.push('practice-template'),
  });

  await assert.rejects(
    service.updateMany({
      countdown_title: '保存済み',
      practice_announcement_template_page_id: '1b21ea2409888007977ad23654285ece',
    }),
    (error) => error instanceof ConfigEffectError && error.failedEffects.includes('bot-profile')
  );
  assert.equal(store.get('countdown_title'), '保存済み');
  assert.equal(updates.length, 2);
  assert.deepEqual(effects.sort(), ['bot-profile', 'practice-template']);
});
