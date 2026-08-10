# Settings message editors — design QA

## Evidence

- Selected visual (option 1): `/Users/shun/.codex/generated_images/019fd98d-ce19-7cc1-b725-2549bf9c1845/exec-feca0ea5-8394-4585-851a-0517b8964420.png`
- Implementation capture: `/Users/shun/workdir/glanze-docker/glineze-node-typescript/admin-settings-message-editor-final.jpg`
- Full comparison: `/Users/shun/workdir/glanze-docker/glineze-node-typescript/admin-settings-message-editor-comparison.jpg`
- Focused comparison: `/Users/shun/workdir/glanze-docker/glineze-node-typescript/admin-settings-message-editor-focused-comparison.jpg`
- Desktop viewport: 1440 × 1024 at 1× scale.
- Mobile verification viewport: 390 × 844 at 1× scale.
- Captured state: practice message editor unlocked, placeholder menu open, an unsaved placeholder insertion present, and the save dock visible.

## Comparison passes

### Pass 1

- P1 — After an asynchronous channel check, the edited value was preserved but became the new client-side baseline, hiding the unsaved-change save dock.
- P2 — The placeholder controls needed clearer editable/locked states and the large text editor needed more visual weight.
- Fixes — Preserved the pre-request initial-value map across partial page replacement; kept edited fields unlocked; added disabled/active token styling, a structured placeholder menu, a taller editor, and live previews.

### Pass 2

- No P0, P1, or P2 issues remain.
- P3 — The production screen retains the required destination, Notion page, and template-status rows above the editor, so the editor begins lower than in the concept image. This is an intentional product-fit adaptation of option 1.

## Surface review

- Typography: uses the existing Glineze type hierarchy with compact labels, readable helper text, and monospaced placeholder tokens.
- Spacing/layout: practice destination and template remain together; notification body and preview form one clear editing area; countdown follows the same pattern; mobile width has no horizontal overflow (`390px` viewport and `390px` document width).
- Colors/tokens: existing neutral surfaces and restrained blue editing/focus states are preserved.
- Icons/assets: existing Tabler icons are reused; no substitute emoji, CSS drawings, or handcrafted SVG assets were introduced.
- Copy/content: Japanese placeholder labels are paired with exact raw tokens, and previews use realistic sample values.

## Interaction review

- Practice and countdown bodies are independently locked and unlocked.
- Placeholder buttons insert at the current caret and update the preview immediately.
- Cancelling a field restores its original value.
- A changed field reveals the single sticky `変更を保存` dock.
- The countdown renderer accepts the new `{{title}}` / `{{days}}` form and remains compatible with legacy `{title}` / `{days}` templates.
- Channel verification succeeds without a full reload, does not return to the page top, preserves the edited value and editing state, and keeps the unsaved-change dock visible.
- Desktop and mobile layouts have no horizontal overflow.
- Automated verification: 76 tests passed.

final result: passed
