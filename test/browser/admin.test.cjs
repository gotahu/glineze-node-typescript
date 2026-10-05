const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');
const { chromium } = require('playwright-core');

Object.assign(globalThis.process.env, {
  DISCORD_BOT_TOKEN: 'test-only-token',
  DISCORD_RELAY_WEBHOOK: 'https://example.com/webhook',
  NOTION_TOKEN: 'test-only-token',
  NOTION_CONFIGURATION_DATABASEID: 'test-database',
  ADMIN_ENABLED: 'false',
  SESAME_ENABLED: 'false',
  NOTION_AUTOMATION_ENABLED: 'false',
});

const { createAdminRouter } = require('../../dist/services/admin/adminRouter.js');
const { AdminOperationError } = require('../../dist/services/admin/adminConsoleService.js');

async function createSubject(t) {
  const values = {
    countdown_title: '演奏会',
    countdown_channelid: '123456789012345678',
    practice_databaseid: '11111111111111111111111111111111',
    sesame_enabled: 'false',
  };
  const operations = [];
  const field = (key, extra = {}) => ({
    key,
    label: key,
    description: 'テスト用設定',
    input: 'text',
    value: values[key],
    configured: true,
    ...extra,
  });
  const consoleService = {
    getConfigReloadStatus: () => ({}),
    getSettings: (category) => {
      if (category === 'countdown') {
        return [field('countdown_title'), field('countdown_channelid', { discordChannel: true })];
      }
      if (category === 'advanced') {
        return [field('practice_databaseid', { notionDatabase: true })];
      }
      if (category === 'sesame') return [field('sesame_enabled', { input: 'boolean' })];
      return [];
    },
    getPracticeTemplate: () => ({
      status: { message: 'テスト' },
      preview: '本文',
      placeholders: [],
    }),
    getSystemStatus: () => ({ nodeEnv: 'test' }),
    verifyDiscordChannel: async (key, value) => {
      operations.push(['verify-channel', key, value]);
      if (value === 'invalid') throw new AdminOperationError('チャンネルを確認できません。');
      return { name: 'テストチャンネル', serverName: 'テストサーバー' };
    },
    verifyNotionDatabase: async (key, value) => {
      operations.push(['verify-notion', key, value]);
      return { id: value, name: 'テストDB' };
    },
    updateAllSettings: async (input) => {
      operations.push(['save', input]);
      Object.assign(values, input);
    },
    updatePracticeTemplate: async () => undefined,
    reloadConfig: async () => operations.push(['reload-config']),
    reloadPracticeTemplate: async () => operations.push(['reload-template']),
    rotateLoginLink: async () => operations.push(['rotate-link']),
  };
  const app = express();
  app.use(
    '/admin',
    createAdminRouter({
      consoleService,
      developmentAccess: true,
      secureCookies: false,
      sessionSecret: 'browser-test-only-session-secret',
      sessionTtlMs: 60_000,
      dashboard: () => ({
        overall: 'operational',
        generatedAt: new Date().toISOString(),
        services: [],
        system: { uptimeSeconds: 1, requestsToday: 0, startedAt: new Date().toISOString() },
      }),
    })
  );
  const server = app.listen(0, '127.0.0.1');
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  await once(server, 'listening');
  const browser = await chromium.launch({
    executablePath:
      globalThis.process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(5_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { page, origin, documents, operations };
}

async function edit(page, key, value) {
  const row = page.locator('.setting-row').filter({ has: page.locator(`[name="${key}"]`) });
  await row.locator('[data-edit-field]').click();
  await row.locator(`[name="${key}"]`).fill(value);
}

async function verify(page, key, message = '確認できました') {
  await page.locator(`button[name="_verify"][value="${key}"]`).click();
  await page.waitForFunction(
    ({ key, message }) =>
      globalThis.document.getElementById(`setting-feedback-${key}`).textContent.includes(message),
    { key, message }
  );
}

async function waitForSaved(page) {
  await page.waitForFunction(() =>
    globalThis.document.querySelector('.flash.success')?.textContent.includes('保存しました')
  );
}

test('htmx checks work after navigation, save and system actions without document reloads', async (t) => {
  const { page, origin, documents, operations } = await createSubject(t);
  await page.goto(`${origin}/admin`);
  await page.locator('.primary-nav a[href="/admin/settings"]').click();
  await page.locator('#settings-form').waitFor();
  await edit(page, 'countdown_title', '未保存の演奏会');
  await page.locator('#setting-sesame_enabled').check();
  await page.evaluate(() => {
    globalThis.formBeforeCheck = globalThis.document.getElementById('settings-form');
  });
  await verify(page, 'countdown_channelid');
  await verify(page, 'practice_databaseid');
  assert.equal(await page.locator('#setting-countdown_title').inputValue(), '未保存の演奏会');
  assert.equal(await page.locator('#setting-sesame_enabled').isChecked(), true);
  assert.equal(await page.locator('[data-save-dock]').isVisible(), true);
  assert.equal(
    await page.evaluate(
      () => globalThis.formBeforeCheck === globalThis.document.getElementById('settings-form')
    ),
    true
  );

  await page.locator('[data-save-button]').click();
  await waitForSaved(page);
  assert.equal(await page.locator('[data-save-dock]').isVisible(), false);
  await verify(page, 'countdown_channelid');
  for (const action of ['reload-template', 'reload-config', 'rotate-login-link']) {
    await page.evaluate(() => {
      globalThis.formBeforeAction = globalThis.document.getElementById('settings-form');
    });
    await page.locator(`[formaction="/admin/actions/${action}"]`).click();
    await page.waitForFunction(
      () => globalThis.formBeforeAction !== globalThis.document.getElementById('settings-form')
    );
    await verify(page, 'practice_databaseid');
  }
  await page.goBack();
  await page.locator('.dashboard-content').waitFor();
  await page.goForward();
  await page.locator('#settings-form').waitFor();
  await verify(page, 'countdown_channelid');
  assert.equal(operations.filter(([name]) => name === 'save').length, 1);
  assert.equal(documents.length, 1, 'only the initial visit may load a document');
});

test('verification failures keep edits and show feedback without submitting the form', async (t) => {
  const { page, origin, documents, operations } = await createSubject(t);
  await page.goto(`${origin}/admin/settings`);
  await edit(page, 'countdown_title', '未保存');
  await edit(page, 'countdown_channelid', 'invalid');
  await verify(page, 'countdown_channelid', 'チャンネルを確認できません');
  await page.route('**/admin/actions/verify-notion-database', (route) => route.abort('failed'));
  await verify(page, 'practice_databaseid', '通信に失敗しました');
  assert.equal(await page.locator('#setting-countdown_title').inputValue(), '未保存');
  assert.equal(await page.locator('[data-save-dock]').isVisible(), true);
  assert.equal(await page.locator('button[value="practice_databaseid"]').isEnabled(), true);
  assert.equal(operations.filter(([name]) => name === 'save').length, 0);
  assert.equal(documents.length, 1);
});

test('a failed save response never replays a committed POST and leaves the form editable', async (t) => {
  const { page, origin, documents, operations } = await createSubject(t);
  await page.goto(`${origin}/admin/settings`);
  await edit(page, 'countdown_title', '保存対象');
  await page.route('**/admin/settings', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch(); // Commit the save, then simulate an unreadable proxy response.
    await route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad gateway' });
  });
  await page.locator('[data-save-button]').click();
  await page.locator('[data-request-error]').waitFor();
  assert.equal(await page.locator('#setting-countdown_title').inputValue(), '保存対象');
  assert.equal(await page.locator('[data-save-button]').isEnabled(), true);
  assert.equal(await page.locator('[data-save-dock]').isVisible(), true);
  assert.equal(operations.filter(([name]) => name === 'save').length, 1);
  assert.equal(documents.length, 1);
  await page.unroute('**/admin/settings');
  await page.locator('[data-save-button]').click();
  await waitForSaved(page);
  await verify(page, 'countdown_channelid');
  assert.equal(documents.length, 1);
});

test('repeated submit events while saving send a single POST', async (t) => {
  const { page, origin, operations, documents } = await createSubject(t);
  await page.goto(`${origin}/admin/settings`);
  await edit(page, 'countdown_title', '一度だけ保存');
  await page.evaluate(() => {
    const form = globalThis.document.getElementById('settings-form');
    const submitter = globalThis.document.querySelector('[data-save-button]');
    form.requestSubmit(submitter);
    form.requestSubmit(submitter);
  });
  await waitForSaved(page);
  assert.equal(operations.filter(([name]) => name === 'save').length, 1);
  assert.equal(documents.length, 1);
});
