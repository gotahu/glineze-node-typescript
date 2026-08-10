const assert = require('node:assert/strict');
const test = require('node:test');

const { Collection } = require('discord.js');
const {
  handleBreakoutRoomCommand,
} = require('../dist/services/discord/commands/BreakoutRoomCommand.js');

function makeMessage() {
  const moves = [];
  const replies = [];
  const breakoutRoom = {
    id: 'breakout-room',
    name: 'BR-1',
    isVoiceBased: () => true,
  };
  const voiceMembers = new Collection([
    [
      'member-1',
      {
        displayName: 'Member One',
        voice: {
          setChannel: async (channel) => {
            moves.push(['member-1', channel.id]);
          },
        },
      },
    ],
    [
      'member-2',
      {
        displayName: 'Member Two',
        voice: {
          setChannel: async (channel) => {
            moves.push(['member-2', channel.id]);
          },
        },
      },
    ],
  ]);
  const voiceChannel = { members: voiceMembers };
  const member = { id: 'caller' };
  const channels = new Collection([['breakout-room', breakoutRoom]]);

  return {
    message: {
      guild: {
        channels: { cache: channels },
        voiceStates: { cache: new Map([['caller', { channel: voiceChannel }]]) },
      },
      member,
      reply: async (reply) => {
        replies.push(reply);
      },
    },
    moves,
    replies,
  };
}

test('requires exact confirmation before moving members', async () => {
  for (const args of [['random'], ['random', 'Confirm'], ['random', 'confirm', 'extra']]) {
    const { message, moves, replies } = makeMessage();

    await handleBreakoutRoomCommand(message, args);

    assert.deepEqual(moves, []);
    assert.deepEqual(replies, [{ content: 'メンバーを移動するには確認が必要です' }]);
  }
});

test('moves members after confirmation', async () => {
  const { message, moves, replies } = makeMessage();

  await handleBreakoutRoomCommand(message, ['random', 'confirm']);

  assert.deepEqual(
    moves.toSorted(),
    [
      ['member-1', 'breakout-room'],
      ['member-2', 'breakout-room'],
    ].toSorted()
  );
  assert.deepEqual(replies, ['メンバーをランダムにブレイクアウトルームに分配しました']);
});
