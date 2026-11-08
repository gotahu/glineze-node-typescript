const assert = require('node:assert/strict');
const test = require('node:test');

const { ChannelType, Collection, MessageType } = require('discord.js');
const { env } = require('../dist/env.js');
const { logger } = require('../dist/utils/logger.js');
const relay = require('../dist/services/discord/functions/RelayFunction.js');
const { MessageHandler } = require('../dist/services/discord/messageHandler.js');
const { relayMessage } = relay;

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

test('uses the fetched relay channel and sends mentions as plain text', async (t) => {
  const originalGuildId = env.DISCORD_VOID_GUILD_ID;
  t.after(() => {
    env.DISCORD_VOID_GUILD_ID = originalGuildId;
  });

  const relayGuildId = '123456789012345678';
  env.DISCORD_VOID_GUILD_ID = relayGuildId;

  let createCalled = false;
  let sentOptions;
  const webhook = {
    token: 'token',
    send: async (options) => {
      sentOptions = options;
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
  assert.equal(sentOptions.content, 'relay me');

  const userId = '111111111111111111';
  const otherUserId = '222222222222222222';
  const roleId = '333333333333333333';
  const channelId = '444444444444444444';
  const unknownId = '555555555555555555';
  message.guild.members = { cache: new Collection([[userId, { displayName: 'Nick' }]]) };
  message.guild.roles = { cache: new Collection([[roleId, { name: 'Class' }]]) };
  message.client.users = { cache: new Collection() };
  message.mentions = {
    users: new Collection([[otherUserId, { displayName: 'Display' }]]),
    channels: new Collection([[channelId, { name: 'general' }]]),
    crosspostedChannels: new Collection(),
  };
  message.content = `<@${userId}> <@!${otherUserId}> <@&${roleId}> <#${channelId}> <@${unknownId}> @everyone <:wave:${unknownId}>`;
  await relayMessage(message);

  assert.equal(
    sentOptions.content,
    `@Nick @Display @Class #general @${unknownId} @everyone <:wave:${unknownId}>`
  );
  assert.deepEqual(sentOptions.allowedMentions, { parse: [], repliedUser: false });

  const longName = 'a'.repeat(32);
  message.guild.members.cache.get(userId).displayName = longName;
  const padding = 'x'.repeat(2000 - `<@${userId}>`.length);
  message.content = `${padding}<@${userId}>`;
  await relayMessage(message);

  assert.equal(sentOptions.content, `${padding}@${userId}`);
});

test('ignores thread system messages before looking up a relay channel', async () => {
  for (const type of [MessageType.ThreadCreated, MessageType.ThreadStarterMessage]) {
    let lookedUpRelay = false;
    await relayMessage({
      type,
      content: 'Thread notice',
      author: {},
      get client() {
        lookedUpRelay = true;
        return {};
      },
    });
    assert.equal(lookedUpRelay, false);
  }
});

test('relays guild message edits and skips updates without a new edit timestamp', async (t) => {
  const send = t.mock.method(relay, 'relayMessage', async () => {});
  const handler = new MessageHandler({});
  const message = {
    guild: { id: 'source-guild' },
    channel: { type: ChannelType.GuildText },
    editedTimestamp: 1000,
  };
  const fetch = t.mock.fn(async () => message);

  await handler.handleMessageUpdate(message, { ...message, hasThread: true });
  await handler.handleMessageUpdate(
    { editedTimestamp: null },
    { ...message, editedTimestamp: null, partial: true, fetch }
  );
  assert.equal(send.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);

  const editedMessage = { ...message, editedTimestamp: 2000, content: 'edited' };
  await handler.handleMessageUpdate(message, editedMessage);
  assert.deepEqual(send.mock.calls[0].arguments, [editedMessage]);

  await handler.handleMessageUpdate(
    { editedTimestamp: null },
    { ...message, partial: true, fetch }
  );
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(send.mock.calls[1].arguments, [message]);
});
