export const STATUS_STYLES = String.raw`
:root {
  color-scheme: light;
  --blue: #0017c1;
  --blue-hover: #000082;
  --blue-light: #eef4ff;
  --text: #1a1a1a;
  --muted: #595959;
  --line: #b3b3b3;
  --subtle-line: #e5e5e5;
  --background: #f5f5f5;
  --green: #006e54;
  --green-light: #e6f5ee;
  --amber: #806000;
  --amber-light: #fff8df;
  --red: #c00000;
  --red-light: #fff0f0;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 24px; }
body {
  margin: 0;
  background: white;
  color: var(--text);
  font-family: "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
button, select, input { font: inherit; }
a { color: var(--blue); text-underline-offset: .2em; }
a:hover { color: var(--blue-hover); text-decoration-thickness: 2px; }
:focus-visible { outline: 3px solid #1a1a1a; outline-offset: 2px; box-shadow: 0 0 0 5px #ffd43d; }
.skip-link { position: absolute; top: -100px; left: 16px; z-index: 10; padding: 12px 20px; background: #ffd43d; color: #1a1a1a; }
.skip-link:focus { top: 8px; }
.site-header { border-bottom: 1px solid var(--subtle-line); }
.header-inner, .shell { width: min(100% - 64px, 1120px); margin: 0 auto; }
.header-inner { min-height: 88px; display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.brand { color: var(--text); text-decoration: none; display: flex; align-items: baseline; gap: 20px; }
.brand-name { font-size: 28px; font-weight: 700; letter-spacing: -.04em; }
.brand-context { padding-left: 20px; border-left: 1px solid var(--line); font-size: 14px; color: var(--muted); }
.header-nav { display: flex; gap: 28px; font-size: 14px; }
.shell { padding: 48px 0 0; }
.eyebrow { margin: 0 0 8px; color: var(--blue); font-size: 14px; font-weight: 700; letter-spacing: .04em; }
h1 { margin: 0; font-size: clamp(28px, 4vw, 36px); line-height: 1.5; letter-spacing: .02em; }
.page-description { margin: 12px 0 32px; color: var(--muted); }
.hero { border: 1px solid var(--line); border-left: 6px solid var(--muted); padding: 24px 28px; background: var(--background); }
.hero h2 { margin: 0 0 4px; font-size: 24px; line-height: 1.5; }
.hero p { margin: 0; }
.hero[data-state="operational"] { border-color: var(--green); background: var(--green-light); }
.hero[data-state="degraded"], .hero[data-state="unavailable"] { border-color: var(--amber); background: var(--amber-light); }
.hero[data-state="offline"] { border-color: var(--red); background: var(--red-light); }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 24px; padding: 24px 0 28px; }
.last-updated { color: var(--muted); font-size: 14px; }
.last-updated time { display: block; color: var(--text); font-size: 16px; font-variant-numeric: tabular-nums; }
.update-options { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.auto-refresh-label { min-height: 48px; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; }
.auto-refresh-label input { width: 24px; height: 24px; margin: 0; accent-color: var(--blue); cursor: pointer; }
.interval-select { min-height: 48px; border: 1px solid var(--muted); border-radius: 4px; color: var(--text); background: white; padding: 8px 12px; }
.interval-select:disabled { color: var(--muted); background: var(--background); cursor: not-allowed; }
.refresh-button { min-height: 48px; padding: 10px 24px; border: 1px solid var(--blue); border-radius: 4px; background: var(--blue); color: white; font-weight: 700; cursor: pointer; }
.refresh-button:hover { background: var(--blue-hover); border-color: var(--blue-hover); text-decoration: underline; text-underline-offset: .2em; }
.refresh-button[aria-busy="true"] { cursor: wait; }
.refresh-message { margin: 0 0 28px; padding: 12px 16px; border-left: 4px solid var(--amber); background: var(--amber-light); }
.refresh-message:empty { display: none; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.section-heading h2, .panel-title { margin: 0; font-size: 24px; line-height: 1.5; }
.section-note { color: var(--muted); font-size: 14px; }
.services { padding: 16px 0 0; }
.service-list { margin: 0; padding: 0; list-style: none; border-top: 2px solid var(--text); }
.service-row { display: grid; grid-template-columns: minmax(150px, 1fr) 112px minmax(0, 1.4fr); align-items: center; gap: 24px; padding: 24px 20px; border-bottom: 1px solid var(--subtle-line); }
.service-name { font-weight: 700; }
.service-state { display: inline-flex; justify-content: center; align-items: center; min-height: 32px; padding: 2px 12px; border: 1px solid currentColor; border-radius: 4px; font-size: 14px; font-weight: 700; color: var(--muted); background: var(--background); }
.service-row[data-state="operational"] .service-state { color: var(--green); background: var(--green-light); }
.service-row[data-state="degraded"] .service-state { color: var(--amber); background: var(--amber-light); }
.service-row[data-state="offline"] .service-state { color: var(--red); background: var(--red-light); }
.service-detail { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.service-detail span + span { color: var(--muted); font-size: 14px; align-self: center; }
.activity-section { margin-top: 48px; padding-top: 40px; border-top: 1px solid var(--subtle-line); }
.activity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.activity-grid .panel { border: 1px solid var(--line); border-radius: 4px; padding: 24px; }
.panel-title { font-size: 18px; margin-bottom: 20px; }
.activity-row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 8px 0; }
.activity-value { display: inline-flex; align-items: baseline; gap: 8px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.activity-value strong { font-size: 32px; line-height: 1.5; }
.activity-value > span { color: var(--muted); font-size: 14px; }
.reaction-list { display: flex; flex-wrap: wrap; gap: 12px; }
.reaction { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border: 1px solid var(--subtle-line); border-radius: 4px; font-variant-numeric: tabular-nums; }
.reaction-emoji { font-size: 24px; }
.reaction-count { font-weight: 700; }
.empty-state { color: var(--muted); }
.system-details { margin-top: 32px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.system-details summary { min-height: 64px; padding: 16px 20px; font-weight: 700; cursor: pointer; }
.system-details summary:hover { background: var(--background); }
.system-details .panel { padding: 0 24px 24px; }
.system-description { color: var(--muted); font-size: 14px; margin: 0 0 16px; }
.metric-list { margin: 0; }
.metric-row { display: flex; justify-content: space-between; align-items: baseline; gap: 24px; border-top: 1px solid var(--subtle-line); padding: 16px 0; }
.metric-label { color: var(--muted); }
.metric-value { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
.footer { margin-top: 48px; padding: 24px 0 32px; border-top: 1px solid var(--subtle-line); color: var(--muted); font-size: 14px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 24px; }
.live-region { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@media (max-width: 800px) {
  .header-inner, .shell { width: calc(100% - 48px); }
  .controls { align-items: flex-start; }
  .activity-grid { gap: 20px; }
  .service-row { gap: 16px; padding-inline: 12px; grid-template-columns: minmax(120px, 1fr) 96px minmax(0, 1fr); }
  .service-detail { display: block; }
  .service-detail span { display: block; }
}
@media (max-width: 600px) {
  .header-inner, .shell { width: calc(100% - 32px); }
  .header-inner { min-height: 76px; }
  .brand { gap: 12px; }
  .brand-name { font-size: 24px; }
  .brand-context { padding-left: 12px; font-size: 14px; }
  .header-nav { display: none; }
  .shell { padding-top: 32px; }
  .page-description { margin-bottom: 24px; }
  .hero { padding: 20px 18px; }
  .hero h2 { font-size: 20px; }
  .controls { display: block; padding: 20px 0 24px; }
  .update-options { gap: 12px; margin-top: 12px; }
  .auto-refresh-label { margin-right: auto; }
  .interval-select { flex: 1 1 120px; }
  .refresh-button { flex: 1 1 120px; padding-inline: 16px; }
  .section-heading { display: block; }
  .section-heading h2 { font-size: 22px; }
  .section-note { display: block; margin-top: 8px; }
  .service-row { grid-template-columns: minmax(0, 1fr) 96px; gap: 8px 16px; padding: 20px 4px; }
  .service-detail { grid-column: 1 / -1; }
  .service-detail span { display: inline; }
  .service-detail span + span { margin-left: 12px; }
  .activity-section { margin-top: 32px; padding-top: 28px; }
  .activity-grid { grid-template-columns: 1fr; gap: 16px; }
  .activity-grid .panel { padding: 20px; }
  .system-details .panel { padding-inline: 16px; }
  .metric-row { display: block; }
  .metric-value { margin-top: 4px; text-align: left; }
  .footer { margin-top: 32px; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
`;
