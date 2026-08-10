export const ADMIN_STYLES = String.raw`
:root {
  --admin-sidebar: 260px;
  --admin-blue: #4355d9;
  --admin-blue-soft: #eef0ff;
  --admin-text: #171a23;
  --admin-muted: #687080;
  --admin-line: #e3e6ec;
  --admin-soft: #f7f8fa;
  --admin-success: #278a57;
  --admin-danger: #c63e47;
  --admin-warning: #9b6719;
  --admin-radius: 9px;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 28px; }
body {
  margin: 0;
  background: #fff;
  color: var(--admin-text);
  font-family: Inter, "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", sans-serif;
  font-size: 15px;
  line-height: 1.55;
}

.app-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 20;
  display: flex;
  width: var(--admin-sidebar);
  padding: 28px 16px 20px;
  flex-direction: column;
  border-right: 1px solid var(--admin-line);
  background: #fbfbfc;
}

.app-brand {
  display: flex;
  min-height: 44px;
  margin: 0 10px 30px;
  align-items: center;
  gap: 11px;
  color: var(--admin-text);
  font-size: 20px;
  text-decoration: none;
}

.app-brand:hover { color: var(--admin-text); }
.app-brand-mark {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border-radius: 50%;
  background: var(--admin-blue);
  color: #fff;
  font-size: 20px;
}

.primary-nav,
.settings-nav { display: grid; gap: 5px; }
.primary-nav a,
.settings-nav a,
.nav-button {
  display: flex;
  width: 100%;
  min-height: 45px;
  margin: 0;
  padding: 0 13px;
  align-items: center;
  gap: 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  box-shadow: none;
  color: #343945;
  font-size: 14px;
  font-weight: 550;
  text-decoration: none;
}

.primary-nav a:hover,
.settings-nav a:hover,
.nav-button:hover { background: #f0f1f5; color: var(--admin-text); }
.primary-nav a.active {
  position: relative;
  background: var(--admin-blue-soft);
  color: #3346c4;
}
.primary-nav a.active::after {
  position: absolute;
  inset: 0 0 0 auto;
  width: 3px;
  border-radius: 3px 0 0 3px;
  background: var(--admin-blue);
  content: "";
}
.primary-nav .ti,
.settings-nav .ti,
.nav-button .ti { width: 21px; font-size: 19px; text-align: center; }
.settings-nav { margin-top: 34px; }
.settings-nav p {
  margin: 0 13px 8px;
  color: #8b91a0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .04em;
}
.settings-nav a { min-height: 40px; font-size: 13px; }
.settings-nav a:focus-visible { outline: 2px solid var(--admin-blue); outline-offset: 1px; }
.logout-form { margin: auto 0 0; }
.logout-form input { display: none; }
.nav-button { color: var(--admin-muted); }

.app-main {
  width: auto;
  max-width: none;
  min-height: 100vh;
  margin-left: var(--admin-sidebar);
  padding: 38px 42px 130px;
  outline: none;
}

.page-heading {
  display: flex;
  max-width: 1160px;
  margin: 0 auto 38px;
  padding-bottom: 38px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  border-bottom: 1px solid var(--admin-line);
}
.page-heading h1 { margin: 0; color: var(--admin-text); font-size: 31px; line-height: 1.2; letter-spacing: -.035em; }
.page-heading p { margin: 14px 0 0; color: var(--admin-muted); font-size: 14px; }
.sync-status {
  display: inline-flex;
  margin-top: 8px;
  align-items: center;
  gap: 7px;
  color: var(--admin-muted);
  font-size: 13px;
  white-space: nowrap;
}
.sync-status .ti { color: var(--admin-success); font-size: 19px; }

.flash {
  display: flex;
  max-width: 1160px;
  margin: -12px auto 24px;
  padding: 12px 14px;
  align-items: center;
  gap: 9px;
  border: 1px solid;
  border-radius: var(--admin-radius);
  font-size: 13px;
}
.flash.success { border-color: #bfe5cf; background: #f0fbf5; color: #226c48; }
.flash.error { border-color: #f0c5c8; background: #fff5f5; color: #a42e37; }
.flash > span { flex: 1; }
.flash [data-dismiss-flash] {
  display: grid;
  width: 30px;
  height: 30px;
  margin: -5px -6px -5px auto;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: currentColor;
}
.flash [data-dismiss-flash]:hover { background: rgba(0, 0, 0, .05); }

.settings-page-form { max-width: 1160px; margin: 0 auto; }
.settings-section { margin: 0; padding: 0 0 16px; scroll-margin-top: 24px; }
.settings-section + .settings-section { margin-top: 24px; padding-top: 36px; border-top: 1px solid var(--admin-line); }
.section-heading { display: flex; margin-bottom: 9px; align-items: flex-start; gap: 13px; }
.section-heading h2 { margin: 0; color: var(--admin-text); font-size: 21px; line-height: 1.35; letter-spacing: -.02em; }
.section-heading p { margin: 5px 0 0; color: var(--admin-muted); font-size: 13px; }
.section-icon { display: grid; width: 28px; height: 28px; margin-top: 1px; place-items: center; color: #313642; font-size: 23px; }

.settings-fields { margin-left: 4px; }
.setting-row {
  display: grid;
  grid-template-columns: 204px minmax(0, 1fr);
  min-height: 120px;
  padding: 23px 12px;
  align-items: start;
  gap: 11px;
  border-top: 1px solid var(--admin-line);
}
.setting-copy label { display: block; margin: 1px 0 4px; color: #242832; font-size: 13px; font-weight: 700; }
.setting-copy small { display: block; max-width: 195px; color: var(--admin-muted); font-size: 12px; line-height: 1.55; }
.setting-control { min-width: 0; }
.control-line { display: flex; align-items: flex-start; gap: 12px; }
.setting-control input,
.setting-control textarea,
.setting-control select {
  min-width: 0;
  height: 43px;
  margin: 0;
  padding: 9px 12px;
  border: 1px solid #ccd1db;
  border-radius: 7px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(21, 27, 38, .03);
  color: var(--admin-text);
  font-size: 14px;
}
.setting-control input:focus,
.setting-control textarea:focus,
.setting-control select:focus { border-color: var(--admin-blue); box-shadow: 0 0 0 3px rgba(67, 85, 217, .12); }
.setting-control input[readonly],
.setting-control textarea[readonly] {
  border-color: #e0e3e9;
  background: #f6f7f9;
  box-shadow: none;
  color: #5f6673;
  cursor: default;
}
.setting-row.is-editing { background: #fafaff; }
.setting-row.is-editing .setting-copy label { color: var(--admin-blue); }
.field-edit-button { flex: 0 0 auto; }
.setting-row.is-editing .field-edit-button { border-color: #bfc5d1; background: #f8f9fb; }
.setting-control textarea { min-height: 96px; resize: vertical; }
.toggle-control {
  display: inline-flex;
  min-height: 43px;
  margin: 0;
  align-items: center;
  gap: 10px;
  color: var(--admin-text);
  cursor: pointer;
  user-select: none;
}
.setting-control .toggle-control input[type="checkbox"] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.toggle-track {
  display: inline-flex;
  width: 44px;
  height: 24px;
  padding: 2px;
  align-items: center;
  border-radius: 999px;
  background: #aeb4c0;
  box-shadow: inset 0 0 0 1px rgba(20, 26, 38, .08);
  transition: background-color .18s ease;
}
.toggle-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(20, 26, 38, .3);
  transform: translateX(0);
  transition: transform .18s ease;
}
.toggle-control input:checked + .toggle-track { background: var(--admin-blue); }
.toggle-control input:checked + .toggle-track .toggle-thumb { transform: translateX(20px); }
.toggle-control input:focus-visible + .toggle-track { outline: 3px solid rgba(67, 85, 217, .2); outline-offset: 2px; }
.toggle-state { min-width: 2.5em; font-size: 14px; font-weight: 700; }
.textarea-row { min-height: 160px; }
.setting-row.message-editor-row { min-height: 370px; padding-left: 0; grid-template-columns: 1fr; gap: 12px; }
.message-editor-row textarea { min-height: 250px; line-height: 1.7; }

.placeholder-toolbar {
  display: flex;
  margin: 0 0 8px;
  align-items: center;
  flex-wrap: wrap;
  column-gap: 4px;
  row-gap: 2px;
  transition: opacity .15s ease;
}
.placeholder-toolbar > span { margin-right: 2px; color: var(--admin-muted); font-size: 11px; font-weight: 650; }
.placeholder-chip {
  margin: 0;
  border: 1px solid #d6dae4;
  background: #fff;
  color: #424958;
  font-size: 11px;
  font-weight: 650;
}
.placeholder-chip {
  min-height: 28px;
  padding: 3px 7px;
  border-radius: 6px;
  cursor: pointer;
}
.placeholder-chip code {
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}
.placeholder-chip:hover:not(:disabled) { border-color: #aeb6df; background: var(--admin-blue-soft); color: #3042bd; }
.placeholder-toolbar button:disabled { opacity: .48; cursor: default; }
.setting-row:not(.is-editing) .placeholder-toolbar { opacity: .62; }
.placeholder-note { display: flex; margin-top: 8px; align-items: center; gap: 5px; color: var(--admin-muted); font-size: 11px; }
.placeholder-note .ti { color: var(--admin-blue); font-size: 15px; }

button.button,
.button {
  display: inline-flex;
  width: auto;
  min-width: 0;
  height: 42px;
  margin: 0;
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid transparent;
  border-radius: 7px;
  box-shadow: none;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
button.button.primary { border-color: var(--admin-blue); background: var(--admin-blue); color: #fff; }
button.button.primary:hover { border-color: #3446c7; background: #3446c7; }
button.button.secondary { border-color: #cbd0da; background: #fff; color: #303642; }
button.button.secondary:hover { border-color: #aeb5c2; background: #f8f9fb; }
button.button.compact { height: 41px; padding: 0 16px; }
.button-spinner { display: none; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, .45); border-top-color: #fff; border-radius: 50%; }
button[data-save-button][aria-busy='true'] { opacity: .8; cursor: wait; }
button[data-save-button][aria-busy='true']::before { display: none; }
button[data-save-button][aria-busy='true'] .button-spinner { display: inline-block; animation: admin-spin .7s linear infinite; }
button[data-save-button][aria-busy='true'] > .ti { display: none; }

@keyframes admin-spin {
  to { transform: rotate(360deg); }
}

.field-message { display: flex; margin-top: 8px; align-items: center; gap: 6px; font-size: 12px; }
.field-message.success { color: var(--admin-success); }
.field-message.error { color: var(--admin-danger); }
.field-message.neutral { color: #747c8b; }
.field-message .ti { font-size: 16px; }
.client-validation[hidden] { display: none; }
.setting-control [aria-invalid='true'] { border-color: var(--admin-danger); }

.template-status-row {
  display: flex;
  min-height: 79px;
  margin-left: 4px;
  padding: 16px 12px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid var(--admin-line);
}
.template-status-row strong { font-size: 13px; }
.template-status-row p { display: flex; margin: 5px 0 0; align-items: center; gap: 7px; color: var(--admin-success); font-size: 12px; }
.template-status-row p .ti { font-size: 17px; }

.preview-block {
  min-height: 258px;
  margin: 11px 12px 15px 232px;
  padding: 18px 18px;
  border: 1px solid #d9dde6;
  border-radius: var(--admin-radius);
  background: #fbfcfe;
  box-shadow: 0 1px 2px rgba(21, 27, 38, .03);
}
.message-editor-row + .preview-block { margin-left: 0; }
.preview-heading { display: flex; margin-bottom: 11px; align-items: center; justify-content: space-between; gap: 16px; }
.preview-heading span { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.preview-heading .ti { color: var(--admin-blue); font-size: 20px; }
.preview-heading small { color: #9096a2; font-size: 11px; }
.preview-block pre { min-height: 185px; margin: 0; padding: 17px 18px; border-left: 3px solid var(--admin-blue); border-radius: 3px; background: #fff; color: #303541; white-space: pre-wrap; }
.preview-block code { padding: 0; background: transparent; color: inherit; font-family: inherit; font-size: 13px; line-height: 1.75; }
.message-preview .invalid-placeholder { color: #c62828; font-weight: 800; }
.compact-preview { margin-top: 13px; padding: 13px 14px; border: 1px solid #e0e3ea; border-radius: 8px; background: #fafbfc; }
.compact-preview .preview-heading { margin-bottom: 7px; }
.compact-preview pre { min-height: 62px; margin: 0; padding: 12px 14px; border-left: 3px solid #aeb6df; border-radius: 3px; background: #fff; white-space: pre-wrap; }
.compact-preview code { color: #303541; font-family: inherit; font-size: 12px; line-height: 1.65; }
.placeholder-help { margin: 0 12px 8px 232px; padding: 0; border: 0; }
.placeholder-help summary { color: var(--admin-muted); font-size: 12px; }
.placeholder-help p { color: var(--admin-muted); font-size: 11px; overflow-wrap: anywhere; }

.system-status-grid {
  display: grid;
  margin: 18px 12px 20px 4px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--admin-line);
  border-left: 1px solid var(--admin-line);
}
.system-status-grid > div { padding: 14px 16px; border-right: 1px solid var(--admin-line); border-bottom: 1px solid var(--admin-line); }
.system-status-grid dt { color: var(--admin-muted); font-size: 11px; }
.system-status-grid dd { display: flex; margin: 4px 0 0; align-items: center; gap: 6px; color: #343a46; font-size: 12px; font-weight: 650; }
.system-status-grid dd.ok .ti { color: var(--admin-success); }
.system-status-grid dd.muted { color: #8a909c; }
.system-actions { display: flex; margin-left: 4px; gap: 10px; }

.save-dock {
  position: fixed;
  z-index: 30;
  right: 0;
  bottom: 0;
  left: var(--admin-sidebar);
  display: flex;
  min-height: 108px;
  padding: 18px 42px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-top: 1px solid #d9dde6;
  background: rgba(255, 255, 255, .97);
  box-shadow: 0 -8px 22px rgba(20, 25, 38, .06);
}
.save-dock[hidden] { display: none; }
.save-dock-copy { display: flex; align-items: center; gap: 13px; }
.save-dock-copy > .ti { color: var(--admin-warning); font-size: 25px; }
.save-dock-copy strong,
.save-dock-copy small { display: block; }
.save-dock-copy strong { color: #272c36; font-size: 13px; }
.save-dock-copy small { margin-top: 2px; color: var(--admin-muted); font-size: 11px; }
.save-dock-actions { display: flex; gap: 10px; }

.app-main > section:not(.settings-section),
.app-main > .grid,
.app-main > dl { max-width: 1160px; margin-right: auto; margin-left: auto; }

.auth-shell .app-sidebar { position: static; width: 100%; height: auto; padding: 20px 26px; border-right: 0; border-bottom: 1px solid var(--admin-line); }
.auth-shell .app-brand { margin: 0; }
.auth-shell .app-main { min-height: auto; margin: 0; padding-top: 70px; }
.auth-shell .page-heading { max-width: 720px; }

@media (max-width: 980px) {
  :root { --admin-sidebar: 210px; }
  .app-main { padding-right: 26px; padding-left: 26px; }
  .setting-row { grid-template-columns: 175px minmax(0, 1fr); }
  .preview-block,
  .placeholder-help { margin-left: 215px; }
  .save-dock { padding-right: 26px; padding-left: 26px; }
}

@media (max-width: 760px) {
  :root { --admin-sidebar: 0px; }
  .app-sidebar { position: static; width: 100%; padding: 14px 16px; border-right: 0; border-bottom: 1px solid var(--admin-line); }
  .app-brand { margin: 0 0 12px; }
  .primary-nav { display: flex; }
  .primary-nav a { width: auto; }
  .settings-nav {
    display: flex;
    margin-top: 10px;
    padding-bottom: 2px;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .settings-nav p { display: none; }
  .settings-nav a { width: auto; min-width: max-content; min-height: 36px; padding: 0 10px; gap: 7px; }
  .settings-nav .ti { width: auto; font-size: 16px; }
  .logout-form { position: absolute; top: 14px; right: 14px; }
  .logout-form .nav-button span { display: none; }
  .app-main { margin-left: 0; padding: 26px 18px 120px; }
  .page-heading { display: block; }
  .sync-status { margin-top: 16px; }
  .setting-row { grid-template-columns: 1fr; gap: 12px; }
  .setting-copy small { max-width: none; }
  .settings-fields,
  .template-status-row,
  .system-actions { margin-left: 0; }
  .preview-block,
  .placeholder-help { margin-left: 12px; }
  .system-status-grid { margin-left: 0; grid-template-columns: 1fr; }
  .save-dock { left: 0; padding: 13px 18px; }
  .save-dock-copy small { display: none; }
  .save-dock-actions .button { padding: 0 13px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .button-spinner { animation: none !important; }
}

@media (max-width: 480px) {
  .control-line { flex-wrap: wrap; }
  .message-editor-row textarea { min-height: 220px; }
  .save-dock { min-height: 76px; padding: 12px 14px; gap: 10px; }
  .save-dock-copy div { display: none; }
  .save-dock-copy > .ti { font-size: 22px; }
  .save-dock-actions { margin-left: auto; gap: 8px; }
  .save-dock-actions .button { height: 40px; padding: 0 11px; font-size: 12px; }
}
`;
