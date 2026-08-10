const assert = require('node:assert/strict');
const test = require('node:test');

const {
  handleBreakoutRoomCommand,
} = require('../dist/services/discord/commands/BreakoutRoomCommand.js');

function makeMessage() {
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
      reply: async (reply) => {
        replies.push(reply);
      },
    },
    replies,
  };
}

test('requires explicit confirmation', async () => {
  const { deletedChannels, message, replies } = makeMessage();

  await handleBreakoutRoomCommand(message, ['remove']);

  assert.deepEqual(deletedChannels, []);
  assert.deepEqual(replies, [
    {
      content: 'すべてのブレイクアウトルームを削除するには確認が必要です',
    },
  ]);
});

test('removes breakout rooms after confirmation', async () => {
  const { deletedChannels, message, replies } = makeMessage();

  await handleBreakoutRoomCommand(message, ['remove', 'confirm']);

  assert.deepEqual(deletedChannels, ['BR-1']);
  assert.deepEqual(replies, []);
});
