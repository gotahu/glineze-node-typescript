const assert = require('node:assert/strict');
const test = require('node:test');

const { config } = require('../dist/config.js');
const { PracticeService } = require('../dist/services/notion/practiceService.js');
const {
  notifyPractice,
  remindPracticesToChannel,
} = require('../dist/services/notion/practiceFunctions.js');
const queryUtils = require('../dist/utils/notion/queryUtils.js');
const propertyUtils = require('../dist/utils/notion/propertyUtils.js');

function patchNotionUtilities(t, { query, getString, getRelation }) {
  const originalQuery = queryUtils.queryAllDatabasePages;
  const originalGetString = propertyUtils.getStringPropertyValue;
  const originalGetRelation = propertyUtils.getRelationPropertyValue;
  queryUtils.queryAllDatabasePages = query;
  propertyUtils.getStringPropertyValue = getString;
  propertyUtils.getRelationPropertyValue = getRelation;
  t.after(() => {
    queryUtils.queryAllDatabasePages = originalQuery;
    propertyUtils.getStringPropertyValue = originalGetString;
    propertyUtils.getRelationPropertyValue = originalGetRelation;
  });
}

test.beforeEach(() => config.notionConfigs.clear());
test.after(() => config.notionConfigs.clear());

test('maps a Notion practice page to the current Practice model', async (t) => {
  config.notionConfigs.set('practice_databaseid', 'practice-db');
  let receivedFilter;
  const page = {
    id: 'practice-1',
    url: 'https://notion.example/practice-1',
    values: {
      タイトル: '合奏',
      時間: '18:00–21:00',
      練習内容: '全曲',
      練習連絡: '次回は (Mon) です',
    },
  };
  const place = { values: { タイトル: '市民ホール' } };
  patchNotionUtilities(t, {
    query: async (_client, databaseId, filter) => {
      assert.equal(databaseId, 'practice-db');
      receivedFilter = filter;
      return [page];
    },
    getString: (target, key) => target.values[key],
    getRelation: async (_client, target, key) => {
      assert.equal(target, page);
      assert.equal(key, '練習場所');
      return [place];
    },
  });

  const service = new PracticeService({});
  const practices = await service.retrievePracticesForRelativeDay(1);

  assert.match(receivedFilter.date.equals, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(receivedFilter.property, '日付');
  assert.equal(practices.length, 1);
  assert.deepEqual(
    { ...practices[0], date: undefined },
    {
      id: 'practice-1',
      url: 'https://notion.example/practice-1',
      title: '合奏',
      date: undefined,
      time: '18:00–21:00',
      content: '全曲',
      place: '市民ホール',
      announceText: '次回は (月) です',
    }
  );
  assert.ok(practices[0].date instanceof Date);
});

test('preserves the original Notion failure as the cause', async (t) => {
  config.notionConfigs.set('practice_databaseid', 'practice-db');
  const notionFailure = new Error('Notion unavailable');
  patchNotionUtilities(t, {
    query: async () => {
      throw notionFailure;
    },
    getString: () => undefined,
    getRelation: async () => [],
  });

  await assert.rejects(new PracticeService({}).retrievePracticesForRelativeDay(1), (error) => {
    assert.equal(error.message, 'Failed to retrieve practices');
    assert.equal(error.cause, notionFailure);
    return true;
  });
});

test('sends all practice announcement texts to the requested channel', async () => {
  const sends = [];
  const services = {
    notion: {
      practiceService: {
        retrievePracticesForRelativeDay: async (days) => {
          assert.equal(days, 1);
          return [{ announceText: '連絡A' }, { announceText: '連絡B' }];
        },
      },
    },
    discord: {
      sendStringsToChannel: async (messages, channelId) => sends.push({ messages, channelId }),
    },
  };

  const result = await notifyPractice(services, {
    channelId: 'practice-channel',
    daysFromToday: 1,
  });

  assert.deepEqual(sends, [{ messages: ['連絡A', '連絡B'], channelId: 'practice-channel' }]);
  assert.deepEqual(result, { practiceCount: 2, sentCount: 2 });
});

test('does not send when there is no practice to announce', async () => {
  const services = {
    notion: {
      practiceService: { retrievePracticesForRelativeDay: async () => [] },
    },
    discord: {
      sendStringsToChannel: async () => assert.fail('should not send an empty notification'),
    },
  };

  const result = await notifyPractice(services, {
    channelId: 'practice-channel',
    daysFromToday: 1,
  });

  assert.deepEqual(result, { practiceCount: 0, sentCount: 0 });
});

test('does not send a failure-looking message when practice announcement text is empty', async () => {
  const services = {
    notion: {
      practiceService: { retrievePracticesForRelativeDay: async () => [{ announceText: '' }] },
    },
    discord: {
      sendStringsToChannel: async () => assert.fail('should not send an empty notification'),
    },
  };

  const result = await notifyPractice(services, {
    channelId: 'practice-channel',
    daysFromToday: 1,
  });

  assert.deepEqual(result, { practiceCount: 1, sentCount: 0 });
});

test('characterizes the current reminder behavior for multiple practices', async (t) => {
  config.notionConfigs.set('facility_databaseid', 'facility-db');
  const facilities = [
    { values: { タイトル: 'ホールA', リマインド: '7' } },
    { values: { タイトル: 'ホールB', リマインド: '14' } },
  ];
  patchNotionUtilities(t, {
    query: async (_client, databaseId) => {
      assert.equal(databaseId, 'facility-db');
      return facilities;
    },
    getString: (target, key) => target.values[key],
    getRelation: async () => [],
  });
  const practiceA = {
    title: '練習A',
    url: 'https://example.com/a',
    place: 'ホールA',
    date: new Date('2026-08-10T00:00:00+09:00'),
  };
  const practiceB = {
    title: '練習B',
    url: 'https://example.com/b',
    place: 'ホールB',
    date: new Date('2026-08-17T00:00:00+09:00'),
  };
  const sends = [];
  const services = {
    notion: {
      client: {},
      practiceService: {
        retrievePracticesForRelativeDay: async (days) => (days === 7 ? [practiceA] : [practiceB]),
      },
    },
    discord: {
      sendStringsToChannel: async (messages, channelId) => sends.push({ messages, channelId }),
    },
  };

  await remindPracticesToChannel(services, 'reminder-channel');

  assert.equal(sends.length, 2);
  assert.ok(sends.every(({ channelId }) => channelId === 'reminder-channel'));
  assert.ok(sends.every(({ messages }) => messages[0].includes('[練習A](https://example.com/a)')));
  assert.ok(sends.every(({ messages }) => messages[0].includes('[練習B](https://example.com/b)')));
});
