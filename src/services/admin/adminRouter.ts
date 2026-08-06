import path from 'node:path';
import express, { NextFunction, Request, Response, Router } from 'express';
import { csrfSync } from 'csrf-sync';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import createMemoryStore from 'memorystore';
import {
  ConfigCategory,
  ConfigEffectError,
  ConfigPartialUpdateError,
  ConfigValidationError,
} from '../../config';
import { logger } from '../../utils/logger';
import { AdminConsoleService, AdminOperationError } from './adminConsoleService';
import { AdminLoginLinkService } from './adminLoginLinkService';
import { AdminLoginTokenService } from './adminLoginTokenService';
import {
  renderDashboard,
  renderPage,
  renderPracticeTemplate,
  renderSettingsForm,
  renderSystemSettings,
  renderUnauthorized,
} from './adminViews';

type DashboardSnapshot = Parameters<typeof renderDashboard>[0];

export type AdminRouterOptions = {
  tokenService: AdminLoginTokenService;
  consoleService: AdminConsoleService;
  loginLinks: AdminLoginLinkService;
  sessionSecret: string;
  sessionTtlMs: number;
  dashboard: () => DashboardSnapshot;
};

const CATEGORY_TITLES: Record<ConfigCategory, string> = {
  countdown: 'カウントダウン設定',
  notifications: '通知先設定',
  'practice-template': '練習連絡テンプレート',
  advanced: '詳細設定',
  sesame: 'Sesame 設定',
};

export function createAdminRouter(options: AdminRouterOptions): Router {
  const router = Router();
  const MemoryStore = createMemoryStore(session);
  const store = new MemoryStore({ checkPeriod: 60 * 60 * 1_000 });
  const { csrfSynchronisedProtection, generateToken, revokeToken } = csrfSync({
    getTokenFromRequest: (request) =>
      typeof request.body?._csrf === 'string' ? request.body._csrf : undefined,
    errorConfig: {
      statusCode: 403,
      message: 'CSRF token validation failed',
      code: 'EBADCSRFTOKEN',
    },
  });

  router.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          connectSrc: ["'self'"],
          baseUri: ["'none'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
    })
  );
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/assets/pico.min.css', (_req, res) => {
    res.type('text/css').sendFile(path.resolve(require.resolve('@picocss/pico/css/pico.min.css')));
  });
  router.use(
    session({
      name: '__Host-glineze-admin',
      secret: options.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: options.sessionTtlMs,
      },
    })
  );
  router.use(express.urlencoded({ extended: false, limit: '64kb' }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  router.get('/login', loginLimiter, async (req, res) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      await options.tokenService.verify(token);
      await regenerateSession(req);
      req.session.adminAuthenticatedAt = Date.now();
      logger.info('管理画面へのログインに成功しました（actor: notion-admin-session）。');
      res.redirect(303, '/admin');
    } catch {
      logger.info('管理画面へのログインに失敗しました。');
      res.status(401).type('html').send(renderUnauthorized());
    }
  });

  router.use((req, res, next) => {
    if (!req.session.adminAuthenticatedAt) {
      res.status(401).type('html').send(renderUnauthorized());
      return;
    }
    next();
  });
  router.use(csrfSynchronisedProtection);

  router.get('/', (req, res) => {
    const csrfToken = generateToken(req);
    const reload = options.consoleService.getConfigReloadStatus();
    const link = options.loginLinks.getStatus();
    const content = renderDashboard(options.dashboard(), {
      configReloadAt: reload.at?.toISOString(),
      configReloadError: reload.error,
      loginLinkExpiresAt: link.expiresAt?.toISOString(),
      loginLinkNextRotationAt: link.nextRotationAt?.toISOString(),
      loginLinkError: link.error,
    });
    sendPage(res, {
      title: '稼働状況',
      content,
      csrfToken,
      authenticated: true,
      notice: getNotice(req.query.result),
    });
  });

  router.get('/settings/system', (req, res) => {
    const csrfToken = generateToken(req);
    sendPage(res, {
      title: 'システム設定',
      content: renderSystemSettings(options.consoleService.getSystemStatus(), csrfToken),
      csrfToken,
      authenticated: true,
      notice: getNotice(req.query.result),
    });
  });

  router.get('/settings/practice-template', (req, res) => {
    const csrfToken = generateToken(req);
    const content = renderPracticeTemplate(
      options.consoleService.getPracticeTemplate(),
      options.consoleService.getSettings('practice-template'),
      csrfToken
    );
    sendPage(res, {
      title: CATEGORY_TITLES['practice-template'],
      content,
      csrfToken,
      authenticated: true,
      notice: getNotice(req.query.result),
    });
  });

  router.get('/settings/:category', (req, res) => {
    const category = parseCategory(req.params.category);
    if (!category || category === 'practice-template') {
      res
        .status(404)
        .type('html')
        .send(
          renderPage({
            title: '見つかりません',
            content: '<p>指定された設定画面はありません。</p>',
          })
        );
      return;
    }
    if (category === 'sesame' && options.consoleService.getSettings(category).length === 0) {
      res
        .status(503)
        .type('html')
        .send(
          renderPage({
            title: CATEGORY_TITLES[category],
            content: '<p>Sesame 連携は停止中です。</p>',
            authenticated: true,
            csrfToken: generateToken(req),
          })
        );
      return;
    }
    renderCategoryPage(req, res, options.consoleService, category);
  });

  router.post('/settings/:category', async (req, res) => {
    const category = parseCategory(req.params.category);
    if (!category) {
      res
        .status(404)
        .type('html')
        .send(
          renderPage({
            title: '見つかりません',
            content: '<p>指定された設定画面はありません。</p>',
          })
        );
      return;
    }
    const input = bodyWithoutCsrf(req.body);
    try {
      await options.consoleService.updateSettings(category, input);
      logger.info(
        `管理画面から設定を更新しました: ${Object.keys(input).join(', ')}（actor: notion-admin-session）`
      );
      res.redirect(303, `/admin/settings/${category}?result=saved`);
    } catch (error) {
      const status =
        error instanceof ConfigValidationError || error instanceof AdminOperationError ? 400 : 503;
      renderCategoryPage(
        req,
        res,
        options.consoleService,
        category,
        status,
        safeAdminError(error),
        error instanceof ConfigValidationError ? { [error.key]: error.message } : {},
        input
      );
    }
  });

  router.post('/actions/reload-config', async (_req, res, next) => {
    try {
      await options.consoleService.reloadConfig();
      logger.info('管理画面から設定を再読込しました（actor: notion-admin-session）。');
      res.redirect(303, '/admin/settings/system?result=config-reloaded');
    } catch (error) {
      next(error);
    }
  });
  router.post('/actions/reload-template', async (_req, res, next) => {
    try {
      await options.consoleService.reloadPracticeTemplate();
      res.redirect(303, '/admin/settings/practice-template?result=template-reloaded');
    } catch (error) {
      next(error);
    }
  });
  router.post('/actions/rotate-login-link', async (_req, res, next) => {
    try {
      await options.consoleService.rotateLoginLink();
      res.redirect(303, '/admin/settings/system?result=link-rotated');
    } catch (error) {
      next(error);
    }
  });
  router.post('/logout', (req, res, next) => {
    revokeToken(req);
    req.session.destroy((error) => {
      if (error) return next(error);
      res.set('Clear-Site-Data', '"cache", "cookies", "storage"');
      res.redirect(303, '/admin');
    });
  });

  router.use((_req, res) => {
    res
      .status(404)
      .type('html')
      .send(
        renderPage({ title: '見つかりません', content: '<p>指定されたページはありません。</p>' })
      );
  });
  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    void _next;
    const status = isCsrfError(error) ? 403 : getHttpStatus(error) === 413 ? 413 : 503;
    logger.error(`管理画面の操作に失敗しました: ${safeAdminError(error)}`);
    if (!res.headersSent) {
      res
        .status(status)
        .type('html')
        .send(
          renderPage({
            title: '操作に失敗しました',
            content: '<p>時間をおいて再度お試しください。</p>',
            error:
              status === 403
                ? 'フォームの有効期限が切れました。画面を再読込してください。'
                : status === 413
                  ? '送信内容が大きすぎます。'
                  : '外部サービスとの通信に失敗しました。',
            authenticated: Boolean(req.session?.adminAuthenticatedAt),
            csrfToken: req.session?.adminAuthenticatedAt ? generateToken(req) : undefined,
          })
        );
    }
  });

  return router;
}

function renderCategoryPage(
  req: Request,
  res: Response,
  consoleService: AdminConsoleService,
  category: ConfigCategory,
  status = 200,
  error?: string,
  fieldErrors: Readonly<Record<string, string>> = {},
  submittedInput: Readonly<Record<string, string>> = {}
): void {
  const csrfToken = req.csrfToken ? req.csrfToken() : '';
  const fields = consoleService.getSettings(category).map((field) => ({
    ...field,
    ...(!field.secret && typeof submittedInput[field.key] === 'string'
      ? { value: submittedInput[field.key] }
      : {}),
  }));
  const content =
    category === 'practice-template'
      ? renderPracticeTemplate(consoleService.getPracticeTemplate(), fields, csrfToken, fieldErrors)
      : renderSettingsForm(category, fields, csrfToken, fieldErrors);
  res
    .status(status)
    .type('html')
    .send(
      renderPage({
        title: CATEGORY_TITLES[category],
        content,
        csrfToken,
        authenticated: true,
        notice: getNotice(req.query.result),
        error,
      })
    );
}

function sendPage(res: Response, options: Parameters<typeof renderPage>[0]): void {
  res.type('html').send(renderPage(options));
}

function parseCategory(value: string): ConfigCategory | undefined {
  return Object.hasOwn(CATEGORY_TITLES, value) ? (value as ConfigCategory) : undefined;
}

function bodyWithoutCsrf(body: unknown): Record<string, string> {
  if (typeof body !== 'object' || body === null) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key !== '_csrf' && typeof value === 'string') result[key] = value;
  }
  return result;
}

function getNotice(value: unknown): string | undefined {
  const notices: Record<string, string> = {
    saved: '設定を保存しました。',
    'config-reloaded': '設定を Notion から再読込しました。',
    'template-reloaded': 'テンプレートを再読込しました。',
    'link-rotated': 'ログインリンクを更新しました。',
  };
  return typeof value === 'string' ? notices[value] : undefined;
}

function safeAdminError(error: unknown): string {
  if (
    error instanceof ConfigValidationError ||
    error instanceof ConfigEffectError ||
    error instanceof ConfigPartialUpdateError ||
    error instanceof AdminOperationError
  ) {
    return error.message;
  }
  return '管理画面の操作に失敗しました。';
}

function isCsrfError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'EBADCSRFTOKEN'
  );
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = Number(error.status);
  return Number.isInteger(status) ? status : undefined;
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}
