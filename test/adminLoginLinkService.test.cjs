const assert = require('node:assert/strict');
const test = require('node:test');

const { AdminLoginLinkService } = require('../dist/services/admin/adminLoginLinkService.js');
const { logger } = require('../dist/utils/logger.js');

test('updates a supported Notion block without logging the issued login token', async (t) => {
  const updates = [];
  const logs = [];
  const originalInfo = logger.info;
  logger.info = async (message) => logs.push(message);
  t.after(() => {
    logger.info = originalInfo;
  });
  const issuedAt = new Date('2026-08-07T00:00:00.000Z');
  const expiresAt = new Date('2026-08-09T00:00:00.000Z');
  const notion = {
    blocks: {
      retrieve: async () => ({ type: 'paragraph', paragraph: { rich_text: [] } }),
      update: async (request) => updates.push(request),
    },
  };
  const service = new AdminLoginLinkService(
    notion,
    { issue: async () => ({ token: 'test-token-redacted', issuedAt, expiresAt }) },
    'login-block',
    'https://example.com'
  );

  const result = await service.rotate();
  assert.equal(result.expiresAt, expiresAt);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].block_id, 'login-block');
  const link = updates[0].paragraph.rich_text[0];
  assert.equal(link.text.content, 'Glineze 管理画面を開く');
  assert.equal(link.text.link.url, 'https://example.com/admin/login?token=test-token-redacted');
  assert.equal(service.getStatus().expiresAt, expiresAt);
  assert.equal(service.getStatus().error, undefined);
  assert.equal(logs.join('\n').includes('test-token-redacted'), false);
});

test('does not overwrite the block when token issuance or block validation fails', async () => {
  let updates = 0;
  const notion = {
    blocks: {
      retrieve: async () => ({ type: 'heading_1', heading_1: { rich_text: [] } }),
      update: async () => updates++,
    },
  };
  const service = new AdminLoginLinkService(
    notion,
    {
      issue: async () => ({
        token: 'unused',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
    'login-block',
    'https://example.com'
  );

  await assert.rejects(service.rotate(), /paragraph または callout/);
  assert.equal(updates, 0);
  assert.match(service.getStatus().error, /paragraph または callout/);

  let requests = 0;
  const issuanceFailure = new AdminLoginLinkService(
    {
      blocks: {
        retrieve: async () => {
          requests++;
        },
        update: async () => {
          requests++;
        },
      },
    },
    { issue: async () => Promise.reject(new Error('issuer unavailable')) },
    'login-block',
    'https://example.com'
  );
  await assert.rejects(issuanceFailure.rotate(), /issuer unavailable/);
  assert.equal(requests, 0);
  assert.equal(
    issuanceFailure.getStatus().error,
    'Notion のログインリンクを更新できませんでした。'
  );
});
