const assert = require('node:assert/strict');
const test = require('node:test');

const { EmbedBuilder } = require('discord.js');
const { DiscordService } = require('../dist/services/discord/discordService.js');

test('sends embeds to the requested thread when a thread ID is supplied', async () => {
  const parentSends = [];
  const threadSends = [];
  const parent = {
    isSendable: () => true,
    isThread: () => false,
    send: async (message) => parentSends.push(message),
  };
  const thread = {
    isSendable: () => true,
    isThread: () => true,
    send: async (message) => threadSends.push(message),
  };
  const service = Object.create(DiscordService.prototype);
  service.client = {
    channels: {
      cache: new Map([
        ['parent-channel', parent],
        ['thread-channel', thread],
      ]),
      fetch: async () => undefined,
    },
  };
  const embed = new EmbedBuilder().setDescription('thread message');

  await service.sendEmbedsToChannel([embed], 'parent-channel', 'thread-channel');

  assert.deepEqual(parentSends, []);
  assert.deepEqual(threadSends, [{ embeds: [embed] }]);
});
