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

  function replacePage(html, url, historyMode) {
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

    const hash = new URL(url, window.location.href).hash;
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo({ top: 0 });

    nextMain.setAttribute('tabindex', '-1');
    nextMain.focus({ preventScroll: Boolean(target) });
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
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a');
    if (!link || !isAdminLink(link)) return;

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
    const action = submitter?.formAction || form.action;
    const method = (submitter?.formMethod || form.method || 'get').toUpperCase();
    const url = new URL(action, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith(adminPath)) return;

    event.preventDefault();
    const data = new FormData(form);
    if (submitter?.name) data.set(submitter.name, submitter.value);
    const body = new URLSearchParams();
    for (const [name, value] of data.entries()) {
      if (typeof value === 'string') body.append(name, value);
    }

    if (submitter) {
      submitter.disabled = true;
      submitter.setAttribute('aria-busy', 'true');
    }

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
        replacePage(await response.text(), response.url || url.href, 'replace');
      })
      .catch(() => {
        if (submitter) {
          submitter.disabled = false;
          submitter.removeAttribute('aria-busy');
        }
        nativeSubmissions.add(form);
        form.requestSubmit(submitter || undefined);
      });
  });

  window.addEventListener('popstate', () => {
    loadPage(window.location.href, 'none').catch(() => window.location.reload());
  });
})();`;
