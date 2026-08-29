const assert = require('node:assert/strict');
const test = require('node:test');
const { Collection } = require('discord.js');

const {
  handleAllMembersRoleForNewMember,
  synchronizeAllMembersRole,
} = require('../dist/services/discord/allMembersRole.js');

function collection(entries) {
  return new Collection(entries);
}

function createMember(id, roleIds = []) {
  const addedRoles = [];
  return {
    id,
    user: { tag: `${id}#0001` },
    roles: {
      cache: collection(roleIds.map((roleId) => [roleId, { id: roleId }])),
      add: async (role) => {
        addedRoles.push(role.id);
      },
    },
    addedRoles,
  };
}

test('adds the unique 全員 role to a newly joined member', async () => {
  const role = { id: 'all-role', name: '全員' };
  const member = createMember('new-member');
  member.guild = {
    name: 'テストサーバー',
    roles: {
      cache: collection([[role.id, role]]),
      fetch: async () => collection([[role.id, role]]),
    },
  };

  await handleAllMembersRoleForNewMember(member);

  assert.deepEqual(member.addedRoles, ['all-role']);
});

test('daily sync only adds members missing the 全員 role', async () => {
  const role = { id: 'all-role', name: '全員' };
  const existing = createMember('existing', [role.id]);
  const missingOne = createMember('missing-1');
  const missingTwo = createMember('missing-2');
  const guild = {
    name: 'テストサーバー',
    roles: {
      fetch: async () => collection([[role.id, role]]),
    },
    members: {
      fetch: async () =>
        collection([
          [existing.id, existing],
          [missingOne.id, missingOne],
          [missingTwo.id, missingTwo],
        ]),
    },
  };
  const client = { guilds: { cache: collection([['guild', guild]]) } };

  const result = await synchronizeAllMembersRole(client);

  assert.deepEqual(existing.addedRoles, []);
  assert.deepEqual(missingOne.addedRoles, ['all-role']);
  assert.deepEqual(missingTwo.addedRoles, ['all-role']);
  assert.deepEqual(result, {
    guildCount: 1,
    memberCount: 3,
    addedCount: 2,
    failedCount: 0,
  });
});

test('does not choose arbitrarily when multiple 全員 roles exist', async () => {
  const member = createMember('member');
  const guild = {
    name: 'テストサーバー',
    roles: {
      fetch: async () =>
        collection([
          ['role-1', { id: 'role-1', name: '全員' }],
          ['role-2', { id: 'role-2', name: '全員' }],
        ]),
    },
    members: {
      fetch: async () => collection([[member.id, member]]),
    },
  };
  const client = { guilds: { cache: collection([['guild', guild]]) } };

  const result = await synchronizeAllMembersRole(client);

  assert.deepEqual(member.addedRoles, []);
  assert.equal(result.addedCount, 0);
});
