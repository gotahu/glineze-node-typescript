const assert = require('node:assert/strict');
const test = require('node:test');

const { removeThreadMembers } = require('../dist/services/discord/threadMember.js');

test('starts all thread member removals concurrently and includes partial members', async () => {
  const started = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const thread = {
    members: {
      remove: async (id) => {
        started.push(id);
        await gate;
      },
    },
  };
  const members = new Map([
    ['member-1', { id: 'member-1', partial: false, user: { displayName: 'One' } }],
    ['member-2', { id: 'member-2', partial: true }],
    ['member-3', { id: 'member-3', partial: false, user: { displayName: 'Three' } }],
  ]);

  const removal = removeThreadMembers(thread, members);
  await new Promise((resolve) => globalThis.setImmediate(resolve));

  assert.deepEqual(started.sort(), ['member-1', 'member-2', 'member-3']);
  release();
  await removal;
});
