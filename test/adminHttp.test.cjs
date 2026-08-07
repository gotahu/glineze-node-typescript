const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

globalThis.process.env.ADMIN_ENABLED = 'true';
globalThis.process.env.ADMIN_BASE_URL = 'https://admin.example.com';
globalThis.process.env.ADMIN_AUTH_SECRET =
  'test-only-http-admin-secret-with-more-than-thirty-two-bytes';
globalThis.process.env.ADMIN_NOTION_LOGIN_BLOCK_ID = 'test-login-block';
globalThis.process.env.SESAME_ENABLED = 'true';
globalThis.process.env.NOTION_AUTOMATION_ENABLED = 'false';
globalThis.process.env.PORT = '0';

const { ConfigService } = require('../dist/config/service.js');
const { ConfigStore } = require('../dist/config/store.js');
const { AdminConsoleService } = require('../dist/services/admin/adminConsoleService.js');
const { AdminLoginTokenService } = require('../dist/services/admin/adminLoginTokenService.js');
const { WebServerService } = require('../dist/services/webapi/webServerService.js');

function createSubject() {
  const updates = [];
  const channelFetches = [];
  const store = new ConfigStore();
  const values = {
    countdown_title: '定期演奏会',
    countdown_date: '2028-02-29',
    countdown_channelid: '123456789012345678',
    countdown_notify_days: '30,7,1,0',
    countdown_message: 'お知らせ',
    practice_remind_threadid: '234567890123456789',
    bashotori_remind_threadid: '345678901234567890',
    discord_general_channelid: '456789012345678901',
    practice_announcement_template_page_id: '0123456789abcdef0123456789abcdef',
    sesame_app_api_url: 'https://example.com',
    sesame_app_api_key: 'stored-secret-must-never-appear',
    sesame_device_uuid: 'device-uuid',
    sesame_device_publickey: 'stored-public-key-must-never-appear',
    sesame_message_when_locked: '施錠中',
    sesame_message_when_unlocked: '解錠中',
    sesame_message_when_loading: '取得中',
  };
  for (const [key, value] of Object.entries(values)) store.values.set(key, value);
  const repository = {
    pages: new Map(),
    load: async () => ({ values: new Map(store.values), pages: new Map() }),
    update: async (key, value) => updates.push([key, value]),
  };
  const configs = new ConfigService(repository, store);
  const tokenService = new AdminLoginTokenService(
    globalThis.process.env.ADMIN_AUTH_SECRET,
    60 * 60 * 1_000
  );
  const loginLinks = {
    getStatus: () => ({ expiresAt: new Date('2026-08-09T00:00:00.000Z') }),
    rotate: async () => undefined,
  };
  const consoleService = new AdminConsoleService(
    configs,
    {
      notion: {
        practiceTemplateService: {
          getStatus: () => ({ source: 'builtin', updated: false, message: '組み込み' }),
          getTemplatePreview: () => 'preview {{dateLabel}}',
          reload: async () => ({ source: 'builtin', updated: true, message: '再読込済み' }),
        },
      },
      discord: {
        client: {
          isReady: () => true,
          channels: {
            fetch: async (id) => {
              channelFetches.push(id);
              return {
                name: 'verified-channel',
                isSendable: () => true,
                isThread: () => false,
              };
            },
          },
        },
      },
      sesame: { reloadConfiguration: () => undefined },
    },
    loginLinks
  );
  const services = {
    notion: {},
    discord: {
      client: { isReady: () => true },
      stats: {
        dailyMessages: new Map(),
        dailyReactions: new Map(),
        popularEmojis: new Map(),
      },
    },
  };
  const webServer = new WebServerService(services, {
    admin: {
      tokenService,
      consoleService,
      loginLinks,
      sessionSecret: globalThis.process.env.ADMIN_AUTH_SECRET,
      sessionTtlMs: 60 * 60 * 1_000,
    },
  });
  return { webServer, tokenService, updates, store, channelFetches };
}

async function authenticate(origin, tokenService) {
  const issued = await tokenService.issue();
  const response = await globalThis.fetch(
    `${origin}/admin/login?token=${encodeURIComponent(issued.token)}`,
    {
      redirect: 'manual',
      headers: { 'x-forwarded-proto': 'https' },
    }
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/admin');
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /__Host-glineze-admin=/);
  assert.match(setCookie, /Path=\//i);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const expires = setCookie.match(/Expires=([^;]+)/i);
  assert.ok(expires, 'session cookie should have an expiry');
  const remainingTtl = Date.parse(expires[1]) - Date.now();
  assert.ok(remainingTtl > 59 * 60 * 1_000 && remainingTtl <= 60 * 60 * 1_000);
  return setCookie.split(';', 1)[0];
}

function extractCsrf(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(match, 'CSRF token should be rendered');
  return match[1];
}

test('protects admin pages and exchanges a clean login URL for a secure session', async (t) => {
  const { webServer, tokenService } = createSubject();
  t.after(async () => webServer.stop());
  if (!webServer.server.listening) await once(webServer.server, 'listening');
  const address = webServer.server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const unauthorized = await globalThis.fetch(`${origin}/admin`);
  assert.equal(unauthorized.status, 401);
  assert.match(await unauthorized.text(), /Notion ページ/);

  const invalid = await globalThis.fetch(`${origin}/admin/login?token=invalid-token`, {
    redirect: 'manual',
  });
  assert.equal(invalid.status, 401);
  assert.match(await invalid.text(), /Notion ページ/);

  const cookie = await authenticate(origin, tokenService);
  const dashboard = await globalThis.fetch(`${origin}/admin`, { headers: { cookie } });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.headers.get('cache-control'), 'no-store');
  assert.equal(dashboard.headers.get('referrer-policy'), 'no-referrer');
  assert.match(dashboard.headers.get('content-security-policy'), /script-src 'self'/);
  const dashboardHtml = await dashboard.text();
  assert.match(dashboardHtml, /稼働状況/);
  assert.match(dashboardHtml, /src="\/admin\/assets\/admin\.js" defer/);
  assert.match(dashboardHtml, /href="\/admin\/settings"/);
  assert.doesNotMatch(dashboardHtml, /href="\/admin\/settings\/countdown"/);

  const clientScript = await globalThis.fetch(`${origin}/admin/assets/admin.js`);
  assert.equal(clientScript.status, 200);
  assert.match(clientScript.headers.get('content-type'), /javascript/);
  const clientScriptText = await clientScript.text();
  assert.doesNotThrow(() => new Function(clientScriptText));
  assert.match(clientScriptText, /addEventListener\('submit'/);
  assert.match(clientScriptText, /const scrollPosition = window\.scrollY/);
  assert.match(clientScriptText, /function restoreScrollPosition\(scrollPosition\)/);
  assert.match(clientScriptText, /root\.style\.scrollBehavior = 'auto'/);
  assert.match(clientScriptText, /window\.requestAnimationFrame/);

  const adminStyles = await globalThis.fetch(`${origin}/admin/assets/admin.css`);
  assert.equal(adminStyles.status, 200);
  assert.match(adminStyles.headers.get('content-type'), /css/);
  assert.match(await adminStyles.text(), /\.save-dock/);

  const getAction = await globalThis.fetch(`${origin}/admin/actions/reload-config`, {
    headers: { cookie },
  });
  assert.equal(getAction.status, 404);

  const csrf = extractCsrf(dashboardHtml);
  const logout = await globalThis.fetch(`${origin}/admin/logout`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new globalThis.URLSearchParams({ _csrf: csrf }),
  });
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get('clear-site-data'), /cookies/);
  const afterLogout = await globalThis.fetch(`${origin}/admin`, { headers: { cookie } });
  assert.equal(afterLogout.status, 401);
});

test('requires CSRF for changes and updates only authenticated category settings', async (t) => {
  const { webServer, tokenService, updates } = createSubject();
  t.after(async () => webServer.stop());
  if (!webServer.server.listening) await once(webServer.server, 'listening');
  const address = webServer.server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const cookie = await authenticate(origin, tokenService);

  const rejected = await globalThis.fetch(`${origin}/admin/settings/countdown`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'countdown_title=CSRFなし',
  });
  assert.equal(rejected.status, 403);
  assert.deepEqual(updates, []);

  const formPage = await globalThis.fetch(`${origin}/admin/settings/countdown`, {
    headers: { cookie },
  });
  const csrf = extractCsrf(await formPage.text());
  const saved = await globalThis.fetch(`${origin}/admin/settings/countdown`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new globalThis.URLSearchParams({
      _csrf: csrf,
      countdown_title: '新しい演奏会',
      countdown_date: '2029-03-01',
    }),
  });
  assert.equal(saved.status, 303);
  assert.equal(saved.headers.get('location'), '/admin/settings?result=saved#countdown');
  assert.deepEqual(updates, [
    ['countdown_title', '新しい演奏会'],
    ['countdown_date', '2029-03-01'],
  ]);

  const invalidPage = await globalThis.fetch(`${origin}/admin/settings/countdown`, {
    headers: { cookie },
  });
  const invalidCsrf = extractCsrf(await invalidPage.text());
  const invalid = await globalThis.fetch(`${origin}/admin/settings/countdown`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new globalThis.URLSearchParams({
      _csrf: invalidCsrf,
      countdown_date: '2029-02-29',
    }),
  });
  assert.equal(invalid.status, 400);
  const invalidHtml = await invalid.text();
  assert.match(invalidHtml, /実在する日/);
  assert.match(invalidHtml, /value="2029-02-29"/);

  const oversized = await globalThis.fetch(`${origin}/admin/settings/countdown`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: `countdown_message=${'x'.repeat(70 * 1_024)}`,
  });
  assert.equal(oversized.status, 413);
});

test('shows every setting on one page and verifies a channel ID through Discord', async (t) => {
  const { webServer, tokenService, channelFetches, updates } = createSubject();
  t.after(async () => webServer.stop());
  if (!webServer.server.listening) await once(webServer.server, 'listening');
  const address = webServer.server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const cookie = await authenticate(origin, tokenService);

  const page = await globalThis.fetch(`${origin}/admin/settings`, { headers: { cookie } });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /id="practice"/);
  assert.match(html, /練習連絡の送信先/);
  assert.match(html, /練習連絡テンプレートページ/);
  assert.match(html, /id="countdown"/);
  assert.match(html, /id="advanced"/);
  assert.match(html, /id="settings-form"/);
  assert.match(html, /未保存の変更があります/);
  assert.match(html, /data-save-dock hidden/);

  const csrf = extractCsrf(html);
  const verified = await globalThis.fetch(`${origin}/admin/actions/verify-channel`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new globalThis.URLSearchParams({
      _csrf: csrf,
      _verify: 'practice_remind_threadid',
      practice_remind_threadid: '234567890123456789',
    }),
  });
  assert.equal(verified.status, 200);
  const verifiedHtml = await verified.text();
  assert.match(verifiedHtml, /確認できました: #verified-channel/);
  assert.deepEqual(channelFetches, ['234567890123456789']);

  const saveCsrf = extractCsrf(verifiedHtml);
  const saved = await globalThis.fetch(`${origin}/admin/settings`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new globalThis.URLSearchParams({
      _csrf: saveCsrf,
      countdown_title: '秋の演奏会',
      practice_remind_threadid: '234567890123456789',
    }),
  });
  assert.equal(saved.status, 303);
  assert.equal(saved.headers.get('location'), '/admin/settings?result=saved');
  assert.deepEqual(updates, [
    ['countdown_title', '秋の演奏会'],
    ['practice_remind_threadid', '234567890123456789'],
  ]);
});

test('escapes settings and never emits stored secrets into admin HTML', async (t) => {
  const { webServer, tokenService, store } = createSubject();
  t.after(async () => webServer.stop());
  if (!webServer.server.listening) await once(webServer.server, 'listening');
  const address = webServer.server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const cookie = await authenticate(origin, tokenService);

  const response = await globalThis.fetch(`${origin}/admin/settings/sesame`, {
    headers: { cookie },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(html.includes('stored-secret-must-never-appear'), false);
  assert.equal(html.includes('stored-public-key-must-never-appear'), false);
  assert.match(html, /設定済み/);

  store.values.set('countdown_title', '<script>alert("xss")</script>');
  const countdown = await globalThis.fetch(`${origin}/admin/settings/countdown`, {
    headers: { cookie },
  });
  const countdownHtml = await countdown.text();
  assert.equal(countdownHtml.includes('<script>alert("xss")</script>'), false);
  assert.match(countdownHtml, /&lt;script&gt;/);
});
