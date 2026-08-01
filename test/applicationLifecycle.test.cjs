const assert = require('node:assert/strict');
const test = require('node:test');

const { Application } = require('../dist/bootstrap/Application.js');

function component(name, events, overrides = {}) {
  return {
    start: async () => {
      events.push(`start:${name}`);
      await overrides.start?.();
    },
    stop: async () => {
      events.push(`stop:${name}`);
      await overrides.stop?.();
    },
  };
}

test('starts components in order and stops them in reverse order', async () => {
  const events = [];
  const application = new Application(
    [component('discord', events), component('cron', events), component('web', events)],
    () => events.push('cleanup')
  );

  await application.start();
  await application.stop();
  await application.stop();

  assert.deepEqual(events, [
    'start:discord',
    'start:cron',
    'start:web',
    'stop:web',
    'stop:cron',
    'stop:discord',
    'cleanup',
  ]);
});

test('rolls back already started components when startup fails', async () => {
  const events = [];
  const startupFailure = new Error('cron failed');
  const application = new Application(
    [
      component('discord', events),
      component('cron', events, {
        start: async () => {
          throw startupFailure;
        },
      }),
      component('web', events),
    ],
    () => events.push('cleanup')
  );

  await assert.rejects(application.start(), (error) => error === startupFailure);

  assert.deepEqual(events, ['start:discord', 'start:cron', 'stop:discord', 'cleanup']);
});

test('continues stopping remaining components and reports stop failures', async () => {
  const events = [];
  const application = new Application(
    [
      component('discord', events),
      component('cron', events, {
        stop: async () => {
          throw new Error('cron stop failed');
        },
      }),
      component('web', events),
    ],
    () => events.push('cleanup')
  );
  await application.start();

  await assert.rejects(application.stop(), AggregateError);

  assert.deepEqual(events.slice(-4), ['stop:web', 'stop:cron', 'stop:discord', 'cleanup']);
});
