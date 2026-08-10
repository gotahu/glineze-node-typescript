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
  <link rel="stylesheet" href="/admin/assets/pico.min.css">
  <link rel="stylesheet" href="/admin/assets/tabler-icons.css">
  <link rel="stylesheet" href="/admin/assets/admin.css?v=20260807-3">
  <script src="/admin/assets/htmx.min.js" defer></script>
  <script src="/admin/assets/admin.js?v=20260807-3" defer></script>
</head>
<body class="<%= it.authenticated ? 'admin-shell' : 'auth-shell' %>">
  <header class="app-sidebar">
    <a class="app-brand" href="/admin" aria-label="Glineze 管理画面">
      <span class="app-brand-mark"><i class="ti ti-letter-g" aria-hidden="true"></i></span>
      <strong>Glineze</strong>
    </a>
    <% if (it.authenticated) { %>
    <nav class="primary-nav" aria-label="管理画面">
      <a href="/admin" class="<%= it.active === 'dashboard' ? 'active' : '' %>" <%= it.active === 'dashboard' ? 'aria-current="page"' : '' %>>
        <i class="ti ti-activity" aria-hidden="true"></i><span>稼働状況</span>
      </a>
      <a href="/admin/settings" class="<%= it.active === 'settings' ? 'active' : '' %>" <%= it.active === 'settings' ? 'aria-current="page"' : '' %>>
        <i class="ti ti-settings" aria-hidden="true"></i><span>設定</span>
      </a>
    </nav>
    <% if (it.active === 'settings') { %>
    <nav class="settings-nav" aria-label="設定メニュー">
      <p>設定メニュー</p>
      <a href="#practice"><i class="ti ti-speakerphone" aria-hidden="true"></i><span>練習連絡</span></a>
      <a href="#countdown"><i class="ti ti-clock" aria-hidden="true"></i><span>カウントダウン</span></a>
      <a href="#notifications"><i class="ti ti-bell" aria-hidden="true"></i><span>その他の通知</span></a>
      <a href="#advanced"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i><span>詳細設定</span></a>
      <a href="#sesame"><i class="ti ti-door" aria-hidden="true"></i><span>Sesame</span></a>
      <a href="#system"><i class="ti ti-shield" aria-hidden="true"></i><span>システム</span></a>
    </nav>
    <% } %>
    <form class="logout-form" method="post" action="/admin/logout">
      <input type="hidden" name="_csrf" value="<%= it.csrfToken %>">
      <button type="submit" class="nav-button"><i class="ti ti-logout" aria-hidden="true"></i><span>ログアウト</span></button>
    </form>
    <% } %>
  </header>
  <main class="app-main">
    <div class="page-heading">
      <div>
        <h1><%= it.title %></h1>
        <% if (it.active === 'settings') { %><p>Glineze ボットの動作や連携サービスの設定を管理します。</p><% } %>
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
    content: '<p>管理者限定の Notion ページにある最新のリンクからアクセスしてください。</p>',
  });
}

export function renderDashboard(
  snapshot: {
    overall: string;
    generatedAt: string;
    services: Array<{ name: string; label: string; detail: string }>;
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
  return eta.renderString(
    `<section>
      <p><strong>全体状態:</strong> <%= it.snapshot.overall %></p>
      <p>生成日時: <%= it.snapshot.generatedAt %></p>
      <div class="grid">
      <% it.snapshot.services.forEach(function(service) { %>
        <article><h2><%= service.name %></h2><p><strong><%= service.label %></strong></p><p><%= service.detail %></p></article>
      <% }) %>
      </div>
    </section>
    <section>
      <h2>システム</h2>
      <dl>
        <dt>起動日時</dt><dd><%= it.snapshot.system.startedAt %></dd>
        <dt>稼働時間</dt><dd><%= it.snapshot.system.uptimeSeconds %> 秒</dd>
        <dt>本日のリクエスト</dt><dd><%= it.snapshot.system.requestsToday %></dd>
        <dt>設定の最終再読込</dt><dd><%= it.extra.configReloadAt || '未実行' %></dd>
        <dt>設定再読込エラー</dt><dd><%= it.extra.configReloadError || 'なし' %></dd>
        <dt>ログインリンク有効期限</dt><dd><%= it.extra.loginLinkExpiresAt || '未発行' %></dd>
        <dt>次回リンク更新</dt><dd><%= it.extra.loginLinkNextRotationAt || 'Cron 設定に従う' %></dd>
        <dt>リンク更新エラー</dt><dd><%= it.extra.loginLinkError || 'なし' %></dd>
      </dl>
    </section>`,
    { snapshot, extra }
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
            <label for="setting-<%= field.key %>"><%= field.label %></label>
            <small><%= field.description %></small>
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
                <label class="toggle-control" for="setting-<%= field.key %>">
                  <input id="setting-<%= field.key %>" name="<%= field.key %>" type="checkbox" value="true" data-setting-toggle <%= field.value === 'true' ? 'checked' : '' %>>
                  <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                  <span class="toggle-state" data-toggle-state><%= field.value === 'true' ? '有効' : '無効' %></span>
                </label>
              <% } else if (field.input === 'textarea') { %>
                <textarea id="setting-<%= field.key %>" name="<%= field.key %>" <% if (field.key === 'countdown_message') { %>data-valid-placeholders="title,days"<% } %> required readonly><%= field.value || '' %></textarea>
              <% } else { %>
                <input
                  id="setting-<%= field.key %>"
                  name="<%= field.key %>"
                  type="<%= field.input === 'secret' ? 'password' : field.input %>"
                  value="<%= field.secret ? '' : (field.value || '') %>"
                  placeholder="<%= field.secret && field.configured ? '設定済み（変更時のみ入力）' : '' %>"
                  <%= field.secret ? '' : 'required' %>
                  autocomplete="off"
                  <% if (field.key === 'countdown_notify_days') { %>data-validate-notify-days aria-describedby="setting-validation-<%= field.key %>"<% } %>
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
                  hx-post="/admin/actions/verify-notion-database"
                  hx-include="#settings-form"
                  hx-target="#setting-feedback-<%= field.key %>"
                  hx-select="#setting-feedback-<%= field.key %>"
                  hx-swap="outerHTML"
                >確認</button>
              <% } %>
            </div>
            <div id="setting-feedback-<%= field.key %>" class="setting-feedback">
              <% if (it.fieldErrors[field.key]) { %><small class="field-message error" role="alert"><i class="ti ti-alert-circle" aria-hidden="true"></i><%= it.fieldErrors[field.key] %></small><% } %>
              <% if (it.channelChecks[field.key]) { %>
                <small class="field-message <%= it.channelChecks[field.key].ok ? 'success' : 'error' %>" role="<%= it.channelChecks[field.key].ok ? 'status' : 'alert' %>"><i class="ti ti-<%= it.channelChecks[field.key].ok ? 'circle-check' : 'alert-circle' %>" aria-hidden="true"></i><%= it.channelChecks[field.key].message %></small>
              <% } else if ((field.discordChannel || field.notionDatabase) && field.configured) { %>
                <small class="field-message neutral"><i class="ti ti-circle-dot" aria-hidden="true"></i>ID設定済み・未確認</small>
              <% } else if (field.secret && field.configured) { %>
                <small class="field-message success"><i class="ti ti-circle-check" aria-hidden="true"></i>設定済み</small>
              <% } %>
            </div>
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
        <label for="practice-template-body">通知本文</label>
        <small>練習連絡として送信する本文です。編集ボタンを押して変更します。</small>
      </div>
      <div class="setting-control">
        <div class="placeholder-toolbar" aria-label="練習連絡のプレースホルダー">
          <span>プレースホルダーを挿入</span>
          <% it.placeholderOptions.forEach(function(item) { %>
            <button type="button" class="placeholder-chip" data-insert-placeholder="{{<%= item.value %>}}" data-target="practice-template-body" disabled><%= item.label %> <code>{{<%= item.value %>}}</code></button>
          <% }) %>
        </div>
        <div class="control-line">
          <textarea id="practice-template-body" name="practice_template_body" data-valid-placeholders="<%= it.data.placeholders.join(',') %>" maxlength="20000" required readonly><%= it.data.preview %></textarea>
          <button type="button" class="button compact secondary field-edit-button" data-edit-field aria-controls="practice-template-body" aria-pressed="false"><i class="ti ti-pencil" aria-hidden="true"></i><span>編集</span></button>
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
