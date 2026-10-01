const assert = require('node:assert/strict');
const test = require('node:test');

const { config } = require('../dist/config.js');
const {
  PRACTICE_TEMPLATE_PAGE_ID_CONFIG_KEY,
  PracticeTemplateService,
} = require('../dist/services/notion/practiceTemplateService.js');

function text(content) {
  return { plain_text: content };
}

function titlePage(id, title, additionalProperties = {}) {
  return {
    id,
    properties: {
      タイトル: { type: 'title', title: [text(title)] },
      ...additionalProperties,
    },
  };
}

test.beforeEach(() => config.notionConfigs.clear());
test.after(() => config.notionConfigs.clear());

test('renders a practice announcement from direct and related Notion properties', async () => {
  const publicity = titlePage('publicity-1', '広報担当');
  const client = {
    pages: {
      retrieve: async ({ page_id }) => {
        if (page_id === publicity.id) return publicity;
        throw new Error(`unexpected page: ${page_id}`);
      },
    },
  };
  const service = new PracticeTemplateService(client);
  const place = titlePage('place-1', '練習施設A', {
    アクセス: {
      type: 'rich_text',
      rich_text: [text('• 地下鉄「栄」から徒歩7分\n'), text('• 市バスから徒歩2分')],
    },
  });
  const practice = {
    id: '01234567-89ab-4cde-8f01-23456789abcd',
    properties: {
      タイトル: { type: 'title', title: [text('合奏')] },
      時間フォーマット: {
        type: 'formula',
        formula: { type: 'string', string: 'AM(9:00-12:00)' },
      },
      部屋: { type: 'rich_text', rich_text: [text('リハ室')] },
      練習内容: { type: 'rich_text', rich_text: [] },
      先生方: {
        type: 'multi_select',
        multi_select: [{ id: 'teacher-1', name: '講師A先生', color: 'blue' }],
      },
      情宣: { type: 'relation', relation: [{ id: publicity.id }] },
    },
  };

  const rendered = await service.renderPractice(practice, new Date('2026-08-05T00:00:00+09:00'), {
    placeRelations: [place],
  });

  assert.match(rendered, /## 8\/5\(水\) 練習連絡/);
  assert.match(rendered, /AM\(9:00-12:00\)で実施します/);
  assert.match(rendered, /練習施設A\nリハ室/);
  assert.match(rendered, /• 地下鉄「栄」から徒歩7分\n• 市バスから徒歩2分/);
  assert.match(rendered, /＊講師A先生がいらっしゃいます。/);
  assert.match(rendered, /＊渉外（広報担当）/);
  assert.match(rendered, /https:\/\/notion\.so\/0123456789ab4cde8f0123456789abcd/);
});

test('loads one validated code block and keeps the last good template after a bad reload', async () => {
  config.notionConfigs.set(PRACTICE_TEMPLATE_PAGE_ID_CONFIG_KEY, 'template-page');
  let codeBlocks = ['通知: {{title}} / {{placeText}}'];
  const client = {
    blocks: {
      children: {
        list: async () => ({
          results: codeBlocks.map((content, index) => ({
            object: 'block',
            id: `block-${index}`,
            type: 'code',
            code: { rich_text: [text(content)] },
          })),
          has_more: false,
          next_cursor: null,
        }),
      },
    },
  };
  const service = new PracticeTemplateService(client);

  const loaded = await service.reload();
  assert.equal(loaded.updated, true);
  assert.equal(loaded.source, 'notion');

  const practice = {
    id: 'practice-1',
    properties: {
      タイトル: { type: 'title', title: [text('合奏')] },
    },
  };
  assert.equal(
    await service.renderPractice(practice, new Date('2026-08-05T00:00:00+09:00')),
    '通知: 合奏 /'
  );

  codeBlocks = ['壊れた {{unknown}}'];
  const rejected = await service.reload();
  assert.equal(rejected.updated, false);
  assert.match(rejected.message, /最終正常版/);
  assert.equal(
    await service.renderPractice(practice, new Date('2026-08-05T00:00:00+09:00')),
    '通知: 合奏 /'
  );
});

test('updates the single Notion code block after validating placeholders', async () => {
  config.notionConfigs.set(PRACTICE_TEMPLATE_PAGE_ID_CONFIG_KEY, 'template-page');
  const updates = [];
  const client = {
    blocks: {
      children: {
        list: async () => ({
          results: [
            {
              object: 'block',
              id: 'template-code-block',
              type: 'code',
              code: { rich_text: [text('通知: {{title}}')] },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      },
      update: async (input) => updates.push(input),
    },
  };
  const service = new PracticeTemplateService(client);
  await service.reload();

  await service.updateTemplate('練習日: {{dateLabel}}\n場所: {{placeText}}');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].block_id, 'template-code-block');
  assert.equal(
    updates[0].code.rich_text.map((item) => item.text.content).join(''),
    '練習日: {{dateLabel}}\n場所: {{placeText}}'
  );
  assert.equal(service.getTemplatePreview(), '練習日: {{dateLabel}}\n場所: {{placeText}}');

  await assert.rejects(service.updateTemplate('壊れた {{unknown}}'), /未対応のプレースホルダー/);
  assert.equal(updates.length, 1);
});
