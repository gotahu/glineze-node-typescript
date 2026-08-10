const assert = require('node:assert/strict');
const test = require('node:test');

const {
  handleDeleteChannelCommand,
} = require('../dist/services/discord/commands/DeleteChannelCommand.js');

function makeMessage() {
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
      guild: { channels: { cache: new Map([['target-channel', channel]]) } },
      reply: async (reply) => {
        replies.push(reply);
      },
    },
    replies,
  };
}

test('requires explicit confirmation', async () => {
  const { deletedChannels, message, replies } = makeMessage();

  await handleDeleteChannelCommand(message, ['target-channel']);

  assert.deepEqual(deletedChannels, []);
  assert.deepEqual(replies, ['チャンネルを削除するには確認が必要です']);
});

test('deletes the channel after confirmation', async () => {
  const { deletedChannels, message, replies } = makeMessage();

  await handleDeleteChannelCommand(message, ['target-channel', 'confirm']);

  assert.deepEqual(deletedChannels, ['target-channel']);
  assert.deepEqual(replies, ['チャンネルを削除しました']);
});
