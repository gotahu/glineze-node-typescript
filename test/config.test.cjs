const assert = require('node:assert/strict');
const test = require('node:test');

const notionModulePath = require.resolve('@notionhq/client');
const originalNotionModule = require(notionModulePath);
const updateCalls = [];
const createCalls = [];

class FakeNotionClient {
  constructor(options) {
    this.options = options;
    this.pages = {
      update: async (request) => {
        updateCalls.push(request);
      },
      create: async (request) => {
        createCalls.push(request);
        return { id: 'created-page' };
      },
    };
  }
}

require.cache[notionModulePath].exports = {
  ...originalNotionModule,
  Client: FakeNotionClient,
};

delete require.cache[require.resolve('../dist/config.js')];
const { config } = require('../dist/config.js');
const queryUtils = require('../dist/utils/notion/queryUtils.js');
const propertyUtils = require('../dist/utils/notion/propertyUtils.js');

function resetConfig() {
  config.notionConfigs.clear();
  config.configurationPages.clear();
  updateCalls.length = 0;
  createCalls.length = 0;
}

test.beforeEach(resetConfig);
test.after(() => {
  require.cache[notionModulePath].exports = originalNotionModule;
});

test('loads configuration values and update metadata from Notion pages', async (t) => {
  const originalQuery = queryUtils.queryAllDatabasePages;
  const originalGetString = propertyUtils.getStringPropertyValue;
  t.after(() => {
    queryUtils.queryAllDatabasePages = originalQuery;
    propertyUtils.getStringPropertyValue = originalGetString;
  });

  queryUtils.queryAllDatabasePages = async (_client, databaseId) => {
    assert.equal(databaseId, config.notion.configurationDatabaseId);
    return [
      {
        id: 'page-1',
        properties: { value: { type: 'rich_text' } },
        values: { key: 'countdown_title', value: '定期演奏会' },
      },
      {
        id: 'page-2',
        properties: { value: { type: 'unsupported' } },
        values: { key: 'read_only', value: 'value' },
      },
    ];
  };
  propertyUtils.getStringPropertyValue = (page, key) => page.values[key];

  await config.initializeConfig();

  assert.equal(config.getConfig('countdown_title'), '定期演奏会');
  assert.equal(config.getConfig('read_only'), 'value');
  assert.deepEqual(config.configurationPages.get('countdown_title'), {
    pageId: 'page-1',
    valuePropertyType: 'rich_text',
  });
  assert.equal(config.configurationPages.has('read_only'), false);
});

test('reads known values and rejects missing or empty configuration values', () => {
  config.notionConfigs.set('known', 'value');
  config.notionConfigs.set('empty', '');

  assert.equal(config.getConfig('known'), 'value');
  assert.throws(() => config.getConfig('missing'), /key: missing/);
  assert.throws(() => config.getConfig('empty'), /key: empty/);
});

test('updates Notion before replacing the in-memory configuration value', async () => {
  config.notionConfigs.set('countdown_title', '旧タイトル');
  config.configurationPages.set('countdown_title', {
    pageId: 'page-1',
    valuePropertyType: 'title',
  });

  await config.setConfig('countdown_title', '新タイトル');

  assert.deepEqual(updateCalls, [
    {
      page_id: 'page-1',
      properties: {
        value: {
          title: [{ type: 'text', text: { content: '新タイトル' } }],
        },
      },
    },
  ]);
  assert.equal(config.getConfig('countdown_title'), '新タイトル');
  await assert.rejects(config.setConfig('unknown', 'value'), /存在しないか、更新できない形式/);
});

test('creates the runtime Sesame toggle when upgrading an existing configuration database', async () => {
  await config.setConfig('sesame_enabled', 'false');

  assert.equal(createCalls.length, 1);
  assert.deepEqual(createCalls[0].parent, {
    database_id: config.notion.configurationDatabaseId,
  });
  assert.equal(config.getConfig('sesame_enabled'), 'false');
  assert.deepEqual(config.configurationPages.get('sesame_enabled'), {
    pageId: 'created-page',
    valuePropertyType: 'rich_text',
  });
});

test('creates the reminder database setting when upgrading an existing configuration database', async () => {
  const databaseId = '50af38e4-e9dd-439e-8592-e8cdb8097412';

  await config.setConfig('reminder_databaseid', databaseId);

  assert.equal(createCalls.length, 1);
  assert.equal(config.getConfig('reminder_databaseid'), databaseId);
  assert.deepEqual(config.configurationPages.get('reminder_databaseid'), {
    pageId: 'created-page',
    valuePropertyType: 'rich_text',
  });
});

test('maps supported Notion configuration property types', () => {
  assert.deepEqual(config.createNotionValueProperty('url', 'https://example.com'), {
    url: 'https://example.com',
  });
  assert.deepEqual(config.createNotionValueProperty('number', '42'), { number: 42 });
  assert.deepEqual(config.createNotionValueProperty('select', '選択肢'), {
    select: { name: '選択肢' },
  });
  assert.deepEqual(config.createNotionValueProperty('multi_select', 'A, B, ,C'), {
    multi_select: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  });
  assert.throws(
    () => config.createNotionValueProperty('number', 'not-a-number'),
    /数値として解釈できない/
  );
});
