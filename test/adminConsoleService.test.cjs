const assert = require('node:assert/strict');
const test = require('node:test');

globalThis.process.env.SESAME_ENABLED = 'true';

const { ConfigService } = require('../dist/config/service.js');
const { ConfigStore } = require('../dist/config/store.js');
const {
  AdminConsoleService,
  AdminOperationError,
} = require('../dist/services/admin/adminConsoleService.js');

function createSubject(values = {}, discord, notionClient) {
  const updates = [];
  const templateUpdates = [];
  const store = new ConfigStore();
  for (const [key, value] of Object.entries(values)) store.values.set(key, value);
  const repository = {
    pages: new Map(),
    load: async () => ({ values: new Map(store.values), pages: new Map() }),
    update: async (key, value) => updates.push([key, value]),
  };
  const configs = new ConfigService(repository, store);
  const template = {
    getStatus: () => ({ source: 'builtin', updated: false, message: '組み込み' }),
    getTemplatePreview: () => 'template {{dateLabel}}',
    reload: async () => ({ source: 'builtin', updated: true, message: '再読込済み' }),
    updateTemplate: async (body) => {
      templateUpdates.push(body);
      return { source: 'notion', updated: true, message: '更新済み' };
    },
  };
  const subject = new AdminConsoleService(configs, {
    notion: {
      practiceTemplateService: template,
      ...(notionClient ? { client: notionClient } : {}),
    },
    ...(discord ? { discord } : {}),
  });
  return { subject, updates, templateUpdates };
}

test('never returns stored secret values in a settings view model', () => {
  const secret = 'a-secret-that-must-not-appear';
  const { subject } = createSubject({
    sesame_app_api_key: secret,
    sesame_device_publickey: 'public-key-secret',
    sesame_app_api_url: 'https://example.com',
  });

  const fields = subject.getSettings('sesame');
  const serialized = JSON.stringify(fields);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('public-key-secret'), false);
  assert.equal(fields.find((field) => field.key === 'sesame_app_api_key').configured, true);
  assert.equal(fields.find((field) => field.key === 'sesame_app_api_key').value, undefined);
  assert.equal(
    fields.find((field) => field.key === 'sesame_app_api_url').value,
    'https://example.com'
  );
});

test('always exposes the persisted Sesame runtime toggle', () => {
  const { subject } = createSubject({ sesame_enabled: 'false' });
  const field = subject.getSettings('sesame').find((item) => item.key === 'sesame_enabled');

  assert.equal(field.input, 'boolean');
  assert.equal(field.value, 'false');
});

test('verifies that a Discord channel exists and is sendable', async () => {
  const requested = [];
  const discord = {
    client: {
      isReady: () => true,
      channels: {
        fetch: async (id) => {
          requested.push(id);
          return {
            name: 'practice-room',
            guild: { name: 'Glanze Server' },
            isSendable: () => true,
            isThread: () => false,
          };
        },
      },
    },
  };
  const { subject } = createSubject({}, discord);

  assert.deepEqual(
    await subject.verifyDiscordChannel('practice_remind_threadid', '123456789012345678'),
    {
      id: '123456789012345678',
      name: 'practice-room',
      serverName: 'Glanze Server',
      kind: 'チャンネル',
    }
  );
  assert.deepEqual(requested, ['123456789012345678']);
});

test('verifies that a Notion database exists and returns its name', async () => {
  const requested = [];
  const notionClient = {
    databases: {
      retrieve: async ({ database_id }) => {
        requested.push(database_id);
        return { id: database_id, title: [{ plain_text: '練習DB' }] };
      },
    },
  };
  const { subject } = createSubject({}, undefined, notionClient);

  assert.deepEqual(
    await subject.verifyNotionDatabase('practice_databaseid', '1b21ea2409888007977ad23654285ece'),
    { id: '1b21ea2409888007977ad23654285ece', name: '練習DB' }
  );
  assert.deepEqual(requested, ['1b21ea2409888007977ad23654285ece']);
  await assert.rejects(
    subject.verifyNotionDatabase('countdown_title', '1b21ea2409888007977ad23654285ece'),
    /Notion データベース ID ではありません/
  );
});

test('rejects inaccessible or non-sendable Discord channels', async () => {
  const discord = {
    client: {
      isReady: () => true,
      channels: {
        fetch: async () => ({ name: 'voice', isSendable: () => false }),
      },
    },
  };
  const { subject } = createSubject({}, discord);

  await assert.rejects(
    subject.verifyDiscordChannel('countdown_channelid', '123456789012345678'),
    /メッセージを送信できない/
  );
  await assert.rejects(
    subject.verifyDiscordChannel('practice_databaseid', '123456789012345678'),
    /Discord チャンネル ID ではありません/
  );
});

test('keeps an existing secret when the submitted secret field is empty', async () => {
  const { subject, updates } = createSubject({ sesame_app_api_key: 'existing-secret' });

  await assert.rejects(
    subject.updateSettings('sesame', { sesame_app_api_key: '' }),
    AdminOperationError
  );
  assert.deepEqual(updates, []);
});

test('allows only keys belonging to the requested category', async () => {
  const { subject, updates } = createSubject();

  await assert.rejects(
    subject.updateSettings('countdown', { sesame_app_api_key: 'attempted-secret' }),
    /この画面から設定/
  );
  assert.deepEqual(updates, []);

  await subject.updateSettings('countdown', {
    countdown_title: '定期演奏会',
    countdown_date: '2028-02-29',
  });
  assert.deepEqual(updates, [
    ['countdown_title', '定期演奏会'],
    ['countdown_date', '2028-02-29'],
  ]);
});

test('updates settings from multiple sections in one save', async () => {
  const { subject, updates } = createSubject({ sesame_app_api_key: 'existing-secret' });

  await subject.updateAllSettings({
    countdown_title: '夏の演奏会',
    practice_remind_threadid: '123456789012345678',
    sesame_app_api_key: '',
  });

  assert.deepEqual(updates, [
    ['countdown_title', '夏の演奏会'],
    ['practice_remind_threadid', '123456789012345678'],
  ]);
});

test('exposes a safe system summary and practice-template preview', () => {
  const { subject } = createSubject();
  const system = subject.getSystemStatus();
  assert.equal(typeof system.notionTokenConfigured, 'boolean');
  assert.equal(Object.hasOwn(system, 'notionToken'), false);

  const template = subject.getPracticeTemplate();
  assert.equal(template.preview, 'template {{dateLabel}}');
  assert.equal(template.placeholders.includes('dateLabel'), true);
});

test('updates the practice template only when its body changed', async () => {
  const { subject, templateUpdates } = createSubject();

  await subject.updatePracticeTemplate('template {{dateLabel}}');
  assert.deepEqual(templateUpdates, []);

  await subject.updatePracticeTemplate('次回は {{dateLabel}} {{timeText}}');
  assert.deepEqual(templateUpdates, ['次回は {{dateLabel}} {{timeText}}']);
});
