const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const envModule = path.resolve(globalThis.process.cwd(), 'dist/env.js');

function evaluateEnv(overrides) {
  const childEnv = {
    PATH: globalThis.process.env.PATH,
    NODE_ENV: 'test',
    DISCORD_BOT_TOKEN: 'test-only-token',
    DISCORD_RELAY_WEBHOOK: 'https://example.com/webhook',
    NOTION_TOKEN: 'test-only-notion-token',
    NOTION_CONFIGURATION_DATABASEID: 'test-database-id',
    SESAME_ENABLED: 'false',
    NOTION_AUTOMATION_ENABLED: 'false',
    ADMIN_ENABLED: 'false',
    ...overrides,
  };
  return spawnSync(globalThis.process.execPath, ['-e', `require(${JSON.stringify(envModule)})`], {
    cwd: '/tmp',
    env: childEnv,
    encoding: 'utf8',
  });
}

test('keeps the admin console disabled without requiring admin credentials', () => {
  const result = evaluateEnv({ ADMIN_ENABLED: 'false' });
  assert.equal(result.status, 0, result.stderr);
});

test('requires complete HTTPS admin configuration only when enabled', () => {
  const missing = evaluateEnv({ ADMIN_ENABLED: 'true' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /ADMIN_BASE_URL/);

  const insecure = evaluateEnv({
    ADMIN_ENABLED: 'true',
    ADMIN_BASE_URL: 'http://admin.example.com',
    ADMIN_AUTH_SECRET: 'test-only-admin-secret-with-more-than-thirty-two-bytes',
    ADMIN_NOTION_LOGIN_BLOCK_ID: 'test-login-block',
  });
  assert.equal(insecure.status, 1);
  assert.match(insecure.stderr, /HTTPS/);

  const valid = evaluateEnv({
    ADMIN_ENABLED: 'true',
    ADMIN_BASE_URL: 'https://admin.example.com',
    ADMIN_AUTH_SECRET: 'test-only-admin-secret-with-more-than-thirty-two-bytes',
    ADMIN_NOTION_LOGIN_BLOCK_ID: 'test-login-block',
  });
  assert.equal(valid.status, 0, valid.stderr);
});
