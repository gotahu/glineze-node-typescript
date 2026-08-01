const assert = require('node:assert/strict');
const test = require('node:test');

const { PermissionFlagsBits } = require('discord.js');
const { handleCommand } = require('../dist/services/discord/commands/index.js');
const { handleSlashCommand } = require('../dist/services/discord/slashCommands.js');

test('message and slash adapters execute the same version command', async (t) => {
  const originalVersion = globalThis.process.env.npm_package_version;
  globalThis.process.env.npm_package_version = '9.9.9';
  t.after(() => {
    if (originalVersion === undefined) delete globalThis.process.env.npm_package_version;
    else globalThis.process.env.npm_package_version = originalVersion;
  });
  const messageReplies = [];
  const slashReplies = [];

  await handleCommand(
    {
      content: '!version',
      channelId: 'channel-1',
      guild: null,
      member: null,
      reply: async (content) => messageReplies.push(content),
    },
    {}
  );
  await handleSlashCommand(
    {
      commandName: 'version',
      options: { getSubcommand: () => null },
      deferReply: async () => {},
      inGuild: () => false,
      guild: null,
      user: { id: 'user-1' },
      channelId: 'channel-1',
      memberPermissions: null,
      editReply: async (content) => slashReplies.push(content),
    },
    {}
  );

  assert.deepEqual(messageReplies, ['v9.9.9']);
  assert.deepEqual(slashReplies, ['v9.9.9']);
});

test('slash breakout command uses operations without constructing a Message', async () => {
  const deleted = [];
  const replies = [];
  const breakoutChannel = {
    name: 'BR-1',
    delete: async () => deleted.push('BR-1'),
  };
  const interaction = {
    commandName: 'breakout',
    options: {
      getSubcommand: () => 'remove',
      getBoolean: () => true,
    },
    deferReply: async () => {},
    inGuild: () => true,
    guild: {
      channels: { cache: new Map([['breakout', breakoutChannel]]) },
      members: { cache: new Map([['user-1', { id: 'user-1' }]]) },
    },
    user: { id: 'user-1' },
    channelId: 'channel-1',
    memberPermissions: {
      has: (permission) => permission === PermissionFlagsBits.ManageChannels,
    },
    editReply: async (content) => replies.push(content),
  };

  await handleSlashCommand(interaction, {});

  assert.deepEqual(deleted, ['BR-1']);
  assert.deepEqual(replies, ['コマンドを実行しました。']);
});
