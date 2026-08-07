import { Eta } from 'eta';
import { AdminSettingField } from './adminConsoleService';

const eta = new Eta({ autoEscape: true, cache: true });

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
  <title><%= it.title %> | Glineze 管理画面</title>
  <link rel="stylesheet" href="/admin/assets/pico.min.css">
  <script src="/admin/assets/admin.js" defer></script>
</head>
<body>
  <header class="container">
    <nav>
      <ul><li><strong>Glineze 管理画面</strong></li></ul>
      <% if (it.authenticated) { %>
      <ul>
        <li><a href="/admin">稼働状況</a></li>
        <li><a href="/admin/settings">設定</a></li>
      </ul>
      <% } %>
    </nav>
  </header>
  <main class="container">
    <h1><%= it.title %></h1>
    <% if (it.notice) { %><aside role="status"><%= it.notice %></aside><% } %>
    <% if (it.error) { %><aside role="alert"><%= it.error %></aside><% } %>
    <%~ it.content %>
  </main>
  <% if (it.authenticated) { %>
  <footer class="container">
    <form method="post" action="/admin/logout">
      <input type="hidden" name="_csrf" value="<%= it.csrfToken %>">
      <button type="submit" class="secondary outline">ログアウト</button>
    </form>
  </footer>
  <% } %>
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
    `<form method="post" action="/admin/settings/<%= it.category %>">
      <input type="hidden" name="_csrf" value="<%= it.csrfToken %>">
      <% it.fields.forEach(function(field) { %>
        <label for="setting-<%= field.key %>"><%= field.label %></label>
        <small><%= field.description %></small>
        <% if (it.fieldErrors[field.key]) { %><small role="alert"><%= it.fieldErrors[field.key] %></small><% } %>
        <% if (it.channelChecks[field.key]) { %>
          <small role="<%= it.channelChecks[field.key].ok ? 'status' : 'alert' %>"><%= it.channelChecks[field.key].message %></small>
        <% } %>
        <% if (field.input === 'textarea') { %>
          <textarea id="setting-<%= field.key %>" name="<%= field.key %>" required><%= field.value || '' %></textarea>
        <% } else { %>
          <input
            id="setting-<%= field.key %>"
            name="<%= field.key %>"
            type="<%= field.input === 'secret' ? 'password' : field.input %>"
            value="<%= field.secret ? '' : (field.value || '') %>"
            placeholder="<%= field.secret && field.configured ? '設定済み（変更時のみ入力）' : '' %>"
            <%= field.secret ? '' : 'required' %>
            autocomplete="off"
          >
        <% } %>
        <% if (field.discordChannel) { %>
          <button
            type="submit"
            class="secondary outline"
            formaction="/admin/actions/verify-channel"
            formmethod="post"
            formnovalidate
            name="_verify"
            value="<%= field.key %>"
          >チャンネルIDを確認</button>
        <% } %>
      <% }) %>
      <button type="submit">設定を保存</button>
    </form>`,
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
  return eta.renderString(
    `<section><h3>テンプレート参照先</h3><%~ it.settings %></section>
    <section><h3>現在の状態</h3><p><%= it.data.status.message %></p>
      <form method="post" action="/admin/actions/reload-template">
        <input type="hidden" name="_csrf" value="<%= it.csrfToken %>">
        <button type="submit" class="secondary">テンプレートを再読込</button>
      </form>
    </section>
    <section><h3>プレビュー</h3><pre><code><%= it.data.preview %></code></pre></section>
    <section><h3>利用可能なプレースホルダー</h3><p><%= it.data.placeholders.map(function(value) { return '{{' + value + '}}' }).join('、') %></p></section>`,
    { data, settings, csrfToken }
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
}): string {
  return eta.renderString(
    `<p>すべての設定をこの画面から変更できます。</p>
    <section id="practice"><h2>練習連絡</h2><h3>送信先</h3><%~ it.sections.practiceDestination %><%~ it.sections.practiceTemplate %></section>
    <hr>
    <section id="countdown"><h2>カウントダウン</h2><%~ it.sections.countdown %></section>
    <hr>
    <section id="notifications"><h2>その他の通知先</h2><%~ it.sections.notifications %></section>
    <hr>
    <section id="advanced"><h2>詳細設定</h2><p>Notion のデータ参照先を変更します。IDを誤ると関連機能が動作しなくなるため注意してください。</p><%~ it.sections.advanced %></section>
    <hr>
    <section id="sesame"><h2>Sesame</h2><%~ it.sections.sesame %></section>
    <hr>
    <section id="system"><h2>システム</h2><%~ it.sections.system %></section>`,
    { sections }
  );
}

export function renderSystemSettings(
  status: Record<string, string | boolean>,
  csrfToken: string
): string {
  return eta.renderString(
    `<dl>
      <% Object.entries(it.status).forEach(function(entry) { %>
        <dt><%= entry[0] %></dt><dd><%= String(entry[1]) %></dd>
      <% }) %>
    </dl>
    <div class="grid">
      <form method="post" action="/admin/actions/reload-config">
        <input type="hidden" name="_csrf" value="<%= it.csrfToken %>">
        <button type="submit">設定を Notion から再読込</button>
      </form>
      <form method="post" action="/admin/actions/rotate-login-link">
        <input type="hidden" name="_csrf" value="<%= it.csrfToken %>">
        <button type="submit" class="secondary">ログインリンクを更新</button>
      </form>
    </div>`,
    { status, csrfToken }
  );
}
