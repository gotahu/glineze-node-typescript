// DADS v2: https://design.digital.go.jp/dads/
// Local styles follow the official HTML examples without a global CSS framework.
export const ADMIN_STYLES = String.raw`
:root {
  color-scheme: light;
  --dads-blue-50: #e8f1fe;
  --dads-blue-100: #d9e6ff;
  --dads-blue-900: #0017c1;
  --dads-blue-1000: #00118f;
  --dads-blue-1200: #000060;
  --dads-gray-50: #f2f2f2;
  --dads-gray-100: #e6e6e6;
  --dads-gray-300: #b3b3b3;
  --dads-gray-600: #666666;
  --dads-gray-800: #333333;
  --dads-gray-900: #1a1a1a;
  --dads-focus: #ffd43d;
  --admin-sidebar: 256px;
  --admin-blue: var(--dads-blue-900);
  --admin-blue-soft: var(--dads-blue-50);
  --admin-text: var(--dads-gray-900);
  --admin-muted: var(--dads-gray-600);
  --admin-line: var(--dads-gray-300);
  --admin-soft: var(--dads-gray-50);
  --admin-success: #197a4b;
  --admin-danger: #ce0000;
  --admin-warning: #8a6d00;
  --admin-radius: 8px;
  --admin-content: 1120px;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding: 32px 0 200px; }
body {
  margin: 0;
  background: #fff;
  color: var(--admin-text);
  font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
  font-size: 1rem;
  line-height: 1.7;
  letter-spacing: .02em;
  overflow-wrap: anywhere;
}
button, input, textarea, select { font: inherit; letter-spacing: inherit; }
button { cursor: pointer; }
button:disabled { cursor: default; }
button, a, input, textarea, select, summary { -webkit-tap-highlight-color: transparent; }
a { color: var(--admin-blue); text-underline-offset: .2em; }
a:hover { color: var(--dads-blue-1000); text-decoration-thickness: 3px; }
h1, h2, h3, p, dl, pre { margin: 0; }
h1, h2, h3, strong { font-weight: 700; }
small { font-size: 1rem; }
[hidden] { display: none !important; }
:focus-visible {
  outline: 4px solid #000;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--dads-focus);
}
section[tabindex='-1']:focus, main[tabindex='-1']:focus { outline: none; box-shadow: none; }
.ti { flex-shrink: 0; font-size: 24px; }

.skip-link {
  position: fixed;
  z-index: 100;
  top: 12px;
  left: 16px;
  padding: 12px 24px;
  transform: translateY(-200%);
  border-radius: 4px;
  background: var(--dads-focus);
  color: #000;
  font-weight: 700;
}
.skip-link:focus { transform: none; }
.app-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 20;
  display: flex;
  width: var(--admin-sidebar);
  padding: 32px 16px 24px;
  flex-direction: column;
  overflow-y: auto;
  border-right: 1px solid var(--admin-line);
  background: #fff;
}
.app-brand {
  display: flex;
  min-height: 48px;
  margin: 0 8px 32px;
  align-items: center;
  gap: 12px;
  color: var(--admin-text);
  text-decoration: none;
}
.app-brand:hover { color: var(--admin-text); }
.app-brand-mark {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border-radius: 8px;
  background: var(--admin-blue);
  color: #fff;
}
.app-brand-mark .ti { font-size: 28px; }
.app-brand-copy strong { display: block; font-size: 24px; line-height: 1.3; }
.app-brand-copy small { display: block; margin-top: 4px; color: var(--admin-muted); font-size: 14px; }
.primary-nav, .settings-nav { display: grid; gap: 8px; }
.primary-nav a, .settings-nav a, .nav-button {
  display: flex;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 8px 12px;
  align-items: center;
  gap: 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dads-gray-800);
  text-decoration: none;
  text-align: left;
}
.primary-nav a:hover, .settings-nav a:hover, .nav-button:hover {
  background: var(--admin-soft);
  text-decoration: underline;
}
.primary-nav a.active {
  border-left: 4px solid var(--admin-blue);
  padding-left: 8px;
  background: var(--admin-blue-soft);
  color: var(--admin-blue);
  font-weight: 700;
}
.settings-menu { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--dads-gray-100); }
.settings-menu > summary { display: none; }
.settings-nav p { margin: 0 12px 8px; font-weight: 700; }
.settings-nav a { font-size: 1rem; }
.logout-form { margin-top: auto; padding-top: 32px; }

.app-main {
  max-width: calc(var(--admin-content) + 96px);
  min-height: 100vh;
  margin-left: var(--admin-sidebar);
  padding: 32px 48px 240px;
}
.breadcrumbs { display: flex; margin-bottom: 24px; align-items: center; gap: 8px; color: var(--admin-muted); font-size: 14px; }
.breadcrumbs .ti { font-size: 16px; }
.page-heading { display: flex; margin-bottom: 32px; align-items: flex-start; justify-content: space-between; gap: 24px; }
.page-heading h1 { font-size: 2rem; line-height: 1.5; }
.page-heading p { margin-top: 12px; color: var(--dads-gray-800); }
.sync-status { display: inline-flex; margin-top: 12px; align-items: center; gap: 8px; color: var(--admin-muted); font-size: 14px; white-space: nowrap; }
.sync-status .ti { color: var(--admin-success); }

.flash { display: flex; margin-bottom: 24px; padding: 16px 20px; align-items: flex-start; gap: 12px; border: 2px solid; border-radius: var(--admin-radius); }
.flash.success { border-color: var(--admin-success); background: #f3faf6; }
.flash.error { border-color: var(--admin-danger); background: #fff5f5; }
.flash > .ti { margin-top: 2px; }
.flash.success > .ti { color: var(--admin-success); }
.flash.error > .ti { color: var(--admin-danger); }
.flash > span { flex: 1; }
.flash [data-dismiss-flash] { display: grid; width: 44px; min-height: 44px; margin: -8px -8px -8px 0; padding: 8px; place-items: center; border: 0; border-radius: 4px; background: transparent; color: var(--admin-text); }
.flash [data-dismiss-flash]:hover { background: var(--dads-gray-100); }
.settings-guide { display: flex; margin-bottom: 40px; padding: 20px 24px; gap: 16px; border-left: 4px solid var(--admin-blue); background: var(--admin-soft); }
.settings-guide > .ti { color: var(--admin-blue); }
.settings-guide p { margin-top: 4px; color: var(--dads-gray-800); }
.settings-section { scroll-margin-top: 32px; }
.settings-section + .settings-section { margin-top: 56px; }
.section-heading { display: flex; margin-bottom: 24px; align-items: flex-start; gap: 12px; }
.section-heading h2 { font-size: 1.5rem; line-height: 1.5; }
.section-heading p { margin-top: 8px; color: var(--dads-gray-800); }
.section-icon { display: grid; width: 32px; height: 36px; flex: 0 0 32px; place-items: center; color: var(--admin-blue); }
.section-icon .ti { font-size: 28px; }
.setting-row { display: grid; grid-template-columns: 224px minmax(0, 1fr); padding: 24px 0; align-items: start; gap: 24px; border-top: 1px solid var(--dads-gray-100); }
.setting-copy label { display: block; font-weight: 700; }
.setting-copy small { display: block; margin-top: 8px; color: var(--admin-muted); }
.requirement { display: inline-block; margin-left: 8px; color: var(--admin-danger); font-size: 14px; font-weight: 400; }
.setting-control { min-width: 0; }
.control-line { display: flex; align-items: flex-start; gap: 12px; }
.setting-control input:not([type='checkbox']), .setting-control textarea, .setting-control select {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  margin: 0;
  padding: 10px 16px;
  border: 1px solid var(--dads-gray-600);
  border-radius: var(--admin-radius);
  background: #fff;
  color: var(--admin-text);
}
.setting-control input:not([type='checkbox']):hover, .setting-control textarea:hover { border-color: #000; }
.setting-control input[readonly], .setting-control textarea[readonly] { border-style: dashed; background: var(--admin-soft); color: var(--dads-gray-800); cursor: default; }
.setting-row.is-editing .setting-copy label { color: var(--admin-blue); }
.setting-control textarea { min-height: 144px; resize: vertical; line-height: 1.7; }
.field-edit-button { flex-shrink: 0; }
.checkbox-control { display: flex; width: fit-content; min-height: 48px; padding: 8px 0; align-items: center; gap: 12px; cursor: pointer; }
.setting-control input[type='checkbox'] { width: 24px; height: 24px; margin: 0; flex-shrink: 0; accent-color: var(--admin-blue); cursor: pointer; }
.checkbox-state { color: var(--admin-muted); font-size: 14px; }
.checkbox-hint { display: block; margin-top: 8px; color: var(--admin-muted); }
.message-editor-row { grid-template-columns: 1fr; gap: 16px; }
.message-editor-row textarea { min-height: 280px; }

.placeholder-toolbar { display: flex; margin-bottom: 16px; align-items: center; flex-wrap: wrap; gap: 8px; }
.placeholder-toolbar > span { width: 100%; margin-bottom: 4px; color: var(--dads-gray-800); }
.placeholder-chip { min-height: 44px; margin: 0; padding: 6px 12px; border: 1px solid var(--admin-blue); border-radius: 4px; background: #fff; color: var(--admin-blue); font-size: 14px; }
.placeholder-chip code { margin-left: 4px; font-family: "Noto Sans Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; }
.placeholder-chip:hover:not(:disabled) { background: var(--admin-blue-soft); text-decoration: underline; }
.placeholder-chip:disabled { border-color: var(--dads-gray-300); color: var(--admin-muted); background: var(--admin-soft); }
.placeholder-note { display: flex; margin-top: 12px; align-items: flex-start; gap: 8px; color: var(--admin-muted); }
.placeholder-note .ti { color: var(--admin-blue); }

.button { display: inline-flex; width: auto; max-width: 100%; min-width: 96px; min-height: 48px; margin: 0; padding: 10px 16px; align-items: center; justify-content: center; gap: 8px; border: 1px solid; border-radius: 8px; font-weight: 700; line-height: 1.5; text-align: center; text-decoration: none; }
.button.primary { border: 4px double transparent; padding: 7px 13px; background: var(--admin-blue); color: #fff; }
.button.primary:hover { background: var(--dads-blue-1000); color: #fff; text-decoration: underline; }
.button.primary:active { background: var(--dads-blue-1200); }
.button.secondary { border-color: var(--admin-blue); background: #fff; color: var(--admin-blue); }
.button.secondary:hover { background: var(--admin-blue-soft); color: var(--dads-blue-1000); text-decoration: underline; }
.button.secondary:active { background: var(--dads-blue-100); }
.button.compact { min-width: 80px; }
.button:disabled { border-color: var(--dads-gray-300); background: var(--admin-soft); color: var(--admin-muted); }
.button-spinner { display: none; width: 20px; height: 20px; border: 2px solid #b3c6ff; border-top-color: #fff; border-radius: 50%; }
button[data-save-button][aria-busy='true'] { cursor: wait; }
button[data-save-button][aria-busy='true'] .button-spinner { display: inline-block; animation: admin-spin .7s linear infinite; }
button[data-save-button][aria-busy='true'] > .ti { display: none; }
@keyframes admin-spin { to { transform: rotate(360deg); } }

.field-message { display: flex; margin-top: 8px; align-items: flex-start; gap: 8px; }
.field-message .ti { font-size: 20px; margin-top: 3px; }
.field-message.success { color: var(--admin-success); }
.field-message.error { color: var(--admin-danger); }
.field-message.neutral { color: var(--admin-muted); }
.setting-control [aria-invalid='true'] { border-color: var(--admin-danger); border-width: 2px; }
.template-status-row { display: flex; padding: 24px 0; align-items: center; justify-content: space-between; gap: 24px; border-top: 1px solid var(--dads-gray-100); }
.template-status-row p { display: flex; margin-top: 8px; align-items: center; gap: 8px; color: var(--admin-success); }
.message-preview { margin-top: 16px; padding: 24px; border: 1px solid var(--admin-line); border-radius: var(--admin-radius); background: var(--admin-soft); }
.preview-heading { display: flex; margin-bottom: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; }
.preview-heading span { display: flex; align-items: center; gap: 8px; font-weight: 700; }
.preview-heading .ti { color: var(--admin-blue); }
.preview-heading small { color: var(--admin-muted); font-size: 14px; }
.message-preview pre { min-height: 96px; padding: 16px; border-left: 4px solid var(--admin-blue); background: #fff; white-space: pre-wrap; overflow-wrap: anywhere; }
.message-preview code { font: inherit; }
.message-preview .invalid-placeholder { color: var(--admin-danger); font-weight: 700; text-decoration: underline wavy; }
.placeholder-help { margin-top: 24px; }
.placeholder-help summary { width: fit-content; min-height: 48px; padding: 10px 0; color: var(--admin-blue); text-decoration: underline; text-underline-offset: .2em; cursor: pointer; }
.placeholder-help p { margin-top: 8px; padding: 16px; background: var(--admin-soft); }

.system-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--admin-line); }
.system-status-grid > div { padding: 20px 0; border-bottom: 1px solid var(--dads-gray-100); }
.system-status-grid > div:nth-child(odd) { padding-right: 24px; }
.system-status-grid dt { color: var(--admin-muted); }
.system-status-grid dd { display: flex; margin: 8px 0 0; align-items: flex-start; gap: 8px; }
.system-status-grid dd.ok .ti { color: var(--admin-success); }
.system-status-grid dd.muted { color: var(--admin-muted); }
.system-actions { display: flex; margin-top: 24px; flex-wrap: wrap; gap: 16px; }
.save-dock { position: fixed; z-index: 30; right: 0; bottom: 0; left: var(--admin-sidebar); display: flex; padding: 20px 32px; padding-bottom: max(20px, env(safe-area-inset-bottom)); align-items: center; justify-content: space-between; gap: 24px; border-top: 2px solid var(--admin-blue); background: #fff; box-shadow: 0 -2px 8px #00000014; }
.save-dock-copy { display: flex; align-items: center; gap: 12px; }
.save-dock-copy > .ti { color: var(--admin-warning); }
.save-dock-copy strong, .save-dock-copy small { display: block; }
.save-dock-copy small { color: var(--admin-muted); font-size: 14px; }
.save-dock-actions { display: flex; flex-shrink: 0; gap: 16px; }

.dashboard-content { display: grid; gap: 40px; }
.health-summary { display: flex; padding: 24px; align-items: flex-start; gap: 16px; border: 2px solid var(--admin-line); border-radius: var(--admin-radius); }
.health-summary[data-state='operational'] { border-color: var(--admin-success); background: #f3faf6; }
.health-summary[data-state='degraded'] { border-color: var(--admin-warning); background: #fffbe6; }
.health-summary[data-state='offline'] { border-color: var(--admin-danger); background: #fff5f5; }
.health-summary h2 { font-size: 1.5rem; line-height: 1.5; }
.health-summary p { margin-top: 8px; }
.health-summary small { display: block; margin-top: 12px; color: var(--admin-muted); font-size: 14px; }
.health-summary > .ti { margin-top: 4px; font-size: 32px; }
.health-summary[data-state='operational'] > .ti { color: var(--admin-success); }
.health-summary[data-state='degraded'] > .ti { color: var(--admin-warning); }
.health-summary[data-state='offline'] > .ti { color: var(--admin-danger); }
.dashboard-section-heading { display: flex; margin-bottom: 24px; align-items: center; justify-content: space-between; gap: 16px; }
.dashboard-section-heading h2, .dashboard-content section > h2 { font-size: 1.5rem; }
.metrics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.metric { padding: 24px; border: 1px solid var(--admin-line); border-radius: var(--admin-radius); }
.metric dt { color: var(--admin-muted); }
.metric dd { margin: 12px 0 0; font-size: 1.5rem; font-weight: 700; line-height: 1.5; }
.service-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.service-card { padding: 24px; border: 1px solid var(--admin-line); border-radius: var(--admin-radius); }
.service-card-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.service-card h3 { font-size: 1.125rem; }
.service-card p { margin-top: 16px; color: var(--dads-gray-800); }
.status-label { display: inline-flex; padding: 2px 10px; align-items: center; gap: 6px; border: 1px solid currentColor; border-radius: 4px; color: var(--admin-muted); font-size: 14px; }
.status-label .ti { font-size: 18px; }
.status-label[data-state='operational'] { color: var(--admin-success); }
.status-label[data-state='degraded'] { color: var(--admin-warning); }
.status-label[data-state='offline'] { color: var(--admin-danger); }
.dashboard-details { margin-top: 24px; border-top: 1px solid var(--admin-line); }
.dashboard-details > div { display: grid; grid-template-columns: 240px minmax(0, 1fr); padding: 20px 0; gap: 24px; border-bottom: 1px solid var(--dads-gray-100); }
.dashboard-details dt { color: var(--admin-muted); }
.dashboard-details dd { margin: 0; }
.dashboard-details .error { color: var(--admin-danger); }
.auth-shell .app-sidebar { position: static; width: 100%; padding: 24px 32px; border-right: 0; border-bottom: 1px solid var(--admin-line); }
.auth-shell .app-brand { margin: 0; }
.auth-shell .app-main { max-width: 784px; min-height: auto; margin: 0 auto; padding: 48px 32px; }
.auth-guidance { padding: 24px; border-left: 4px solid var(--admin-blue); background: var(--admin-soft); }
.auth-guidance h2 { margin-bottom: 16px; font-size: 1.25rem; }

@media (max-width: 1100px) {
  :root { --admin-sidebar: 224px; }
  .app-main { padding-right: 32px; padding-left: 32px; }
  .setting-row { grid-template-columns: 1fr; gap: 16px; }
  .setting-copy small { max-width: 65ch; }
  .save-dock { flex-wrap: wrap; gap: 16px; }
  .save-dock-actions { margin-left: auto; }
}
@media (max-width: 760px) {
  :root { --admin-sidebar: 0px; }
  .app-sidebar { position: static; display: grid; grid-template-columns: minmax(0, 1fr) auto; width: 100%; padding: 20px; gap: 16px; border-right: 0; border-bottom: 1px solid var(--admin-line); overflow: visible; }
  .app-brand { margin: 0; }
  .app-brand-copy strong { font-size: 20px; }
  .primary-nav { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .settings-menu { grid-column: 1 / -1; margin-top: 0; padding-top: 8px; }
  .settings-menu > summary { display: list-item; min-height: 48px; padding: 8px; color: var(--admin-blue); font-weight: 700; cursor: pointer; }
  .settings-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); padding-top: 8px; }
  .settings-nav p { display: none; }
  .settings-nav a { gap: 8px; padding: 8px; }
  .logout-form { grid-column: 2; grid-row: 1; margin: 0; padding: 0; }
  .nav-button { width: auto; padding: 8px; gap: 8px; }
  .app-main { margin-left: 0; padding: 24px 20px 260px; }
  .page-heading { flex-direction: column; gap: 8px; }
  .page-heading h1 { font-size: 1.75rem; }
  .sync-status { margin-top: 0; }
  .settings-guide { padding: 16px; }
  .control-line { flex-wrap: wrap; }
  .control-line > input:not([type='checkbox']), .control-line > textarea, .control-line > select { flex-basis: 100%; }
  .message-preview { padding: 16px; }
  .system-status-grid, .service-grid, .metrics-grid { grid-template-columns: 1fr; }
  .system-status-grid > div:nth-child(odd) { padding-right: 0; }
  .save-dock { left: 0; padding: 16px 20px; padding-bottom: max(16px, env(safe-area-inset-bottom)); gap: 12px; }
  .save-dock-copy small { display: none; }
  .save-dock-actions { width: 100%; margin-left: 0; gap: 12px; }
  .save-dock-actions .button { flex: 1; }
  .dashboard-section-heading { flex-wrap: wrap; }
  .dashboard-details > div { grid-template-columns: 1fr; gap: 8px; }
  .health-summary { padding: 20px 16px; gap: 12px; }
}
@media (max-width: 360px) {
  .app-sidebar, .app-main { padding-right: 16px; padding-left: 16px; }
  .settings-nav { grid-template-columns: 1fr; }
  .logout-form .ti { display: none; }
  .save-dock { padding-right: 12px; padding-left: 12px; }
  .save-dock-actions .button { padding: 8px; }
  .save-dock-actions .ti { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .button-spinner { animation: none; }
}
@media (forced-colors: active) {
  :focus-visible { outline-color: Highlight; }
  .primary-nav a.active { border-color: Highlight; }
  .button.primary { border: 1px solid ButtonText; }
  .setting-control input[type='checkbox'] { accent-color: auto; }
}
`;
