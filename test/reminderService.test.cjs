const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ReminderService,
  parseJstDateTime,
  tomorrowAtNine,
} = require('../dist/services/reminder/ReminderService.js');

test('parses strict reminder date-times in Asia/Tokyo', () => {
  const now = new Date('2026-08-10T00:00:00.000Z');
  assert.equal(parseJstDateTime('2026-08-11 19:30', now).toISOString(), '2026-08-11T10:30:00.000Z');
  assert.equal(
    parseJstDateTime('２０２６-０８-１１ １９:３０', now).toISOString(),
    '2026-08-11T10:30:00.000Z'
  );
  assert.equal(parseJstDateTime('2026-02-29 10:00', now), undefined);
  assert.equal(parseJstDateTime('2026/08/11 19:30', now), undefined);
  assert.equal(parseJstDateTime('2026-08-10 09:00', now), undefined);
});

test('calculates tomorrow 9:00 in Asia/Tokyo', () => {
  assert.equal(
    tomorrowAtNine(new Date('2026-08-10T14:30:00.000Z')).toISOString(),
    '2026-08-11T00:00:00.000Z'
  );
});

test('delivers a due reminder to a thread and safely expands @全員', async () => {
  const service = new ReminderService({}, 'database-id');
  const calls = [];
  const reminder = {
    pageId: 'page-id',
    name: '確認',
    message: '確認してください @全員',
    scheduledAt: new Date('2026-08-10T01:00:00.000Z'),
    guildId: 'guild-id',
    destinationId: 'thread-id',
    destinationType: 'thread',
    creatorId: 'creator-id',
    mentionRoleId: 'role-id',
    status: 'pending',
    attempts: 0,
  };
  service.repository.findStaleProcessing = async () => [];
  service.repository.findDue = async () => [reminder];
  service.repository.markProcessing = async (...args) => calls.push(['processing', ...args]);
  service.repository.markSent = async (...args) => calls.push(['sent', ...args]);
  service.repository.markDeliveryFailure = async (...args) => calls.push(['failed', ...args]);
  const sends = [];
  const discord = {
    channels: {
      fetch: async () => ({
        isSendable: () => true,
        guild: {
          id: 'guild-id',
          roles: { fetch: async () => ({ id: 'role-id' }) },
        },
        send: async (payload) => {
          sends.push(payload);
          return { id: 'message-id' };
        },
      }),
    },
  };

  await service.dispatchDue(discord, new Date('2026-08-10T01:00:10.000Z'));

  assert.match(sends[0].content, /<@&role-id>/);
  assert.deepEqual(sends[0].allowedMentions, {
    parse: [],
    users: ['creator-id'],
    roles: ['role-id'],
  });
  assert.equal(
    calls.some(([type]) => type === 'sent'),
    true
  );
  assert.equal(
    calls.some(([type]) => type === 'failed'),
    false
  );
});

test('retries a failed delivery without losing the reminder', async () => {
  const service = new ReminderService({}, 'database-id');
  const failures = [];
  const reminder = {
    pageId: 'page-id',
    name: '確認',
    message: '確認',
    scheduledAt: new Date('2026-08-10T01:00:00.000Z'),
    guildId: 'guild-id',
    destinationId: 'missing-channel',
    destinationType: 'channel',
    creatorId: 'creator-id',
    status: 'pending',
    attempts: 0,
  };
  service.repository.findStaleProcessing = async () => [];
  service.repository.findDue = async () => [reminder];
  service.repository.markProcessing = async () => {};
  service.repository.markDeliveryFailure = async (...args) => failures.push(args);

  await service.dispatchDue(
    { channels: { fetch: async () => null } },
    new Date('2026-08-10T01:00:10.000Z')
  );

  assert.equal(failures.length, 1);
  assert.equal(failures[0][3].toISOString(), '2026-08-10T01:01:10.000Z');
});
