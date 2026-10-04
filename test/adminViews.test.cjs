const assert = require('node:assert/strict');
const test = require('node:test');
const { renderDashboard, renderSettingsForm } = require('../dist/services/admin/adminViews.js');

const snapshot = {
  overall: 'operational',
  generatedAt: '2026-10-04T15:30:00.000Z',
  services: [
    { name: 'Discord', label: '正常', detail: '接続中', state: 'operational' },
    { name: 'Sesame', label: '停止', detail: '無効化済み', state: 'disabled' },
  ],
  system: { uptimeSeconds: 90061, requestsToday: 1234, startedAt: '2026-10-03T14:29:00.000Z' },
};

test('dashboard distinguishes disabled services from failures and displays readable JST times', () => {
  const html = renderDashboard(snapshot, {});
  assert.match(html, /正常に稼働しています/);
  assert.match(html, /1日 1時間 1分/);
  assert.match(html, /1,234 件/);
  assert.match(html, /2026\/10\/05 00:30:00（日本時間）/);
  assert.match(html, /data-state="disabled"[^>]*>[^]*?無効<\/span>/);
  assert.match(html, /未実行/);
  assert.match(html, /未発行/);
});

test('dashboard explains degraded, offline and unknown states and escapes service and error text', () => {
  for (const [state, message] of [
    ['degraded', '一部のサービスを確認してください'],
    ['offline', '停止中のサービスがあります'],
    ['unknown', '状態を確認できません'],
  ]) {
    assert.ok(renderDashboard({ ...snapshot, overall: state }, {}).includes(message));
  }
  const html = renderDashboard(
    {
      ...snapshot,
      services: [
        {
          name: '<script>alert(1)</script>',
          label: '停止',
          detail: '<img src=x>',
          state: 'offline',
        },
      ],
    },
    { configReloadError: '<script>alert(2)</script>' }
  );
  assert.doesNotMatch(html, /<script>|<img src=x>/);
  assert.match(html, /&lt;script&gt;/);
});

test('invalid fields expose both their help text and server error to assistive technology', () => {
  const html = renderSettingsForm(
    'countdown',
    [
      {
        key: 'countdown_date',
        label: '開催日',
        description: '対象日を入力してください。',
        input: 'date',
        value: '2029-02-29',
        configured: true,
      },
    ],
    'test-csrf',
    { countdown_date: '実在する日を入力してください。' }
  );
  const input = html.match(/<input\s+id="setting-countdown_date"[^>]+>/)?.[0];
  assert.ok(input);
  assert.match(input, /aria-invalid="true"/);
  assert.match(
    input,
    /aria-describedby="setting-description-countdown_date setting-feedback-countdown_date"/
  );
  assert.match(html, /id="setting-description-countdown_date"/);
  assert.match(html, /id="setting-feedback-countdown_date"[^]*?実在する日を入力してください。/);
});
