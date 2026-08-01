const assert = require('node:assert/strict');
const test = require('node:test');

const { PermissionFlagsBits } = require('discord.js');
const { handleCommand } = require('../dist/services/discord/commands/index.js');

function makeMessage(canManageChannels) {
  const deletedChannels = [];
  const replies = [];
  const channel = {
    delete: async () => {
      deletedChannels.push('target-channel');
    },
  };

  return {
    deletedChannels,
    message: {
      content: '!deletechannel target-channel confirm',
      guild: { channels: { cache: new Map([['target-channel', channel]]) } },
      member: {
        permissions: {
          has: (permission) => {
            assert.equal(permission, PermissionFlagsBits.ManageChannels);
            return canManageChannels;
          },
        },
      },
      reply: async (reply) => {
        replies.push(reply);
      },
    },
    replies,
  };
}

test('rejects channel deletion from a member without channel-management permission', async () => {
  const { deletedChannels, message, replies } = makeMessage(false);

  await handleCommand(message, {});

  assert.deepEqual(deletedChannels, []);
  assert.deepEqual(replies, ['この操作には「チャンネルの管理」権限が必要です']);
});

test('requires explicit confirmation from an authorized member', async () => {
  const { deletedChannels, message, replies } = makeMessage(true);
  message.content = '!deletechannel target-channel';

  await handleCommand(message, {});

  assert.deepEqual(deletedChannels, []);
  assert.deepEqual(replies, [
    'チャンネルを削除するには `!deletechannel target-channel confirm` を実行してください',
  ]);
});

test('preserves confirmed channel deletion for an authorized member', async () => {
  const { deletedChannels, message, replies } = makeMessage(true);

  await handleCommand(message, {});

  assert.deepEqual(deletedChannels, ['target-channel']);
  assert.deepEqual(replies, ['チャンネルを削除しました']);
});
