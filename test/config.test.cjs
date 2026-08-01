const assert = require('node:assert/strict');
const test = require('node:test');

const { ConfigurationService } = require('../dist/config.js');
const {
  NotionConfigRepository,
  createNotionValueProperty,
} = require('../dist/adapters/notion/NotionConfigRepository.js');
const { ConfigStore } = require('../dist/shared/config/ConfigStore.js');

class FakeConfigRepository {
  constructor(values = new Map()) {
    this.values = values;
    this.updateCalls = [];
    this.failure = undefined;
  }

  async loadAll() {
    return this.values;
  }

  async updateMany(updates, previousValues) {
    this.updateCalls.push({ updates, previousValues });
    if (this.failure) throw this.failure;
  }
}

test('loads configuration values through the repository boundary', async () => {
  const repository = new FakeConfigRepository(
    new Map([
      ['countdown_title', '定期演奏会'],
      ['countdown_notify_days', '30,7,1,0'],
    ])
  );
  const service = new ConfigurationService(new ConfigStore(), repository);

  await service.initialize();

  assert.equal(service.get('countdown_title'), '定期演奏会');
  assert.deepEqual(service.get('countdown_notify_days'), [30, 7, 1, 0]);
});

test('rejects missing, empty, and invalid typed configuration values', () => {
  const store = new ConfigStore();
  store.replace(
    new Map([
      ['countdown_title', ''],
      ['countdown_notify_days', '7,invalid'],
    ])
  );

  assert.throws(() => store.get('countdown_date'), /key: countdown_date/);
  assert.throws(() => store.get('countdown_title'), /key: countdown_title/);
  assert.throws(() => store.get('countdown_notify_days'), /0以上の整数/);
  assert.throws(() => store.validateUpdates([{ key: 'countdown_title', value: '' }]), /空の値/);
});

test('updates persistence once before atomically replacing runtime values', async () => {
  const repository = new FakeConfigRepository();
  const service = new ConfigurationService(new ConfigStore(), repository);
  service.replaceRuntimeValues(
    new Map([
      ['countdown_title', '旧タイトル'],
      ['countdown_date', '2026-08-10'],
    ])
  );

  await service.updateMany([
    { key: 'countdown_title', value: '新タイトル' },
    { key: 'countdown_date', value: '2026-09-10' },
  ]);

  assert.equal(repository.updateCalls.length, 1);
  assert.equal(repository.updateCalls[0].previousValues.get('countdown_title'), '旧タイトル');
  assert.equal(service.get('countdown_title'), '新タイトル');
  assert.equal(service.get('countdown_date'), '2026-09-10');
});

test('does not change runtime values when persistence fails', async () => {
  const repository = new FakeConfigRepository();
  repository.failure = new Error('Notion unavailable');
  const service = new ConfigurationService(new ConfigStore(), repository);
  service.replaceRuntimeValues(new Map([['countdown_title', '旧タイトル']]));

  await assert.rejects(service.set('countdown_title', '新タイトル'), /Notion unavailable/);

  assert.equal(service.get('countdown_title'), '旧タイトル');
});

test('loads Notion update metadata and rolls back completed pages after a partial failure', async () => {
  const textValue = (type, value) => ({
    id: type,
    type,
    [type]: [{ type: 'text', plain_text: value, text: { content: value } }],
  });
  const pages = [
    {
      id: 'page-title',
      properties: {
        key: textValue('title', 'countdown_title'),
        value: textValue('title', '旧タイトル'),
      },
    },
    {
      id: 'page-date',
      properties: {
        key: textValue('title', 'countdown_date'),
        value: textValue('rich_text', '2026-08-10'),
      },
    },
  ];

  const updateCalls = [];
  const client = {
    databases: {
      retrieve: async ({ database_id }) => {
        assert.equal(database_id, 'config-db');
        return { data_sources: [{ id: 'config-source' }] };
      },
    },
    dataSources: {
      query: async ({ data_source_id }) => {
        assert.equal(data_source_id, 'config-source');
        return { results: pages, has_more: false, next_cursor: null };
      },
    },
    pages: {
      update: async (request) => {
        updateCalls.push(request);
        if (request.page_id === 'page-date') throw new Error('second update failed');
      },
    },
  };
  const repository = new NotionConfigRepository(client, 'config-db');
  const previousValues = await repository.loadAll();

  await assert.rejects(
    repository.updateMany(
      [
        { key: 'countdown_title', value: '新タイトル' },
        { key: 'countdown_date', value: '2026-09-10' },
      ],
      previousValues
    ),
    /Failed to update configuration/
  );

  assert.deepEqual(
    updateCalls.map(({ page_id, properties }) => ({ page_id, properties })),
    [
      {
        page_id: 'page-title',
        properties: {
          value: { title: [{ type: 'text', text: { content: '新タイトル' } }] },
        },
      },
      {
        page_id: 'page-date',
        properties: {
          value: { rich_text: [{ type: 'text', text: { content: '2026-09-10' } }] },
        },
      },
      {
        page_id: 'page-title',
        properties: {
          value: { title: [{ type: 'text', text: { content: '旧タイトル' } }] },
        },
      },
    ]
  );
});

test('maps supported Notion configuration property types', () => {
  assert.deepEqual(createNotionValueProperty('url', 'https://example.com'), {
    url: 'https://example.com',
  });
  assert.deepEqual(createNotionValueProperty('number', '42'), { number: 42 });
  assert.deepEqual(createNotionValueProperty('select', '選択肢'), {
    select: { name: '選択肢' },
  });
  assert.deepEqual(createNotionValueProperty('multi_select', 'A, B, ,C'), {
    multi_select: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  });
  assert.throws(
    () => createNotionValueProperty('number', 'not-a-number'),
    /数値として解釈できない/
  );
});
