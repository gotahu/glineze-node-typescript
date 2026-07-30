const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const test = require('node:test');
const { NotionWebhookSecurity } = require('../dist/services/webapi/notionWebhookSecurity.js');

const token = 'test-verification-token';
const body = Buffer.from('{"source":{"event_id":"event-1"}}');

function createSecurity(overrides = {}) {
  return new NotionWebhookSecurity({
    verificationToken: token,
    allowedAutomationIds: ['automation-1'],
    allowedActionIds: ['action-1'],
    allowedDatabaseIds: ['database-1'],
    ...overrides,
  });
}

function event(overrides = {}) {
  return {
    source: {
      type: 'automation',
      automation_id: 'automation-1',
      action_id: 'action-1',
      event_id: 'event-1',
      attempt: 1,
      ...overrides,
    },
    data: {},
  };
}

test('requires a valid HMAC over the exact raw request body', () => {
  const security = createSecurity();
  const validSignature = `sha256=${createHmac('sha256', token).update(body).digest('hex')}`;

  assert.equal(security.verifySignature(body, undefined), false);
  assert.equal(security.verifySignature(body, 'sha256=invalid'), false);
  assert.equal(security.verifySignature(Buffer.from(`${body} `), validSignature), false);
  assert.equal(security.verifySignature(body, validSignature), true);
});

test('allows only configured automation and action identifiers', () => {
  const security = createSecurity();

  assert.equal(security.reserveEvent(event({ automation_id: 'other' })), 'unsupported_source');
  assert.equal(security.reserveEvent(event({ action_id: 'other' })), 'unsupported_source');
  assert.equal(security.reserveEvent(event({ event_id: '' })), 'unsupported_source');
  assert.equal(security.reserveEvent(event()), 'accepted');
});

test('rejects replayed event IDs and permits a retry after processing failure', () => {
  const security = createSecurity();

  assert.equal(security.reserveEvent(event()), 'accepted');
  assert.equal(security.reserveEvent(event()), 'replay');
  security.releaseEvent('event-1');
  assert.equal(security.reserveEvent(event()), 'accepted');
});

test('expires replay reservations after the configured window', () => {
  let now = 1_000;
  const security = createSecurity({ replayTtlMs: 500, now: () => now });

  assert.equal(security.reserveEvent(event()), 'accepted');
  now = 1_499;
  assert.equal(security.reserveEvent(event()), 'replay');
  now = 1_500;
  assert.equal(security.reserveEvent(event()), 'accepted');
});

test('allows only configured authoritative database identifiers', () => {
  const security = createSecurity();

  assert.equal(security.isAllowedDatabase('database-1'), true);
  assert.equal(security.isAllowedDatabase('database-2'), false);
});
