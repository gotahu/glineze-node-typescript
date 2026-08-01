const assert = require('node:assert/strict');
const test = require('node:test');

const { Collection, PermissionFlagsBits } = require('discord.js');
const { handleCommand } = require('../dist/services/discord/commands/index.js');

function makeMessage(canMoveMembers) {
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
  const member = {
    id: 'caller',
    permissions: {
      has: (permission) => {
        assert.equal(permission, PermissionFlagsBits.MoveMembers);
        return canMoveMembers;
      },
    },
  };
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

async function runCommand(message, content) {
  message.content = content;
  assert.equal(await handleCommand(message, {}), true);
}

test('rejects random breakout moves from a member without move-members permission', async () => {
  const { message, moves, replies } = makeMessage(false);

  await runCommand(message, '!br random confirm');

  assert.deepEqual(moves, []);
  assert.deepEqual(replies, ['この操作には「メンバーを移動」権限が必要です']);
});

test('requires exact confirmation from a member authorized to move members', async () => {
  for (const command of ['!br random', '!br random Confirm', '!br random confirm extra']) {
    const { message, moves, replies } = makeMessage(true);

    await runCommand(message, command);

    assert.deepEqual(moves, []);
    assert.deepEqual(replies, ['メンバーを移動するには `!br random confirm` を実行してください']);
  }
});

test('preserves confirmed random breakout moves for an authorized member', async () => {
  const { message, moves, replies } = makeMessage(true);

  await runCommand(message, '!br random confirm');

  assert.deepEqual(
    moves.toSorted(),
    [
      ['member-1', 'breakout-room'],
      ['member-2', 'breakout-room'],
    ].toSorted()
  );
  assert.deepEqual(replies, ['メンバーをランダムにブレイクアウトルームに分配しました']);
});
