const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AdminLoginTokenService,
  InvalidAdminLoginTokenError,
} = require('../dist/services/admin/adminLoginTokenService.js');

const TEST_ONLY_SECRET = 'test-only-admin-secret-with-more-than-thirty-two-bytes';

test('issues and verifies a purpose-bound expiring admin login token', async () => {
  const now = new Date('2026-08-07T00:00:00.000Z');
  const service = new AdminLoginTokenService(TEST_ONLY_SECRET, 60_000, () => now);

  const issued = await service.issue();
  const payload = await service.verify(issued.token);

  assert.equal(issued.issuedAt.toISOString(), '2026-08-07T00:00:00.000Z');
  assert.equal(issued.expiresAt.toISOString(), '2026-08-07T00:01:00.000Z');
  assert.equal(payload.kind, 'glineze-admin-login');
  assert.equal(payload.expiresAt, issued.expiresAt.getTime());
  assert.equal(typeof payload.nonce, 'string');
});

test('rejects a tampered or expired token with the same public error', async () => {
  let now = new Date('2026-08-07T00:00:00.000Z');
  const service = new AdminLoginTokenService(TEST_ONLY_SECRET, 60_000, () => now);
  const issued = await service.issue();

  await assert.rejects(service.verify(`${issued.token}tampered`), InvalidAdminLoginTokenError);
  now = new Date('2026-08-07T00:02:00.000Z');
  await assert.rejects(service.verify(issued.token), InvalidAdminLoginTokenError);
});

test('requires a high-entropy-sized secret and a positive lifetime', () => {
  assert.throws(() => new AdminLoginTokenService('short', 60_000), /32 byte/);
  assert.throws(() => new AdminLoginTokenService(TEST_ONLY_SECRET, 0), /有効期間/);
});
