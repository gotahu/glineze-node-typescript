const assert = require('node:assert/strict');
const test = require('node:test');

const { config } = require('../dist/config.js');
const {
  handleSlashCommand,
  isValidCountdownDate,
  normalizeNotifyDays,
  slashCommandData,
} = require('../dist/services/discord/slashCommands.js');

test('registers documented Discord application commands', () => {
  const commands = new Map(slashCommandData.map((command) => [command.name, command]));

  assert.deepEqual(
    [...commands.keys()],
    [
      'remind',
      'config',
      'countdown',
      'reminders',
      'breakout',
      'delete-channel',
      'reload',
      'sesame',
      'version',
      'update-bot-profile',
      'practice-template',
      'practice-notify',
      'practice-remind',
    ]
  );

  for (const command of commands.values()) {
    assert.ok(command.description.length >= 10, `${command.name} should have a useful description`);
  }

  const configSubcommands = commands.get('config').options.map((option) => option.name);
  assert.deepEqual(configSubcommands, ['list', 'get', 'set']);

  const countdownSubcommands = commands.get('countdown').options.map((option) => option.name);
  assert.deepEqual(countdownSubcommands, [
    'info',
    'send',
    'days',
    'date',
    'message',
    'title',
    'channel',
    'setup',
  ]);

  const setupOptions = commands
    .get('countdown')
    .options.find((option) => option.name === 'setup').options;
  assert.deepEqual(
    setupOptions.map((option) => option.name),
    ['date', 'title', 'channel', 'notify-days', 'message']
  );

  const reminderOptions = commands.get('reminders').options[0].options;
  assert.deepEqual(
    reminderOptions.map((option) => option.name),
    ['practice-channel', 'place-channel']
  );

  const practiceNotifySubcommands = commands
    .get('practice-notify')
    .options.map((option) => option.name);
  assert.deepEqual(practiceNotifySubcommands, ['current', 'configured', 'channel']);
  assert.deepEqual(
    commands.get('practice-notify').options[2].options.map((option) => option.name),
    ['destination']
  );

  assert.deepEqual(
    commands.get('practice-template').options.map((option) => option.name),
    ['preview', 'reload', 'status']
  );
});

test('validates calendar dates strictly', () => {
  assert.equal(isValidCountdownDate('2026-12-20'), true);
  assert.equal(isValidCountdownDate('2026-02-29'), false);
  assert.equal(isValidCountdownDate('2026/12/20'), false);
});

test('normalizes countdown notification days', () => {
  assert.equal(normalizeNotifyDays('0, 7,30,7,1'), '30,7,1,0');
  assert.equal(normalizeNotifyDays('-1,7'), undefined);
  assert.equal(normalizeNotifyDays('tomorrow'), undefined);
});

function createPracticeNotifyInteraction(subcommand, overrides = {}) {
  const replies = [];
  return {
    replies,
    interaction: {
      commandName: 'practice-notify',
      channelId: 'current-channel',
      options: {
        getSubcommand: () => subcommand,
        getChannel: () => overrides.destination,
      },
      deferReply: async () => {},
      inGuild: () => true,
      guild: {},
      member: {
        roles: { cache: new Map([['authorized-role', { name: '運営' }]]) },
      },
      editReply: async (content) => replies.push(content),
    },
  };
}

function createPracticeNotifyServices(sends, practices = [{ announceText: '翌日の練習連絡' }]) {
  return {
    notion: {
      practiceService: {
        retrievePracticesForRelativeDay: async (days) => {
          assert.equal(days, 1);
          return practices;
        },
      },
    },
    discord: {
      sendStringsToChannel: async (messages, channelId) => sends.push({ messages, channelId }),
    },
  };
}

test('sends tomorrow practice notifications to the current channel', async () => {
  const sends = [];
  const { interaction, replies } = createPracticeNotifyInteraction('current');

  await handleSlashCommand(interaction, createPracticeNotifyServices(sends));

  assert.deepEqual(sends, [{ messages: ['翌日の練習連絡'], channelId: 'current-channel' }]);
  assert.deepEqual(replies, ['翌日の練習連絡を <#current-channel> へ 1 件送信しました。']);
});

test('sends tomorrow practice notifications to the configured channel', async (t) => {
  const originalChannelId = config.notionConfigs.get('practice_remind_threadid');
  config.notionConfigs.set('practice_remind_threadid', 'configured-channel');
  t.after(() => {
    if (originalChannelId === undefined) config.notionConfigs.delete('practice_remind_threadid');
    else config.notionConfigs.set('practice_remind_threadid', originalChannelId);
  });
  const sends = [];
  const { interaction } = createPracticeNotifyInteraction('configured');

  await handleSlashCommand(interaction, createPracticeNotifyServices(sends));

  assert.equal(sends[0].channelId, 'configured-channel');
});

test('sends tomorrow practice notifications to a selected channel', async () => {
  const sends = [];
  const { interaction } = createPracticeNotifyInteraction('channel', {
    destination: { id: 'selected-channel' },
  });

  await handleSlashCommand(interaction, createPracticeNotifyServices(sends));

  assert.equal(sends[0].channelId, 'selected-channel');
});

test('reports a missing Notion announcement without sending a failure-looking message', async () => {
  const sends = [];
  const { interaction, replies } = createPracticeNotifyInteraction('current');

  await handleSlashCommand(
    interaction,
    createPracticeNotifyServices(sends, [{ announceText: '' }])
  );

  assert.deepEqual(sends, []);
  assert.deepEqual(replies, [
    '翌日の練習は 1 件ありますが、生成された練習連絡が空のため送信しませんでした。',
  ]);
});

test('rejects slash commands from members without an authorized role', async () => {
  const sends = [];
  const { interaction, replies } = createPracticeNotifyInteraction('current');
  interaction.member.roles.cache = new Map([['other-role', { name: '団員' }]]);

  await handleSlashCommand(interaction, createPracticeNotifyServices(sends));

  assert.deepEqual(sends, []);
  assert.deepEqual(replies, [
    'このコマンドを実行するには「運営」「事務」「技術」のいずれかのロールが必要です。',
  ]);
});

test('allows regular guild members to open the ephemeral reminder dashboard', async () => {
  const replies = [];
  const defers = [];
  const interaction = {
    commandName: 'remind',
    options: { getSubcommand: () => null },
    deferReply: async (options) => defers.push(options),
    inGuild: () => true,
    guild: {},
    member: { roles: { cache: new Map([['member-role', { name: '団員' }]]) } },
    editReply: async (payload) => replies.push(payload),
  };

  await handleSlashCommand(interaction, {
    notion: { reminderService: {} },
    discord: {},
  });

  assert.equal(defers[0].flags !== undefined, true);
  assert.match(replies[0].content, /リマインダー/);
  assert.equal(replies[0].components.length, 1);
});

test('does not publish Discord permission defaults that would hide commands from authorized roles', () => {
  for (const command of slashCommandData) {
    assert.equal(command.default_member_permissions, undefined, command.name);
  }
});

test('previews the cached practice template without sending it to a channel', async () => {
  const replies = [];
  const interaction = {
    commandName: 'practice-template',
    options: {
      getSubcommand: () => 'preview',
      getInteger: () => 2,
    },
    deferReply: async () => {},
    inGuild: () => true,
    guild: {},
    member: {
      roles: { cache: new Map([['authorized-role', { name: '技術' }]]) },
    },
    editReply: async (content) => replies.push(content),
    followUp: async (content) => replies.push(content.content),
  };
  const services = {
    notion: {
      practiceTemplateService: {},
      practiceService: {
        retrievePracticesForRelativeDay: async (days) => {
          assert.equal(days, 2);
          return [{ announceText: '生成された練習連絡' }];
        },
      },
    },
    discord: {
      sendStringsToChannel: async () => assert.fail('preview must not send to a channel'),
    },
  };

  await handleSlashCommand(interaction, services);

  assert.deepEqual(replies, ['【プレビュー 1/1】\n生成された練習連絡']);
});
