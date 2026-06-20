export const STATUS_REFRESH_INTERVAL_MS = 15_000;

export type ServiceHealth = {
  id: string;
  name: string;
  state: 'operational' | 'degraded' | 'offline';
  label: string;
  detail: string;
  meta: string;
};

export type PopularReaction = {
  emoji: string;
  count: number;
};

export type StatusSnapshot = {
  generatedAt: string;
  overall: 'operational' | 'degraded' | 'offline';
  services: ServiceHealth[];
  system: {
    uptimeSeconds: number;
    requestsToday: number;
    requestsTotal: number;
    memoryRssBytes: number;
    startedAt: string;
  };
  activity: {
    discordMessagesToday: number;
    discordReactionsToday: number;
    popularReactions: PopularReaction[];
  };
};

export const STATUS_PAGE_HTML = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#071421">
  <title>Glineze System Status</title>
  <style>
    :root {
      color-scheme: dark;
      --page: #06111c;
      --page-top: #081725;
      --surface: #0a1b2b;
      --surface-strong: #0d2234;
      --line: rgba(150, 184, 211, 0.16);
      --line-strong: rgba(150, 184, 211, 0.24);
      --text: #f2f7fb;
      --muted: #91a8bb;
      --muted-strong: #b6c7d5;
      --cyan: #58d8e8;
      --green: #3fd29a;
      --green-soft: rgba(38, 201, 145, 0.14);
      --amber: #f0b857;
      --red: #f06e78;
      --radius: 9px;
      --content-width: 1440px;
    }

    * { box-sizing: border-box; }

    html { background: var(--page); }

    body {
      min-width: 320px;
      margin: 0;
      background: var(--page);
      color: var(--text);
      font-family: Inter, "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", Meiryo, system-ui, sans-serif;
      font-size: 15px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }

    button, select { font: inherit; }

    button:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
    }

    .shell {
      width: min(100%, var(--content-width));
      margin: 0 auto;
      padding: 0 26px 30px;
    }

    .topbar {
      min-height: 76px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      border-bottom: 1px solid var(--line);
    }

    .brand {
      display: flex;
      align-items: baseline;
      gap: 28px;
      min-width: 0;
    }

    .brand-name {
      margin: 0;
      font-size: clamp(25px, 3vw, 34px);
      line-height: 1;
      letter-spacing: -0.04em;
      font-weight: 760;
    }

    .brand-context {
      color: var(--muted);
      font-size: 17px;
      font-weight: 600;
      white-space: nowrap;
    }

    .controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 15px;
      color: var(--muted);
      font-size: 13px;
    }

    .last-updated { white-space: nowrap; }

    .control-divider {
      width: 1px;
      height: 22px;
      background: var(--line-strong);
    }

    .refresh-button,
    .toggle-button {
      min-height: 38px;
      border: 1px solid var(--line-strong);
      border-radius: 7px;
      background: rgba(9, 28, 43, 0.76);
      color: var(--muted-strong);
      cursor: pointer;
      transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
    }

    .refresh-button {
      padding: 7px 13px;
    }

    .refresh-button:hover,
    .toggle-button:hover {
      border-color: rgba(88, 216, 232, 0.5);
      color: var(--text);
      background: rgba(13, 42, 61, 0.9);
    }

    .refresh-button[aria-busy="true"] { cursor: wait; }

    .toggle-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
    }

    .toggle-track {
      width: 30px;
      height: 16px;
      padding: 2px;
      border-radius: 999px;
      background: #425564;
      transition: background 140ms ease;
    }

    .toggle-knob {
      display: block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: white;
      transform: translateX(0);
      transition: transform 140ms ease;
    }

    .toggle-button[aria-pressed="true"] .toggle-track { background: var(--cyan); }
    .toggle-button[aria-pressed="true"] .toggle-knob { transform: translateX(14px); }

    .interval-select {
      min-height: 38px;
      padding: 6px 29px 6px 10px;
      border: 1px solid var(--line-strong);
      border-radius: 7px;
      background: #091c2b;
      color: var(--muted-strong);
    }

    .hero {
      overflow: hidden;
      display: flex;
      align-items: center;
      gap: 30px;
      min-height: 140px;
      margin: 20px 0;
      padding: 26px 34px;
      border: 1px solid rgba(73, 205, 178, 0.2);
      border-radius: var(--radius);
      background: #0a3438;
    }

    .hero-indicator {
      flex: 0 0 auto;
      width: 78px;
      height: 78px;
      border-radius: 50%;
      background: var(--green);
    }

    .hero-icon {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .hero[data-state="degraded"] .hero-indicator { background: var(--amber); }
    .hero[data-state="offline"] .hero-indicator { background: var(--red); }
    .hero:not([data-state="operational"]) .hero-icon { display: none; }

    .hero-copy { position: relative; z-index: 1; }

    .hero h2 {
      margin: 0 0 5px;
      font-size: clamp(25px, 3.5vw, 38px);
      line-height: 1.2;
      letter-spacing: -0.035em;
    }

    .hero p {
      margin: 0;
      color: #c0d5dd;
      font-size: 15px;
    }

    .dashboard,
    .activity-grid {
      display: grid;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(9, 28, 43, 0.72);
    }

    .dashboard { grid-template-columns: 1.22fr 0.98fr; }
    .activity-grid {
      grid-template-columns: 1fr 1.08fr;
      margin-top: 18px;
    }

    .panel {
      min-width: 0;
      padding: 23px 26px 17px;
    }

    .panel + .panel { border-left: 1px solid var(--line); }

    .panel-title {
      margin: 0 0 14px;
      font-size: 17px;
      letter-spacing: 0.01em;
    }

    .service-list,
    .metric-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .service-row {
      display: grid;
      grid-template-columns: minmax(150px, 1fr) 92px minmax(190px, 1.25fr);
      align-items: center;
      gap: 18px;
      min-height: 73px;
      border-top: 1px solid var(--line);
    }

    .service-row:first-child,
    .metric-row:first-child,
    .activity-row:first-child { border-top: 0; }

    .service-name {
      font-size: 16px;
      font-weight: 650;
      color: var(--text);
    }

    .service-state {
      display: flex;
      align-items: center;
      gap: 9px;
      color: var(--green);
      font-weight: 700;
    }

    .service-state::before {
      content: "";
      flex: 0 0 auto;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 12px currentColor;
    }

    .service-row[data-state="degraded"] .service-state { color: var(--amber); }
    .service-row[data-state="offline"] .service-state { color: var(--red); }

    .service-detail {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      color: var(--muted-strong);
      font-size: 13px;
    }

    .service-detail span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .service-detail span + span {
      padding-left: 14px;
      border-left: 1px solid var(--line-strong);
      color: var(--muted);
    }

    .metric-row {
      display: grid;
      grid-template-columns: minmax(160px, 1fr) auto;
      align-items: center;
      gap: 20px;
      min-height: 73px;
      border-top: 1px solid var(--line);
    }

    .metric-label { color: var(--muted-strong); }

    .metric-value {
      color: var(--text);
      font-size: clamp(19px, 2.25vw, 28px);
      line-height: 1.2;
      font-weight: 720;
      font-variant-numeric: tabular-nums;
      text-align: right;
      letter-spacing: -0.025em;
    }

    .metric-value.small { font-size: 15px; letter-spacing: 0; }

    .activity-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 20px;
      min-height: 71px;
      border-top: 1px solid var(--line);
    }

    .activity-label { color: var(--muted-strong); }

    .activity-value {
      display: flex;
      align-items: baseline;
      gap: 7px;
      font-variant-numeric: tabular-nums;
    }

    .activity-value strong {
      font-size: 27px;
      letter-spacing: -0.03em;
    }

    .activity-value span { color: var(--muted); font-size: 12px; }

    .reaction-list {
      display: grid;
      grid-template-columns: repeat(5, minmax(56px, 1fr));
      gap: 10px;
      min-height: 92px;
      align-items: center;
    }

    .reaction {
      min-width: 0;
      text-align: center;
    }

    .reaction-emoji {
      display: block;
      min-height: 38px;
      font-size: 29px;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .reaction-count {
      display: block;
      margin-top: 5px;
      color: var(--muted-strong);
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }

    .empty-state {
      grid-column: 1 / -1;
      color: var(--muted);
      font-size: 13px;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 24px 4px 0;
      color: #6f879a;
      font-size: 12px;
    }

    .live-region {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 980px) {
      .topbar { align-items: flex-start; padding: 20px 0; }
      .controls { flex-wrap: wrap; }
      .dashboard, .activity-grid { grid-template-columns: 1fr; }
      .panel + .panel { border-left: 0; border-top: 1px solid var(--line); }
    }

    @media (max-width: 700px) {
      body { font-size: 14px; }
      .shell { padding: 0 14px 24px; }
      .topbar { display: block; }
      .brand { justify-content: space-between; }
      .brand-context { font-size: 14px; }
      .controls { justify-content: flex-start; margin-top: 18px; }
      .control-divider { display: none; }
      .hero { min-height: 124px; padding: 22px; gap: 18px; }
      .hero-indicator { width: 54px; height: 54px; }
      .panel { padding: 20px 18px 12px; }
      .service-row {
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px 16px;
        padding: 14px 0;
      }
      .service-detail { grid-column: 1 / -1; }
      .metric-row { min-height: 66px; }
      .reaction-list { grid-template-columns: repeat(3, 1fr); }
      .footer { display: block; }
      .footer span { display: block; margin-top: 5px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <h1 class="brand-name">Glineze</h1>
        <span class="brand-context">System status</span>
      </div>
      <div class="controls" aria-label="更新設定">
        <span class="last-updated">最終更新: <time id="last-updated">取得中</time></span>
        <span class="control-divider" aria-hidden="true"></span>
        <button class="toggle-button" id="auto-refresh" type="button" aria-pressed="true">
          <span>自動更新</span>
          <span class="toggle-track" aria-hidden="true"><span class="toggle-knob"></span></span>
        </button>
        <select class="interval-select" id="refresh-interval" aria-label="自動更新の間隔">
          <option value="15000">15秒ごと</option>
          <option value="30000">30秒ごと</option>
          <option value="60000">60秒ごと</option>
        </select>
        <button class="refresh-button" id="refresh-now" type="button">今すぐ更新</button>
      </div>
    </header>

    <section class="hero" id="hero" data-state="operational" aria-labelledby="overall-title">
      <div class="hero-indicator" aria-hidden="true">
        <img class="hero-icon" src="/assets/status-operational.png" alt="" width="78" height="78">
      </div>
      <div class="hero-copy">
        <h2 id="overall-title">状態を確認しています</h2>
        <p id="overall-description">最新のサービス状態を取得しています。</p>
      </div>
    </section>

    <section class="dashboard" aria-label="稼働状況">
      <div class="panel">
        <h2 class="panel-title">サービス状態</h2>
        <ul class="service-list" id="service-list" aria-live="polite"></ul>
      </div>
      <div class="panel">
        <h2 class="panel-title">システム指標</h2>
        <dl class="metric-list">
          <div class="metric-row">
            <dt class="metric-label">Web 稼働時間</dt>
            <dd class="metric-value" id="uptime">—</dd>
          </div>
          <div class="metric-row">
            <dt class="metric-label">今日の HTTP リクエスト</dt>
            <dd class="metric-value" id="requests-today">—</dd>
          </div>
          <div class="metric-row">
            <dt class="metric-label">総 HTTP リクエスト</dt>
            <dd class="metric-value" id="requests-total">—</dd>
          </div>
          <div class="metric-row">
            <dt class="metric-label">メモリ (RSS)</dt>
            <dd class="metric-value" id="memory">—</dd>
          </div>
          <div class="metric-row">
            <dt class="metric-label">プロセス開始時刻</dt>
            <dd class="metric-value small" id="started-at">—</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="activity-grid" aria-label="利用状況">
      <div class="panel">
        <h2 class="panel-title">今日のアクティビティ</h2>
        <div class="activity-row">
          <span class="activity-label">Discord メッセージ</span>
          <span class="activity-value"><strong id="messages-today">—</strong><span>件</span></span>
        </div>
        <div class="activity-row">
          <span class="activity-label">Discord リアクション</span>
          <span class="activity-value"><strong id="reactions-today">—</strong><span>件</span></span>
        </div>
      </div>
      <div class="panel">
        <h2 class="panel-title">起動後の人気リアクション</h2>
        <div class="reaction-list" id="reaction-list" aria-live="polite"></div>
      </div>
    </section>

    <footer class="footer">
      <span>ステータスデータはこのページの閲覧数から除外されます。</span>
      <span id="refresh-note">自動更新は15秒ごとに実行されます。</span>
    </footer>
    <p class="live-region" id="live-region" aria-live="polite"></p>
  </main>

  <script>
    (() => {
      const numberFormatter = new Intl.NumberFormat('ja-JP');
      const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      });
      const elements = {
        hero: document.getElementById('hero'),
        overallTitle: document.getElementById('overall-title'),
        overallDescription: document.getElementById('overall-description'),
        lastUpdated: document.getElementById('last-updated'),
        serviceList: document.getElementById('service-list'),
        uptime: document.getElementById('uptime'),
        requestsToday: document.getElementById('requests-today'),
        requestsTotal: document.getElementById('requests-total'),
        memory: document.getElementById('memory'),
        startedAt: document.getElementById('started-at'),
        messagesToday: document.getElementById('messages-today'),
        reactionsToday: document.getElementById('reactions-today'),
        reactionList: document.getElementById('reaction-list'),
        autoRefresh: document.getElementById('auto-refresh'),
        refreshInterval: document.getElementById('refresh-interval'),
        refreshNow: document.getElementById('refresh-now'),
        refreshNote: document.getElementById('refresh-note'),
        liveRegion: document.getElementById('live-region')
      };

      let timer = null;
      let activeRequest = null;

      function formatUptime(totalSeconds) {
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return days > 0
          ? days + '日 ' + hours + '時間 ' + minutes + '分'
          : hours + '時間 ' + minutes + '分';
      }

      function stateCopy(state) {
        if (state === 'operational') {
          return ['すべて正常に稼働中', 'すべてのサービスは正常に動作しています。'];
        }
        if (state === 'degraded') {
          return ['一部サービスが不安定です', '主要機能は利用できますが、一部の接続を確認しています。'];
        }
        return ['サービス障害を検知しました', '現在、一部の機能を利用できない可能性があります。'];
      }

      function renderServices(services) {
        const fragment = document.createDocumentFragment();
        for (const service of services) {
          const row = document.createElement('li');
          row.className = 'service-row';
          row.dataset.state = service.state;

          const name = document.createElement('span');
          name.className = 'service-name';
          name.textContent = service.name;

          const state = document.createElement('span');
          state.className = 'service-state';
          state.textContent = service.label;

          const detail = document.createElement('span');
          detail.className = 'service-detail';
          const primary = document.createElement('span');
          primary.textContent = service.detail;
          const meta = document.createElement('span');
          meta.textContent = service.meta;
          detail.append(primary, meta);

          row.append(name, state, detail);
          fragment.append(row);
        }
        elements.serviceList.replaceChildren(fragment);
      }

      function renderReactions(reactions) {
        if (!reactions.length) {
          const empty = document.createElement('span');
          empty.className = 'empty-state';
          empty.textContent = 'リアクションはまだ記録されていません。';
          elements.reactionList.replaceChildren(empty);
          return;
        }

        const fragment = document.createDocumentFragment();
        for (const reaction of reactions) {
          const item = document.createElement('div');
          item.className = 'reaction';
          const emoji = document.createElement('span');
          emoji.className = 'reaction-emoji';
          emoji.textContent = reaction.emoji;
          const count = document.createElement('span');
          count.className = 'reaction-count';
          count.textContent = numberFormatter.format(reaction.count);
          item.append(emoji, count);
          fragment.append(item);
        }
        elements.reactionList.replaceChildren(fragment);
      }

      function render(snapshot) {
        const copy = stateCopy(snapshot.overall);
        elements.hero.dataset.state = snapshot.overall;
        elements.overallTitle.textContent = copy[0];
        elements.overallDescription.textContent = copy[1];
        elements.lastUpdated.textContent = dateFormatter.format(new Date(snapshot.generatedAt));
        elements.uptime.textContent = formatUptime(snapshot.system.uptimeSeconds);
        elements.requestsToday.textContent = numberFormatter.format(snapshot.system.requestsToday);
        elements.requestsTotal.textContent = numberFormatter.format(snapshot.system.requestsTotal);
        elements.memory.textContent =
          (snapshot.system.memoryRssBytes / 1024 / 1024).toFixed(1) + ' MB';
        elements.startedAt.textContent = dateFormatter.format(new Date(snapshot.system.startedAt));
        elements.messagesToday.textContent =
          numberFormatter.format(snapshot.activity.discordMessagesToday);
        elements.reactionsToday.textContent =
          numberFormatter.format(snapshot.activity.discordReactionsToday);
        renderServices(snapshot.services);
        renderReactions(snapshot.activity.popularReactions);
      }

      function scheduleRefresh() {
        if (timer) window.clearTimeout(timer);
        timer = null;
        if (elements.autoRefresh.getAttribute('aria-pressed') !== 'true') return;
        const interval = Number(elements.refreshInterval.value);
        timer = window.setTimeout(refresh, interval);
        elements.refreshNote.textContent =
          '自動更新は' + interval / 1000 + '秒ごとに実行されます。';
      }

      async function refresh() {
        if (activeRequest) activeRequest.abort();
        const controller = new AbortController();
        activeRequest = controller;
        const timeout = window.setTimeout(() => controller.abort(), 5000);
        elements.refreshNow.setAttribute('aria-busy', 'true');
        elements.refreshNow.textContent = '更新中';

        try {
          const response = await fetch('/api/status', {
            cache: 'no-store',
            signal: controller.signal,
            headers: { accept: 'application/json' }
          });
          if (!response.ok) throw new Error('Status request failed');
          render(await response.json());
          elements.liveRegion.textContent = 'ステータスを更新しました。';
        } catch (error) {
          if (error.name !== 'AbortError') {
            elements.hero.dataset.state = 'degraded';
            elements.overallTitle.textContent = '最新状態を取得できません';
            elements.overallDescription.textContent =
              '前回の表示を維持しています。しばらくしてから再試行してください。';
            elements.liveRegion.textContent = 'ステータスの更新に失敗しました。';
          }
        } finally {
          window.clearTimeout(timeout);
          if (activeRequest === controller) activeRequest = null;
          elements.refreshNow.setAttribute('aria-busy', 'false');
          elements.refreshNow.textContent = '今すぐ更新';
          scheduleRefresh();
        }
      }

      elements.autoRefresh.addEventListener('click', () => {
        const next = elements.autoRefresh.getAttribute('aria-pressed') !== 'true';
        elements.autoRefresh.setAttribute('aria-pressed', String(next));
        elements.refreshInterval.disabled = !next;
        elements.refreshNote.textContent = next
          ? '自動更新を有効にしました。'
          : '自動更新は停止しています。';
        scheduleRefresh();
      });

      elements.refreshInterval.addEventListener('change', scheduleRefresh);
      elements.refreshNow.addEventListener('click', refresh);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (timer) window.clearTimeout(timer);
          timer = null;
        } else {
          refresh();
        }
      });

      refresh();
    })();
  </script>
</body>
</html>`;
