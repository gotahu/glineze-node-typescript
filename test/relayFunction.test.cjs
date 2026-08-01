const assert = require('node:assert/strict');
const test = require('node:test');

const { ChannelType, Collection } = require('discord.js');
const { env } = require('../dist/env.js');
const { logger } = require('../dist/utils/logger.js');
const { relayMessage } = require('../dist/features/relay/RelayFunction.js');

test('does not fetch a guild list when DISCORD_VOID_GUILD_ID is missing', async (t) => {
  const originalGuildId = env.DISCORD_VOID_GUILD_ID;
  const originalLoggerError = logger.error;
  t.after(() => {
    env.DISCORD_VOID_GUILD_ID = originalGuildId;
    logger.error = originalLoggerError;
  });

  env.DISCORD_VOID_GUILD_ID = '';
  logger.error = async () => {};

  let fetchCalled = false;
  const message = {
    client: {
      guilds: {
        fetch: async () => {
          fetchCalled = true;
          return new Collection();
        },
      },
    },
    content: 'hello',
    author: {},
  };

  await relayMessage(message);

  assert.equal(fetchCalled, false);
});

test('awaits fetched channels before creating a relay parent channel', async (t) => {
  const originalGuildId = env.DISCORD_VOID_GUILD_ID;
  t.after(() => {
    env.DISCORD_VOID_GUILD_ID = originalGuildId;
  });

  const relayGuildId = '123456789012345678';
  env.DISCORD_VOID_GUILD_ID = relayGuildId;

  let createCalled = false;
  let sentContent;
  const webhook = {
    token: 'token',
    send: async (options) => {
      sentContent = options.content;
    },
  };
  const parentChannel = {
    id: 'parent-channel',
    name: 'source-guild',
    type: ChannelType.GuildText,
    threads: {
      cache: new Collection(),
      create: async ({ name }) => ({
        id: 'thread-channel',
        name,
        parent: parentChannel,
        members: { add: async () => {} },
      }),
    },
    fetchWebhooks: async () => new Collection([['webhook', webhook]]),
  };
  const relayGuild = {
    channels: {
      cache: new Collection(),
      fetch: async () => new Collection([[parentChannel.id, parentChannel]]),
      create: async () => {
        createCalled = true;
        return parentChannel;
      },
    },
    members: {
      fetch: async () => new Collection(),
    },
  };
  const message = {
    client: {
      guilds: {
        fetch: async (options) => {
          assert.deepEqual(options, { guild: relayGuildId });
          return relayGuild;
        },
      },
    },
    guild: { name: 'Source Guild' },
    channel: {
      isDMBased: () => false,
      isThread: () => false,
      name: 'general',
    },
    content: 'relay me',
    author: {
      globalName: null,
      username: 'member',
      displayAvatarURL: () => 'https://example.com/avatar.png',
    },
    attachments: new Collection(),
  };

  await relayMessage(message);

  assert.equal(createCalled, false);
  assert.equal(sentContent, 'relay me');
});
