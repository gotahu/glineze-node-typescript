const assert = require('node:assert/strict');
const test = require('node:test');

const { PermissionFlagsBits } = require('discord.js');
const {
  handleBreakoutRoomCommand,
} = require('../dist/services/discord/commands/BreakoutRoomCommand.js');

function makeMessage(canManageChannels) {
  const deletedChannels = [];
  const replies = [];
  const channels = new Map([
    [
      'breakout-room',
      {
        name: 'BR-1',
        delete: async () => {
          deletedChannels.push('BR-1');
        },
      },
    ],
    [
      'general',
      {
        name: 'general',
        delete: async () => {
          deletedChannels.push('general');
        },
      },
    ],
  ]);

  return {
    deletedChannels,
    message: {
      guild: { channels: { cache: channels } },
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

test('rejects breakout-room removal from a member without channel-management permission', async () => {
  const { deletedChannels, message, replies } = makeMessage(false);

  await handleBreakoutRoomCommand(message, ['remove', 'confirm']);

  assert.deepEqual(deletedChannels, []);
  assert.deepEqual(replies, [{ content: 'この操作には「チャンネルの管理」権限が必要です' }]);
});

test('requires explicit confirmation from an authorized member', async () => {
  const { deletedChannels, message, replies } = makeMessage(true);

  await handleBreakoutRoomCommand(message, ['remove']);

  assert.deepEqual(deletedChannels, []);
  assert.deepEqual(replies, [
    {
      content: '全てのブレイクアウトルームを削除するには `!br remove confirm` を実行してください',
    },
  ]);
});

test('preserves confirmed breakout-room removal for an authorized member', async () => {
  const { deletedChannels, message, replies } = makeMessage(true);

  await handleBreakoutRoomCommand(message, ['remove', 'confirm']);

  assert.deepEqual(deletedChannels, ['BR-1']);
  assert.deepEqual(replies, []);
});
