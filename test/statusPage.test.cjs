const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { STATUS_PAGE_HTML } = require('../dist/services/webapi/statusPage');

const settle = () => new Promise((resolve) => globalThis.setImmediate(resolve));

function snapshot(overall = 'operational') {
  return {
    generatedAt: '2026-10-04T13:00:00Z',
    overall,
    services: [
      { name: 'Notion', state: 'disabled', label: '停止', detail: '無効化済み', meta: '' },
    ],
    system: {
      uptimeSeconds: 3600,
      requestsToday: 1,
      requestsTotal: 2,
      memoryRssBytes: 1024,
      startedAt: '2026-10-04T12:00:00Z',
    },
    activity: { discordMessagesToday: 3, discordReactionsToday: 4, popularReactions: [] },
  };
}

function createClient() {
  function element() {
    return {
      textContent: '',
      dataset: {},
      attributes: {},
      listeners: {},
      children: [],
      append(...children) {
        this.children.push(...children);
      },
      replaceChildren(...children) {
        this.children = children;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      addEventListener(name, listener) {
        this.listeners[name] = listener;
      },
    };
  }
  const elements = Object.fromEntries(
    [...STATUS_PAGE_HTML.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], element()])
  );
  elements['auto-refresh'].checked = true;
  elements['refresh-interval'].value = '15000';
  const timers = new Map();
  let nextTimer = 0;
  const document = {
    hidden: false,
    listeners: {},
    getElementById: (id) => elements[id],
    createElement: element,
    createDocumentFragment: element,
    addEventListener(name, listener) {
      this.listeners[name] = listener;
    },
  };
  const requests = [];
  const script = STATUS_PAGE_HTML.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    document,
    Intl,
    Date,
    AbortController: globalThis.AbortController,
    window: {
      setTimeout: (callback, delay) => {
        timers.set(++nextTimer, { callback, delay });
        return nextTimer;
      },
      clearTimeout: (id) => timers.delete(id),
    },
    fetch: (_url, options) =>
      new Promise((resolve, reject) => requests.push({ resolve, reject, signal: options.signal })),
  });
  return { elements, timers, requests, document };
}

function respond(request, data = snapshot()) {
  request.resolve({ ok: true, json: async () => data });
}

test('shows initial fetch failure and clears the warning after recovery', async () => {
  const { elements, requests } = createClient();
  requests[0].reject(new Error('Unavailable'));
  await settle();
  assert.equal(elements.hero.dataset.state, 'unavailable');
  assert.match(elements['overall-description'].textContent, /状態を確認できません/);
  assert.match(elements['refresh-message'].textContent, /再試行/);
  const refresh = elements['refresh-now'].listeners.click();
  respond(requests[1]);
  await refresh;
  assert.equal(elements.hero.dataset.state, 'operational');
  assert.equal(elements['refresh-message'].textContent, '');
  const row = elements['service-list'].children[0].children[0];
  assert.equal(row.children[1].textContent, '利用停止中');
  assert.match(elements['last-updated'].textContent, /22:00:00/);
});

test('reports a timed out request while preserving the previous snapshot', async () => {
  const { elements, requests, timers } = createClient();
  respond(requests[0]);
  await settle();
  const refresh = elements['refresh-now'].listeners.click();
  requests[1].signal.addEventListener('abort', () => {
    requests[1].reject(new globalThis.DOMException('Timed out', 'AbortError'));
  });
  [...timers.values()].find((timer) => timer.delay === 5000).callback();
  await refresh;
  assert.equal(elements.hero.dataset.state, 'unavailable');
  assert.match(elements['overall-description'].textContent, /前回取得した状態/);
  assert.equal(elements['messages-today'].textContent, '3');
  assert.equal(elements['refresh-now'].attributes['aria-busy'], 'false');
});

test('ignores superseded responses and leaves the latest request in control', async () => {
  const { elements, requests } = createClient();
  const latest = elements['refresh-now'].listeners.click();
  assert.equal(requests[0].signal.aborted, true);
  respond(requests[0], snapshot('offline'));
  await settle();
  assert.equal(elements['refresh-now'].attributes['aria-busy'], 'true');
  assert.notEqual(elements.hero.dataset.state, 'offline');
  respond(requests[1]);
  await latest;
  assert.equal(elements.hero.dataset.state, 'operational');
  assert.equal(elements['refresh-now'].attributes['aria-busy'], 'false');
});

test('stops automatic refresh and pauses scheduling while the page is hidden', async () => {
  const { elements, requests, timers, document } = createClient();
  respond(requests[0]);
  await settle();
  assert.equal([...timers.values()][0].delay, 15000);
  elements['auto-refresh'].checked = false;
  elements['auto-refresh'].listeners.change();
  assert.equal(timers.size, 0);
  assert.equal(elements['refresh-interval'].disabled, true);
  document.hidden = true;
  document.listeners.visibilitychange();
  document.hidden = false;
  document.listeners.visibilitychange();
  assert.equal(requests.length, 1);
  elements['auto-refresh'].checked = true;
  elements['refresh-interval'].value = '30000';
  elements['auto-refresh'].listeners.change();
  assert.equal([...timers.values()][0].delay, 30000);
  document.hidden = true;
  document.listeners.visibilitychange();
  assert.equal(timers.size, 0);
});
