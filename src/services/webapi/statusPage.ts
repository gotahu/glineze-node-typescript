import { STATUS_STYLES } from './statusStyles';

export const STATUS_REFRESH_INTERVAL_MS = 15_000;

export type ServiceHealth = {
  id: string;
  name: string;
  state: 'operational' | 'degraded' | 'offline' | 'disabled';
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
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#ffffff">
  <meta name="description" content="Glinezeのサービス稼働状況とDiscordの利用状況を確認できます。">
  <title>サービスの稼働状況 | Glineze</title>
  <style>${STATUS_STYLES}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">本文へ移動</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="Glineze トップページ"><span class="brand-name">Glineze</span><span class="brand-context">稼働状況</span></a>
      <nav class="header-nav" aria-label="ページ内の案内"><a href="#services">サービス状態</a><a href="#activity">利用状況</a></nav>
    </div>
  </header>
  <main class="shell" id="main-content" tabindex="-1">
    <p class="eyebrow">Glineze の現在の状態</p>
    <h1>サービスの稼働状況</h1>
    <p class="page-description">各サービスの接続状態と、Discord の利用状況を確認できます。</p>

    <section class="hero" id="hero" data-state="loading" aria-labelledby="overall-title">
      <h2 id="overall-title">状態を確認しています</h2>
      <p id="overall-description">最新のサービス状態を取得しています。</p>
    </section>
    <div class="controls" aria-label="更新設定">
      <span class="last-updated">最終更新（日本時間）<time id="last-updated">取得中</time></span>
      <div class="update-options">
        <label class="auto-refresh-label"><input id="auto-refresh" type="checkbox" checked><span>自動更新</span></label>
        <select class="interval-select" id="refresh-interval" aria-label="自動更新の間隔">
          <option value="15000">15秒ごと</option><option value="30000">30秒ごと</option><option value="60000">60秒ごと</option>
        </select>
        <button class="refresh-button" id="refresh-now" type="button">今すぐ更新</button>
      </div>
    </div>
    <p class="refresh-message" id="refresh-message" role="status"></p>

    <section class="services" id="services" aria-labelledby="services-title">
      <div class="section-heading"><h2 id="services-title">サービス状態</h2><span class="section-note">停止中の連携は稼働状況の判定対象外です。</span></div>
      <ul class="service-list" id="service-list"><li class="service-row">サービス状態を取得しています。</li></ul>
    </section>

    <section class="activity-section" id="activity" aria-labelledby="activity-title">
      <div class="section-heading"><h2 id="activity-title">利用状況</h2><span class="section-note">今日の集計は日本時間の0時からです。</span></div>
      <div class="activity-grid">
        <div class="panel">
          <h3 class="panel-title">今日のアクティビティ</h3>
          <div class="activity-row"><span>Discord メッセージ</span><span class="activity-value"><strong id="messages-today">—</strong><span>件</span></span></div>
          <div class="activity-row"><span>Discord リアクション</span><span class="activity-value"><strong id="reactions-today">—</strong><span>件</span></span></div>
        </div>
        <div class="panel">
          <h3 class="panel-title">起動後の人気リアクション</h3>
          <div class="reaction-list" id="reaction-list"><span class="empty-state">集計を取得しています。</span></div>
        </div>
      </div>
    </section>

    <details class="system-details">
      <summary>システムの詳細</summary>
      <div class="panel">
        <p class="system-description">Web サーバーの稼働時間とリクエスト数などの技術情報です。</p>
        <dl class="metric-list">
          <div class="metric-row"><dt class="metric-label">Web 稼働時間</dt><dd class="metric-value" id="uptime">—</dd></div>
          <div class="metric-row"><dt class="metric-label">今日の HTTP リクエスト</dt><dd class="metric-value" id="requests-today">—</dd></div>
          <div class="metric-row"><dt class="metric-label">総 HTTP リクエスト</dt><dd class="metric-value" id="requests-total">—</dd></div>
          <div class="metric-row"><dt class="metric-label">メモリ使用量（RSS）</dt><dd class="metric-value" id="memory">—</dd></div>
          <div class="metric-row"><dt class="metric-label">プロセス開始時刻（日本時間）</dt><dd class="metric-value" id="started-at">—</dd></div>
        </dl>
      </div>
    </details>
    <footer class="footer"><span>Glineze · サービス稼働状況</span><span id="refresh-note">自動更新は15秒ごとに実行されます。</span></footer>
    <p class="live-region" id="live-region" aria-live="polite"></p>
    <noscript><p class="refresh-message">稼働状況の表示には JavaScript が必要です。ブラウザーの設定で有効にしてください。</p></noscript>
  </main>

  <script data-cfasync="false">
    (() => {
      const numberFormatter = new Intl.NumberFormat('ja-JP');
      const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'Asia/Tokyo'
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
        refreshMessage: document.getElementById('refresh-message'),
        liveRegion: document.getElementById('live-region')
      };

      let timer = null;
      let activeRequest = null;
      let hasSnapshot = false;

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
          return ['正常に稼働しています', '稼働中のサービスはすべて正常です。各サービスの状態は下の一覧で確認できます。'];
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
          state.textContent = service.state === 'disabled' ? '利用停止中' : service.label;

          const detail = document.createElement('span');
          detail.className = 'service-detail';
          const primary = document.createElement('span');
          primary.textContent = service.state === 'disabled' ? '設定により停止中' : service.detail;
          const meta = document.createElement('span');
          meta.textContent = service.meta;
          detail.append(primary);
          if (service.state !== 'disabled') detail.append(meta);

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
        elements.lastUpdated.dateTime = snapshot.generatedAt;
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
        hasSnapshot = true;
        elements.refreshMessage.textContent = '';
      }

      function scheduleRefresh() {
        if (timer) window.clearTimeout(timer);
        timer = null;
        if (!elements.autoRefresh.checked || document.hidden) return;
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
          const snapshot = await response.json();
          if (activeRequest !== controller) return;
          render(snapshot);
          elements.liveRegion.textContent = 'ステータスを更新しました。';
        } catch {
          if (activeRequest === controller) {
            elements.hero.dataset.state = 'unavailable';
            elements.overallTitle.textContent = '最新状態を取得できません';
            elements.overallDescription.textContent =
              hasSnapshot ? '前回取得した状態を表示しています。最新の状態とは異なる可能性があります。' : 'サービス状態を確認できません。しばらくしてから再試行してください。';
            elements.refreshMessage.textContent = '更新に失敗しました。「今すぐ更新」で再試行できます。';
            elements.liveRegion.textContent = 'ステータスの更新に失敗しました。';
          }
        } finally {
          window.clearTimeout(timeout);
          if (activeRequest === controller) {
            activeRequest = null;
            elements.refreshNow.setAttribute('aria-busy', 'false');
            elements.refreshNow.textContent = '今すぐ更新';
            scheduleRefresh();
          }
        }
      }

      elements.autoRefresh.addEventListener('change', () => {
        const next = elements.autoRefresh.checked;
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
        } else if (elements.autoRefresh.checked) {
          refresh();
        }
      });

      refresh();
    })();
  </script>
</body>
</html>`;
