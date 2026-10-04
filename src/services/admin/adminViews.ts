import { Eta } from 'eta';
import { AdminSettingField } from './adminConsoleService';

const eta = new Eta({ autoEscape: true, cache: true });

const PRACTICE_PLACEHOLDER_LABELS: Record<string, string> = {
  accessText: 'アクセス',
  dateLabel: '日付',
  notionUrl: 'Notion URL',
  pageId: 'ページID',
  placeNames: '施設名',
  placeText: '場所',
  programText: '練習内容',
  publicityNotice: '情宣案内',
  publicityText: '情宣担当',
  room: '部屋',
  teachersNotice: '先生案内',
  teachersText: '先生名',
  timeText: '時間',
  title: 'タイトル',
  ttText: 'TT',
};

type PageOptions = {
  title: string;
  active?: string;
  csrfToken?: string;
  content: string;
  notice?: string;
  error?: string;
  authenticated?: boolean;
};

const layoutTemplate = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="htmx-config" content='{"allowEval":false,"allowScriptTags":false,"includeIndicatorStyles":false,"selfRequestsOnly":true}'>
  <title><%= it.title %> | Glineze 管理画面</title>
  <link rel="stylesheet" href="/admin/assets/tabler-icons.css">
  <link rel="stylesheet" href="/admin/assets/admin.css?v=20261004-dads-1">
  <script src="/admin/assets/htmx.min.js" defer></script>
  <script src="/admin/assets/admin.js?v=20261004-dads-1" defer></script>
</head>
<body class="<%= it.authenticated ? 'admin-shell' : 'auth-shell' %>">
  <a class="skip-link" href="#main-content">本文へ移動</a>
  <header class="app-sidebar">
    <a class="app-brand" href="/admin" aria-label="Glineze 管理画面">
      <span class="app-brand-mark"><i class="ti ti-letter-g" aria-hidden="true"></i></span>
      <span class="app-brand-copy"><strong>Glineze</strong><small>管理画面</small></span>
    </a>
    <% if (it.authenticated) { %>
    <nav class="primary-nav" aria-label="管理画面">
      <a href="/admin" class="<%= it.active === 'dashboard' ? 'active' : '' %>" <% if (it.active === 'dashboard') { %>aria-current="page"<% } %>>
        <i class="ti ti-activity" aria-hidden="true"></i><span>稼働状況</span>
      </a>
      <a href="/admin/settings" class="<%= it.active === 'settings' ? 'active' : '' %>" <% if (it.active === 'settings') { %>aria-current="page"<% } %>>
        <i class="ti ti-settings" aria-hidden="true"></i><span>設定</span>
      </a>
    </nav>
    <% if (it.active === 'settings') { %>
    <details class="settings-menu" open>
    <summary>このページの目次</summary>
    <nav class="settings-nav" aria-label="設定メニュー">
      <p aria-hidden="true">このページの目次</p>
      <a href="#practice"><i class="ti ti-speakerphone" aria-hidden="true"></i><span>練習連絡</span></a>
      <a href="#countdown"><i class="ti ti-clock" aria-hidden="true"></i><span>カウントダウン</span></a>
      <a href="#notifications"><i class="ti ti-bell" aria-hidden="true"></i><span>その他の通知</span></a>
      <a href="#advanced"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i><span>詳細設定</span></a>
      <a href="#sesame"><i class="ti ti-door" aria-hidden="true"></i><span>Sesame</span></a>
      <a href="#system"><i class="ti ti-shield" aria-hidden="true"></i><span>システム</span></a>
    </nav>
    </details>
    <% } %>
    <form class="logout-form" method="post" action="/admin/logout">
      <input type="hidden" name="_csrf" value="<%= it.csrfToken %>">
      <button type="submit" class="nav-button"><i class="ti ti-logout" aria-hidden="true"></i><span>ログアウト</span></button>
    </form>
    <% } %>
  </header>
  <main id="main-content" class="app-main" tabindex="-1">
    <% if (it.authenticated) { %>
    <nav class="breadcrumbs" aria-label="パンくずリスト">
      <% if (it.active === 'settings') { %><a href="/admin">管理画面</a><i class="ti ti-chevron-right" aria-hidden="true"></i><span aria-current="page">設定</span><% } else { %><span>管理画面</span><% } %>
    </nav>
    <% } %>
    <div class="page-heading">
      <div>
        <h1><%= it.title %></h1>
        <% if (it.active === 'settings') { %><p>ボットの通知内容・送信先と、連携サービスを設定します。</p><% } else if (it.active === 'dashboard') { %><p>ボットと連携サービスの稼働状況を確認できます。</p><% } %>
      </div>
      <% if (it.active === 'settings') { %>
      <span class="sync-status"><i class="ti ti-circle-check" aria-hidden="true"></i>設定を読み込み済み</span>
      <% } %>
    </div>
    <% if (it.notice) { %><aside class="flash success" role="status"><i class="ti ti-circle-check" aria-hidden="true"></i><span><%= it.notice %></span><button type="button" data-dismiss-flash aria-label="通知を閉じる"><i class="ti ti-x" aria-hidden="true"></i></button></aside><% } %>
    <% if (it.error) { %><aside class="flash error" role="alert"><i class="ti ti-alert-circle" aria-hidden="true"></i><span><%= it.error %></span><button type="button" data-dismiss-flash aria-label="エラーを閉じる"><i class="ti ti-x" aria-hidden="true"></i></button></aside><% } %>
    <%~ it.content %>
  </main>
</body>
</html>`;

export function renderPage(options: PageOptions): string {
  return eta.renderString(layoutTemplate, options);
}

export function renderUnauthorized(): string {
  return renderPage({
    title: 'ログインが必要です',
    content:
      '<section class="auth-guidance" aria-labelledby="login-guidance-title"><h2 id="login-guidance-title">管理者用リンクからログイン</h2><p>管理者限定の Notion ページにある最新のリンクからアクセスしてください。</p><p>リンクの有効期限が切れている場合は、Notion ページを開き直してください。</p></section>',
  });
}

const timestampFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function formatTimestamp(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${timestampFormatter.format(date)}（日本時間）`;
}

export function renderDashboard(
  snapshot: {
    overall: string;
    generatedAt: string;
    services: Array<{ name: string; label: string; detail: string; state?: string }>;
    system: { uptimeSeconds: number; requestsToday: number; startedAt: string };
  },
  extra: {
    configReloadAt?: string;
    configReloadError?: string;
    loginLinkExpiresAt?: string;
    loginLinkNextRotationAt?: string;
    loginLinkError?: string;
  }
): string {
  const states: Record<string, { label: string; description: string; icon: string }> = {
    operational: {
      label: '正常に稼働しています',
      description: '有効なサービスはすべて正常に稼働しています。',
      icon: 'circle-check',
    },
    degraded: {
      label: '一部のサービスを確認してください',
      description: 'サービス別の状態と接続状況を確認してください。',
      icon: 'alert-triangle',
    },
    offline: {
      label: '停止中のサービスがあります',
      description: 'サービス別の状態を確認し、接続や設定を見直してください。',
      icon: 'alert-circle',
    },
  };
  const overall = states[snapshot.overall] ?? {
    label: '状態を確認できません',
    description: '画面を再読込して最新の状態を確認してください。',
    icon: 'help-circle',
  };
  const uptime = Math.max(0, Math.floor(snapshot.system.uptimeSeconds));
  const uptimeLabel = `${Math.floor(uptime / 86400)}日 ${Math.floor((uptime % 86400) / 3600)}時間 ${Math.floor((uptime % 3600) / 60)}分`;
  const details = [
    { label: '起動日時', value: formatTimestamp(snapshot.system.startedAt, '未取得') },
    { label: '設定の最終再読込', value: formatTimestamp(extra.configReloadAt, '未実行') },
    {
      label: '設定再読込エラー',
      value: extra.configReloadError || 'なし',
      error: Boolean(extra.configReloadError),
    },
    { label: 'ログインリンク有効期限', value: formatTimestamp(extra.loginLinkExpiresAt, '未発行') },
    {
      label: '次回リンク更新',
      value: formatTimestamp(extra.loginLinkNextRotationAt, 'Cron 設定に従う'),
    },
    {
      label: 'リンク更新エラー',
      value: extra.loginLinkError || 'なし',
      error: Boolean(extra.loginLinkError),
    },
  ];
  return eta.renderString(
    `<div class="dashboard-content">
      <section class="health-summary" data-state="<%= it.snapshot.overall %>" aria-labelledby="overall-heading">
        <i class="ti ti-<%= it.overall.icon %>" aria-hidden="true"></i>
        <div><h2 id="overall-heading"><%= it.overall.label %></h2><p><%= it.overall.description %></p><small>取得日時：<%= it.generatedAt %> · 再読込すると最新の状態を取得します。</small></div>
      </section>
      <dl class="metrics-grid" aria-label="稼働情報">
        <div class="metric"><dt>稼働時間</dt><dd><%= it.uptimeLabel %></dd></div>
        <div class="metric"><dt>本日のリクエスト</dt><dd><%= it.requestsToday %> 件</dd></div>
        <div class="metric"><dt>連携サービス</dt><dd><%= it.snapshot.services.length %> 件</dd></div>
      </dl>
      <section aria-labelledby="services-heading">
        <div class="dashboard-section-heading"><h2 id="services-heading">サービス別の状態</h2><a href="/admin/settings">連携サービスの設定<i class="ti ti-chevron-right" aria-hidden="true"></i></a></div>
        <div class="service-grid">
          <% it.snapshot.services.forEach(function(service) { %>
          <article class="service-card">
            <div class="service-card-heading"><h3><%= service.name %></h3><span class="status-label" data-state="<%= service.state || '' %>"><i class="ti ti-<%= service.state === 'operational' ? 'circle-check' : service.state === 'offline' ? 'alert-circle' : service.state === 'degraded' ? 'alert-triangle' : 'circle-minus' %>" aria-hidden="true"></i><%= service.state === 'disabled' ? '無効' : service.label %></span></div>
            <p><%= service.detail %></p>
          </article>
          <% }) %>
        </div>
      </section>
      <section aria-labelledby="system-heading">
        <h2 id="system-heading">システム情報</h2>
        <dl class="dashboard-details">
          <% it.details.forEach(function(entry) { %><div><dt><%= entry.label %></dt><dd class="<%= entry.error ? 'error' : '' %>"><%= entry.value %></dd></div><% }) %>
        </dl>
      </section>
    </div>`,
    {
      snapshot,
      overall,
      details,
      generatedAt: formatTimestamp(snapshot.generatedAt, '未取得'),
      uptimeLabel,
      requestsToday: snapshot.system.requestsToday.toLocaleString('ja-JP'),
    }
  );
}

export function renderSettingsForm(
  category: string,
  fields: AdminSettingField[],
  csrfToken: string,
  fieldErrors: Readonly<Record<string, string>> = {},
  channelChecks: Readonly<Record<string, { ok: boolean; message: string }>> = {}
): string {
  return eta.renderString(
    `<div class="settings-fields" data-category="<%= it.category %>">
      <% it.fields.forEach(function(field) { %>
        <div class="setting-row <%= field.input === 'textarea' ? 'textarea-row' : '' %>">
          <div class="setting-copy">
            <label id="setting-label-<%= field.key %>" for="setting-<%= field.key %>"><%= field.label %><% if (!field.secret && field.input !== 'boolean') { %><span class="requirement">※必須</span><% } %></label>
            <small id="setting-description-<%= field.key %>"><%= field.description %></small>
          </div>
          <div class="setting-control">
            <% if (field.key === 'countdown_message') { %>
              <div class="placeholder-toolbar" aria-label="カウントダウンのプレースホルダー">
                <span>プレースホルダーを挿入</span>
                <button type="button" class="placeholder-chip" data-insert-placeholder="{{title}}" data-target="setting-countdown_message" disabled>イベント名 <code>{{title}}</code></button>
                <button type="button" class="placeholder-chip" data-insert-placeholder="{{days}}" data-target="setting-countdown_message" disabled>残り日数 <code>{{days}}</code></button>
              </div>
            <% } %>
            <div class="control-line">
              <% if (field.input === 'boolean') { %>
                <input type="hidden" name="<%= field.key %>" value="false">
                <label class="checkbox-control" for="setting-<%= field.key %>">
                  <input id="setting-<%= field.key %>" name="<%= field.key %>" type="checkbox" value="true" aria-labelledby="setting-label-<%= field.key %>" aria-describedby="setting-description-<%= field.key %> setting-feedback-<%= field.key %> setting-hint-<%= field.key %>" data-setting-toggle <%= field.value === 'true' ? 'checked' : '' %>>
                  <span>有効にする</span><span class="checkbox-state" data-toggle-state aria-hidden="true"><%= field.value === 'true' ? '有効' : '無効' %></span>
                </label>
              <% } else if (field.input === 'textarea') { %>
                <textarea id="setting-<%= field.key %>" name="<%= field.key %>" aria-describedby="setting-description-<%= field.key %> setting-feedback-<%= field.key %>" <% if (it.fieldErrors[field.key]) { %>aria-invalid="true"<% } %> <% if (field.key === 'countdown_message') { %>data-valid-placeholders="title,days"<% } %> required readonly><%= field.value || '' %></textarea>
              <% } else { %>
                <input
                  id="setting-<%= field.key %>"
                  name="<%= field.key %>"
                  type="<%= field.input === 'secret' ? 'password' : field.input %>"
                  value="<%= field.secret ? '' : (field.value || '') %>"
                  placeholder="<%= field.secret && field.configured ? '設定済み（変更時のみ入力）' : '' %>"
                  <%= field.secret ? '' : 'required' %>
                  autocomplete="off"
                  aria-describedby="setting-description-<%= field.key %> setting-feedback-<%= field.key %><% if (field.key === 'countdown_notify_days') { %> setting-validation-<%= field.key %><% } %>"
                  <% if (it.fieldErrors[field.key]) { %>aria-invalid="true"<% } %>
                  <% if (field.key === 'countdown_notify_days') { %>data-validate-notify-days<% } %>
                  <% if (field.notionDatabase) { %>data-notion-database-id<% } %>
                  readonly
                >
              <% } %>
              <% if (field.input !== 'boolean') { %>
                <button
                  type="button"
                  class="button compact secondary field-edit-button"
                  data-edit-field
                  aria-controls="setting-<%= field.key %>"
                  aria-label="<%= field.label %>を編集"
                  aria-pressed="false"
                ><i class="ti ti-pencil" aria-hidden="true"></i><span>編集</span></button>
              <% } %>
              <% if (field.discordChannel) { %>
                <button
                  type="submit"
                  class="button compact secondary"
                  formaction="/admin/actions/verify-channel"
                  formmethod="post"
                  formnovalidate
                  name="_verify"
                  value="<%= field.key %>"
                  aria-label="<%= field.label %>を確認"
                  hx-post="/admin/actions/verify-channel"
                  hx-include="#settings-form"
                  hx-target="#setting-feedback-<%= field.key %>"
                  hx-select="#setting-feedback-<%= field.key %>"
                  hx-swap="outerHTML"
                >確認</button>
              <% } else if (field.notionDatabase) { %>
                <button
                  type="submit"
                  class="button compact secondary"
                  formaction="/admin/actions/verify-notion-database"
                  formmethod="post"
                  formnovalidate
                  name="_verify"
                  value="<%= field.key %>"
                  aria-label="<%= field.label %>を確認"
                  hx-post="/admin/actions/verify-notion-database"
                  hx-include="#settings-form"
                  hx-target="#setting-feedback-<%= field.key %>"
                  hx-select="#setting-feedback-<%= field.key %>"
                  hx-swap="outerHTML"
                >確認</button>
              <% } %>
            </div>
            <div id="setting-feedback-<%= field.key %>" class="setting-feedback" aria-live="polite" aria-atomic="true">
              <% if (it.fieldErrors[field.key]) { %><small class="field-message error" role="alert"><i class="ti ti-alert-circle" aria-hidden="true"></i><%= it.fieldErrors[field.key] %></small><% } %>
              <% if (it.channelChecks[field.key]) { %>
                <small class="field-message <%= it.channelChecks[field.key].ok ? 'success' : 'error' %>" role="<%= it.channelChecks[field.key].ok ? 'status' : 'alert' %>"><i class="ti ti-<%= it.channelChecks[field.key].ok ? 'circle-check' : 'alert-circle' %>" aria-hidden="true"></i><%= it.channelChecks[field.key].message %></small>
              <% } else if ((field.discordChannel || field.notionDatabase) && field.configured) { %>
                <small class="field-message neutral"><i class="ti ti-circle-dot" aria-hidden="true"></i>ID設定済み・未確認</small>
              <% } else if (field.secret && field.configured) { %>
                <small class="field-message success"><i class="ti ti-circle-check" aria-hidden="true"></i>設定済み</small>
              <% } %>
            </div>
            <% if (field.input === 'boolean') { %><small id="setting-hint-<%= field.key %>" class="checkbox-hint">変更は「変更を保存」を押すと反映されます。</small><% } %>
            <% if (field.notionDatabase) { %>
              <small class="field-message success client-validation" data-notion-id-extracted-for="<%= field.key %>" role="status" hidden><i class="ti ti-link" aria-hidden="true"></i>URLからデータベースIDを抽出しました。</small>
            <% } %>
            <% if (field.key === 'countdown_notify_days') { %>
              <small id="setting-validation-<%= field.key %>" class="field-message error client-validation" data-client-validation-for="<%= field.key %>" role="alert" hidden><i class="ti ti-alert-circle" aria-hidden="true"></i>0〜3650の整数をカンマ区切りで入力してください。</small>
            <% } %>
            <% if (field.key === 'countdown_message') { %>
              <div class="message-preview compact-preview">
                <div class="preview-heading"><span><i class="ti ti-message" aria-hidden="true"></i>プレビュー</span><small>現在の設定値で表示</small></div>
                <pre><code data-message-preview data-preview-source="setting-countdown_message" data-preview-kind="countdown"></code></pre>
              </div>
            <% } %>
          </div>
        </div>
      <% }) %>
    </div>`,
    { category, fields, csrfToken, fieldErrors, channelChecks }
  );
}

export function renderPracticeTemplate(
  data: {
    status: { message: string };
    preview: string;
    placeholders: string[];
  },
  fields: AdminSettingField[],
  csrfToken: string,
  fieldErrors: Readonly<Record<string, string>> = {}
): string {
  const settings = renderSettingsForm('practice-template', fields, csrfToken, fieldErrors);
  const placeholderOptions = data.placeholders.map((value) => ({
    value,
    label: PRACTICE_PLACEHOLDER_LABELS[value] ?? value,
  }));
  return eta.renderString(
    `<%~ it.settings %>
    <div class="template-status-row">
      <div>
        <strong>テンプレートの状態</strong>
        <p><i class="ti ti-brand-notion" aria-hidden="true"></i><%= it.data.status.message %></p>
      </div>
      <button type="submit" class="button compact secondary" formaction="/admin/actions/reload-template" formmethod="post" formnovalidate>
        <i class="ti ti-refresh" aria-hidden="true"></i>再読込
      </button>
    </div>
    <div class="setting-row textarea-row message-editor-row">
      <div class="setting-copy">
        <label for="practice-template-body">通知本文<span class="requirement">※必須</span></label>
        <small id="practice-template-description">練習連絡として送信する本文です。編集ボタンを押して変更します。</small>
      </div>
      <div class="setting-control">
        <div class="placeholder-toolbar" aria-label="練習連絡のプレースホルダー">
          <span>プレースホルダーを挿入</span>
          <% it.placeholderOptions.forEach(function(item) { %>
            <button type="button" class="placeholder-chip" data-insert-placeholder="{{<%= item.value %>}}" data-target="practice-template-body" disabled><%= item.label %> <code>{{<%= item.value %>}}</code></button>
          <% }) %>
        </div>
        <div class="control-line">
          <textarea id="practice-template-body" name="practice_template_body" aria-describedby="practice-template-description" data-valid-placeholders="<%= it.data.placeholders.join(',') %>" maxlength="20000" required readonly><%= it.data.preview %></textarea>
          <button type="button" class="button compact secondary field-edit-button" data-edit-field aria-controls="practice-template-body" aria-label="通知本文を編集" aria-pressed="false"><i class="ti ti-pencil" aria-hidden="true"></i><span>編集</span></button>
        </div>
        <small class="placeholder-note"><i class="ti ti-info-circle" aria-hidden="true"></i>項目はカーソル位置に挿入され、送信時に実際の内容へ置き換わります。</small>
      </div>
    </div>
    <div class="preview-block message-preview">
      <div class="preview-heading"><span><i class="ti ti-speakerphone" aria-hidden="true"></i>プレビュー</span><small>現在のテンプレートから生成</small></div>
      <pre><code data-message-preview data-preview-source="practice-template-body" data-preview-kind="practice"></code></pre>
    </div>
    <details class="placeholder-help"><summary>利用可能なプレースホルダー</summary><p><%= it.placeholderOptions.map(function(item) { return item.label + ' {{' + item.value + '}}' }).join('、') %></p></details>`,
    { data, settings, csrfToken, placeholderOptions }
  );
}

export function renderAllSettings(sections: {
  practiceDestination: string;
  practiceTemplate: string;
  countdown: string;
  notifications: string;
  advanced: string;
  sesame: string;
  system: string;
  csrfToken: string;
}): string {
  return eta.renderString(
    `<form id="settings-form" class="settings-page-form" method="post" action="/admin/settings">
      <input type="hidden" name="_csrf" value="<%= it.sections.csrfToken %>">
      <aside class="settings-guide" aria-label="設定の変更方法"><i class="ti ti-info-circle" aria-hidden="true"></i><div><strong>設定の変更方法</strong><p>「編集」を押して内容を変更し、「変更を保存」で反映します。送信先やデータベースは「確認」で接続を確認できます。</p></div></aside>
      <section id="practice" class="settings-section">
        <div class="section-heading"><div class="section-icon"><i class="ti ti-speakerphone" aria-hidden="true"></i></div><div><h2>練習連絡</h2><p>練習日程の作成・更新時に、Discordへ通知を送信します。</p></div></div>
        <%~ it.sections.practiceDestination %><%~ it.sections.practiceTemplate %>
      </section>
      <section id="countdown" class="settings-section">
        <div class="section-heading"><div class="section-icon"><i class="ti ti-clock" aria-hidden="true"></i></div><div><h2>カウントダウン</h2><p>本番やイベントまでの日数をDiscordへ通知します。</p></div></div>
        <%~ it.sections.countdown %>
      </section>
      <section id="notifications" class="settings-section">
        <div class="section-heading"><div class="section-icon"><i class="ti ti-bell" aria-hidden="true"></i></div><div><h2>その他の通知</h2><p>場所取り通知と標準のDiscord送信先を設定します。</p></div></div>
        <%~ it.sections.notifications %>
      </section>
      <section id="advanced" class="settings-section">
        <div class="section-heading"><div class="section-icon"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i></div><div><h2>詳細設定</h2><p>Notionのデータ参照先を変更します。誤ったIDを設定すると関連機能が停止する場合があります。</p></div></div>
        <%~ it.sections.advanced %>
      </section>
      <section id="sesame" class="settings-section">
        <div class="section-heading"><div class="section-icon"><i class="ti ti-door" aria-hidden="true"></i></div><div><h2>Sesame</h2><p>スマートロックとの接続と表示メッセージを管理します。</p></div></div>
        <%~ it.sections.sesame %>
      </section>
      <section id="system" class="settings-section">
        <div class="section-heading"><div class="section-icon"><i class="ti ti-shield" aria-hidden="true"></i></div><div><h2>システム</h2><p>動作環境の確認と設定データの再読込を行います。</p></div></div>
        <%~ it.sections.system %>
      </section>
      <div class="save-dock" data-save-dock hidden>
        <div class="save-dock-copy"><i class="ti ti-alert-circle" aria-hidden="true"></i><div><strong>未保存の変更があります</strong><small>変更内容を確認して保存してください。</small></div></div>
        <div class="save-dock-actions"><button type="reset" class="button secondary">変更を破棄</button><button type="submit" class="button primary" data-save-button><span class="button-spinner" aria-hidden="true"></span><i class="ti ti-device-floppy" aria-hidden="true"></i><span data-save-button-label>変更を保存</span></button></div>
      </div>
    </form>`,
    { sections }
  );
}

export function renderSystemSettings(
  status: Record<string, string | boolean>,
  csrfToken: string
): string {
  const labels: Record<string, string> = {
    nodeEnv: '動作環境',
    notionAutomationEnabled: 'Notion Automation',
    sesameEnabled: 'Sesame連携',
    adminEnabled: '管理画面',
    discordTokenConfigured: 'Discord認証情報',
    notionTokenConfigured: 'Notion認証情報',
    relayWebhookConfigured: 'Relay Webhook',
    branch: 'ブランチ',
  };
  const entries = Object.entries(status).map(([key, value]) => ({
    label: labels[key] ?? key,
    value: typeof value === 'boolean' ? (value ? '有効・設定済み' : '無効・未設定') : String(value),
    ok: typeof value === 'boolean' ? value : true,
  }));
  return eta.renderString(
    `<dl class="system-status-grid">
      <% it.entries.forEach(function(entry) { %>
        <div><dt><%= entry.label %></dt><dd class="<%= entry.ok ? 'ok' : 'muted' %>"><i class="ti ti-<%= entry.ok ? 'circle-check' : 'circle-minus' %>" aria-hidden="true"></i><%= entry.value %></dd></div>
      <% }) %>
    </dl>
    <div class="system-actions">
      <button type="submit" class="button secondary" formaction="/admin/actions/reload-config" formmethod="post" formnovalidate><i class="ti ti-refresh" aria-hidden="true"></i>Notionから設定を再読込</button>
      <button type="submit" class="button secondary" formaction="/admin/actions/rotate-login-link" formmethod="post" formnovalidate><i class="ti ti-link" aria-hidden="true"></i>ログインリンクを更新</button>
    </div>`,
    { entries, csrfToken }
  );
}
