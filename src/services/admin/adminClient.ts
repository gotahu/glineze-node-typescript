export const ADMIN_CLIENT_JS = String.raw`(() => {
  const adminPath = '/admin';
  const nativeSubmissions = new WeakSet();

  function isAdminLink(link) {
    const url = new URL(link.href, window.location.href);
    return (
      url.origin === window.location.origin &&
      url.pathname.startsWith(adminPath) &&
      !link.hasAttribute('download') &&
      (!link.target || link.target === '_self')
    );
  }

  function setSaveDockVisible(visible) {
    const dock = document.querySelector('[data-save-dock]');
    if (dock) dock.hidden = !visible;
  }

  function setSubmitterBusy(submitter, busy) {
    if (!submitter) return;
    submitter.disabled = busy;
    if (busy) submitter.setAttribute('aria-busy', 'true');
    else submitter.removeAttribute('aria-busy');
    if (!submitter.matches('[data-save-button]')) return;
    const label = submitter.querySelector('[data-save-button-label]');
    if (label) label.textContent = busy ? '保存中…' : '変更を保存';
  }

  function getSettingFields(form) {
    return [...form.querySelectorAll('.setting-row input:not([type="hidden"]), .setting-row textarea, .setting-row select')];
  }

  function getSettingFieldValue(field) {
    return field.matches('input[type="checkbox"]') ? String(field.checked) : field.value;
  }

  function restoreSettingFieldValue(field, value) {
    if (field.matches('input[type="checkbox"]')) field.checked = value === 'true';
    else field.value = value;
    updateToggleState(field);
  }

  function updateToggleState(field) {
    if (!field?.matches('[data-setting-toggle]')) return;
    const state = field.closest('.toggle-control')?.querySelector('[data-toggle-state]');
    if (state) state.textContent = field.checked ? '有効' : '無効';
  }

  function updateSaveDock(form) {
    const dirty = getSettingFields(form).some(
      (field) => getSettingFieldValue(field) !== field.dataset.initialValue
    );
    setSaveDockVisible(dirty);
  }

  const notifyDaysError = '0〜3650の整数をカンマ区切りで入力してください。';

  function extractNotionDatabaseId(value) {
    if (!/^https:\/\//i.test(value.trim())) return undefined;
    try {
      const url = new URL(value.trim());
      const notionHost =
        url.hostname === 'notion.com' ||
        url.hostname.endsWith('.notion.com') ||
        url.hostname === 'notion.so' ||
        url.hostname.endsWith('.notion.so');
      if (!notionHost) return undefined;
      for (const segment of url.pathname.split('/').reverse()) {
        const match = segment.match(/(?:^|-)([0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i);
        if (match?.[1]) return match[1];
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  function normalizeNotionDatabaseField(field) {
    if (!field?.matches('[data-notion-database-id]')) return;
    const id = extractNotionDatabaseId(field.value);
    const message = document.querySelector(
      '[data-notion-id-extracted-for="' + CSS.escape(field.name) + '"]'
    );
    if (message) message.hidden = !id;
    if (id) field.value = id;
  }

  function validateNotifyDays(field) {
    if (!field?.matches('[data-validate-notify-days]')) return true;
    const parts = field.value.trim().split(',').map((item) => item.trim());
    const valid = parts.length > 0 && parts.every((item) => /^\d+$/.test(item) && Number(item) <= 3650);
    field.setCustomValidity(valid ? '' : notifyDaysError);
    field.setAttribute('aria-invalid', String(!valid));
    const message = document.querySelector('[data-client-validation-for="' + CSS.escape(field.name) + '"]');
    if (message) message.hidden = valid;
    return valid;
  }

  function resetSettingsForm(form) {
    if (!(form instanceof HTMLFormElement)) return;
    for (const field of getSettingFields(form)) {
      restoreSettingFieldValue(field, field.dataset.initialValue ?? '');
    }
    for (const row of form.querySelectorAll('.setting-row')) {
      setFieldEditing(row, false);
    }
    for (const details of form.querySelectorAll('details[open]')) details.removeAttribute('open');
    updateAllMessagePreviews(form);
    updateSaveDock(form);
  }

  const practicePreviewValues = {
    accessText: '参加者のみ閲覧できます',
    dateLabel: '8/15(土)',
    endDate: '2026-08-15',
    eventId: 'practice-2026-08-15',
    eventUrl: 'https://discord.com/events/123456789',
    notionUrl: 'https://www.notion.so/example-practice',
    placeText: '市民文化センター 練習室A',
    startDate: '2026-08-15',
    timeText: '18:00〜21:00',
    title: '合奏練習',
    ttText: '基礎合奏・演奏会曲',
  };

  function renderPreviewTemplate(preview, template, kind, validPlaceholders) {
    const values = kind === 'countdown'
      ? { title: '第12回定期演奏会', days: '8' }
      : practicePreviewValues;
    const pattern = /{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}|{\s*(title|days)\s*}/g;
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const match of template.matchAll(pattern)) {
      fragment.append(document.createTextNode(template.slice(cursor, match.index)));
      const key = match[1] || match[2];
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        fragment.append(document.createTextNode(values[key]));
      } else if (validPlaceholders.has(key)) {
        fragment.append(document.createTextNode(match[0]));
      } else {
        const warning = document.createElement('span');
        warning.className = 'invalid-placeholder';
        warning.title = '未対応のプレースホルダー';
        warning.textContent = match[0];
        fragment.append(warning);
      }
      cursor = match.index + match[0].length;
    }

    fragment.append(document.createTextNode(template.slice(cursor)));
    preview.replaceChildren(fragment);
  }

  function updateMessagePreview(source) {
    if (!source?.id) return;
    const preview = document.querySelector('[data-message-preview][data-preview-source="' + CSS.escape(source.id) + '"]');
    if (!preview) return;
    const validPlaceholders = new Set((source.dataset.validPlaceholders || '').split(',').filter(Boolean));
    renderPreviewTemplate(
      preview,
      source.value,
      preview.dataset.previewKind || 'practice',
      validPlaceholders
    );
  }

  function updateAllMessagePreviews(form) {
    if (!(form instanceof HTMLFormElement)) return;
    for (const preview of form.querySelectorAll('[data-message-preview][data-preview-source]')) {
      const source = document.getElementById(preview.dataset.previewSource || '');
      if (source && 'value' in source) updateMessagePreview(source);
    }
  }

  function setFieldEditing(row, enabled, restoreValue = false) {
    const form = row.closest('#settings-form');
    const field = row.querySelector('input:not([type="hidden"]), textarea');
    const button = row.querySelector('[data-edit-field]');
    if (!(form instanceof HTMLFormElement) || !field || !button) return;

    if (restoreValue) field.value = field.dataset.initialValue || '';
    validateNotifyDays(field);
    field.readOnly = !enabled;
    for (const placeholderButton of row.querySelectorAll('[data-insert-placeholder]')) {
      placeholderButton.disabled = !enabled;
    }
    row.classList.toggle('is-editing', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    const icon = button.querySelector('.ti');
    const label = button.querySelector('span');
    if (icon) icon.className = 'ti ' + (enabled ? 'ti-x' : 'ti-pencil');
    if (label) label.textContent = enabled ? 'キャンセル' : '編集';
    if (enabled) field.focus({ preventScroll: true });
    updateMessagePreview(field);
    updateSaveDock(form);
  }

  function initializeSettingsForm(form) {
    if (!(form instanceof HTMLFormElement)) return;
    for (const field of getSettingFields(form)) {
      field.dataset.initialValue = getSettingFieldValue(field);
      if (!field.matches('select, input[type="checkbox"]')) field.readOnly = true;
      updateToggleState(field);
      validateNotifyDays(field);
      field.closest('.setting-row')?.classList.remove('is-editing');
    }
    for (const button of form.querySelectorAll('[data-edit-field]')) {
      button.setAttribute('aria-pressed', 'false');
      const icon = button.querySelector('.ti');
      const label = button.querySelector('span');
      if (icon) icon.className = 'ti ti-pencil';
      if (label) label.textContent = '編集';
    }
    for (const placeholderButton of form.querySelectorAll('[data-insert-placeholder]')) {
      placeholderButton.disabled = true;
    }
    updateAllMessagePreviews(form);
    updateSaveDock(form);
  }

  function restoreUnsavedValues(data) {
    for (const [name, value] of data.entries()) {
      if (typeof value !== 'string' || name === '_csrf' || name === '_verify') continue;
      const field = document.querySelector(
        '.setting-row [name="' + CSS.escape(name) + '"]:not([type="hidden"])'
      );
      if (field && 'value' in field && field.type !== 'password') {
        restoreSettingFieldValue(field, value);
      }
    }
  }

  function restoreScrollPosition(scrollPosition) {
    const restore = () => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      scrollingElement.scrollTop = scrollPosition;
    };
    restore();
    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
    for (const delay of [50, 150, 350]) window.setTimeout(restore, delay);
  }

  function replacePage(html, url, historyMode, scrollPosition) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = parsed.querySelector('main');
    const nextHeader = parsed.querySelector('header');
    if (!nextMain || !nextHeader) throw new Error('管理画面の応答を読み取れませんでした。');

    document.querySelector('header')?.replaceWith(nextHeader);
    document.querySelector('main')?.replaceWith(nextMain);

    const currentFooter = document.querySelector('footer');
    const nextFooter = parsed.querySelector('footer');
    if (currentFooter && nextFooter) currentFooter.replaceWith(nextFooter);
    else if (currentFooter) currentFooter.remove();
    else if (nextFooter) document.body.append(nextFooter);

    document.title = parsed.title;
    if (historyMode === 'push') window.history.pushState({}, '', url);
    if (historyMode === 'replace') window.history.replaceState({}, '', url);

    const preserveScroll = typeof scrollPosition === 'number';
    const hash = new URL(url, window.location.href).hash;
    const target = !preserveScroll && hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    nextMain.setAttribute('tabindex', '-1');
    nextMain.focus({ preventScroll: preserveScroll || Boolean(target) });

    if (preserveScroll) restoreScrollPosition(scrollPosition);
    else if (target) target.scrollIntoView();
    else window.scrollTo({ top: 0 });
  }

  function moveToSection(url, historyMode = 'push') {
    const targetUrl = new URL(url, window.location.href);
    const id = decodeURIComponent(targetUrl.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return false;

    if (historyMode === 'push' && targetUrl.href !== window.location.href) {
      window.history.pushState({}, '', targetUrl.href);
    } else if (historyMode === 'replace') {
      window.history.replaceState({}, '', targetUrl.href);
    }
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
    return true;
  }

  async function loadPage(url, historyMode) {
    const response = await fetch(url, {
      headers: { Accept: 'text/html', 'X-Requested-With': 'fetch' },
      credentials: 'same-origin',
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) throw new Error('HTML以外の応答を受信しました。');
    replacePage(await response.text(), response.url || url, historyMode);
  }

  document.addEventListener('click', (event) => {
    const dismissButton = event.target.closest('[data-dismiss-flash]');
    if (dismissButton) {
      event.preventDefault();
      dismissButton.closest('.flash')?.remove();
      return;
    }

    const placeholderButton = event.target.closest('[data-insert-placeholder]');
    if (placeholderButton) {
      event.preventDefault();
      const target = document.getElementById(placeholderButton.dataset.target || '');
      if (!(target instanceof HTMLTextAreaElement) || target.readOnly || placeholderButton.disabled) return;
      const token = placeholderButton.dataset.insertPlaceholder || '';
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? start;
      target.setRangeText(token, start, end, 'end');
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.focus({ preventScroll: true });
      placeholderButton.closest('details')?.removeAttribute('open');
      return;
    }

    const editButton = event.target.closest('[data-edit-field]');
    if (editButton) {
      event.preventDefault();
      const row = editButton.closest('.setting-row');
      if (!row) return;
      const editing = row.classList.contains('is-editing');
      setFieldEditing(row, !editing, editing);
      return;
    }

    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a');
    if (!link || !isAdminLink(link)) return;

    const targetUrl = new URL(link.href, window.location.href);
    if (
      targetUrl.pathname === window.location.pathname &&
      targetUrl.search === window.location.search &&
      targetUrl.hash
    ) {
      event.preventDefault();
      moveToSection(targetUrl.href);
      return;
    }

    event.preventDefault();
    loadPage(link.href, 'push').catch(() => window.location.assign(link.href));
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (nativeSubmissions.has(form)) {
      nativeSubmissions.delete(form);
      return;
    }

    const submitter = event.submitter;
    if (submitter?.hasAttribute('hx-post')) return;
    const action = submitter?.formAction || form.action;
    const method = (submitter?.formMethod || form.method || 'get').toUpperCase();
    const url = new URL(action, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith(adminPath)) return;

    event.preventDefault();
    const scrollPosition = window.scrollY;
    const data = new FormData(form);
    if (submitter?.name) data.set(submitter.name, submitter.value);
    const body = new URLSearchParams();
    for (const [name, value] of data.entries()) {
      if (typeof value === 'string') body.append(name, value);
    }
    const savesAllSettings = url.pathname === '/admin/settings' && method === 'POST';
    const hadUnsavedChanges = !document.querySelector('[data-save-dock]')?.hidden;
    const initialFieldValues = new Map(
      getSettingFields(form)
        .filter((field) => field.getAttribute('name'))
        .map((field) => [
          field.getAttribute('name'),
          field.dataset.initialValue ?? getSettingFieldValue(field),
        ])
    );
    const editingFieldNames = [...form.querySelectorAll('.setting-row.is-editing [name]')]
      .map((field) => field.getAttribute('name'))
      .filter(Boolean);

    setSubmitterBusy(submitter, true);

    fetch(url, {
      method,
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Requested-With': 'fetch',
      },
      credentials: 'same-origin',
      body: method === 'GET' ? undefined : body,
    })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) throw new Error('HTML以外の応答を受信しました。');
        const html = await response.text();
        replacePage(html, response.url || url.href, 'replace', scrollPosition);
        const nextSettingsForm = document.querySelector('#settings-form');
        if (nextSettingsForm instanceof HTMLFormElement) {
          initializeSettingsForm(nextSettingsForm);
          if (!savesAllSettings) {
            for (const [name, initialValue] of initialFieldValues) {
              const field = nextSettingsForm.querySelector('[name="' + CSS.escape(name) + '"]');
              if (field) field.dataset.initialValue = initialValue;
            }
          }
          if (!savesAllSettings && hadUnsavedChanges) restoreUnsavedValues(data);
          if (!savesAllSettings) {
            for (const name of editingFieldNames) {
              const field = nextSettingsForm.querySelector('[name="' + CSS.escape(name) + '"]');
              const row = field?.closest('.setting-row');
              if (row) setFieldEditing(row, true);
            }
            updateSaveDock(nextSettingsForm);
          }
          updateAllMessagePreviews(nextSettingsForm);
        }
      })
      .catch(() => {
        setSubmitterBusy(submitter, false);
        nativeSubmissions.add(form);
        form.requestSubmit(submitter || undefined);
      });
  });

  document.addEventListener('input', (event) => {
    const field = event.target;
    if (field instanceof HTMLElement && field.closest('#settings-form') && field.getAttribute('name') !== '_csrf') {
      normalizeNotionDatabaseField(field);
      validateNotifyDays(field);
      updateToggleState(field);
      if ('value' in field) updateMessagePreview(field);
      updateSaveDock(field.closest('#settings-form'));
    }
  });

  document.addEventListener('change', (event) => {
    const field = event.target;
    if (field instanceof HTMLElement && field.closest('#settings-form') && field.getAttribute('name') !== '_csrf') {
      normalizeNotionDatabaseField(field);
      validateNotifyDays(field);
      if ('value' in field) updateMessagePreview(field);
      updateSaveDock(field.closest('#settings-form'));
    }
  });

  document.addEventListener('reset', (event) => {
    if (event.target instanceof HTMLFormElement && event.target.id === 'settings-form') {
      event.preventDefault();
      resetSettingsForm(event.target);
    }
  });

  window.addEventListener('popstate', () => {
    if (window.location.hash && moveToSection(window.location.href, 'none')) return;
    loadPage(window.location.href, 'none').catch(() => window.location.reload());
  });

  function boot() {
    initializeSettingsForm(document.querySelector('#settings-form'));
    if (window.location.hash) window.requestAnimationFrame(() => moveToSection(window.location.href, 'none'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();`;
