const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isValidCountdownDate,
  normalizeNotifyDays,
  slashCommandData,
} = require('../dist/services/discord/slashCommands.js');

test('registers documented Discord application commands', () => {
  const commands = new Map(slashCommandData.map((command) => [command.name, command]));

  assert.deepEqual(
    [...commands.keys()],
    [
      'config',
      'countdown',
      'reminders',
      'breakout',
      'delete-channel',
      'reload',
      'sesame',
      'version',
      'update-bot-profile',
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
