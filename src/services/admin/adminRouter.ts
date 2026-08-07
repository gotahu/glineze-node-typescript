import path from 'node:path';
import express, { NextFunction, Request, Response, Router } from 'express';
import { csrfSync } from 'csrf-sync';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import createMemoryStore from 'memorystore';
import {
  CONFIG_DEFINITIONS,
  ConfigCategory,
  ConfigEffectError,
  ConfigKey,
  ConfigPartialUpdateError,
  ConfigValidationError,
  isConfigKey,
} from '../../config';
import { logger } from '../../utils/logger';
import { AdminConsoleService, AdminOperationError } from './adminConsoleService';
import { ADMIN_CLIENT_JS } from './adminClient';
import { AdminLoginLinkService } from './adminLoginLinkService';
import { AdminLoginTokenService } from './adminLoginTokenService';
import {
  renderDashboard,
  renderAllSettings,
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
          scriptSrc: ["'self'"],
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
  router.get('/assets/admin.js', (_req, res) => {
    res.type('text/javascript').send(ADMIN_CLIENT_JS);
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

  router.get('/settings', (req, res) => {
    renderAllSettingsPage(req, res, options.consoleService);
  });

  router.get('/settings/:category', (req, res) => {
    if (req.params.category === 'system') {
      res.redirect(302, '/admin/settings#system');
      return;
    }
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
    res.redirect(
      302,
      `/admin/settings#${category === 'practice-template' ? 'practice' : category}`
    );
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
      res.redirect(303, `/admin/settings?result=saved#${category}`);
    } catch (error) {
      const status =
        error instanceof ConfigValidationError || error instanceof AdminOperationError ? 400 : 503;
      renderAllSettingsPage(req, res, options.consoleService, status, safeAdminError(error), {
        category,
        fieldErrors: error instanceof ConfigValidationError ? { [error.key]: error.message } : {},
        submittedInput: input,
      });
    }
  });

  router.post('/actions/verify-channel', async (req, res) => {
    const rawKey = typeof req.body?._verify === 'string' ? req.body._verify : '';
    if (!isConfigKey(rawKey)) {
      renderAllSettingsPage(
        req,
        res,
        options.consoleService,
        400,
        '確認する設定を特定できませんでした。'
      );
      return;
    }

    const key: ConfigKey = rawKey;
    const input = typeof req.body?.[key] === 'string' ? req.body[key] : '';
    const category = CONFIG_DEFINITIONS[key].category;
    try {
      const channel = await options.consoleService.verifyDiscordChannel(key, input);
      renderAllSettingsPage(req, res, options.consoleService, 200, undefined, {
        category,
        submittedInput: bodyWithoutCsrf(req.body),
        channelChecks: {
          [key]: {
            ok: true,
            message: `確認できました: #${channel.name}（${channel.kind} / ${channel.id}）`,
          },
        },
      });
    } catch (error) {
      const message = safeAdminError(error);
      renderAllSettingsPage(req, res, options.consoleService, 400, message, {
        category,
        submittedInput: bodyWithoutCsrf(req.body),
        fieldErrors: error instanceof ConfigValidationError ? { [key]: error.message } : {},
        channelChecks:
          error instanceof ConfigValidationError ? {} : { [key]: { ok: false, message } },
      });
    }
  });

  router.post('/actions/reload-config', async (_req, res, next) => {
    try {
      await options.consoleService.reloadConfig();
      logger.info('管理画面から設定を再読込しました（actor: notion-admin-session）。');
      res.redirect(303, '/admin/settings?result=config-reloaded#system');
    } catch (error) {
      next(error);
    }
  });
  router.post('/actions/reload-template', async (_req, res, next) => {
    try {
      await options.consoleService.reloadPracticeTemplate();
      res.redirect(303, '/admin/settings?result=template-reloaded#practice');
    } catch (error) {
      next(error);
    }
  });
  router.post('/actions/rotate-login-link', async (_req, res, next) => {
    try {
      await options.consoleService.rotateLoginLink();
      res.redirect(303, '/admin/settings?result=link-rotated#system');
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

type SettingsPageState = {
  category: ConfigCategory;
  fieldErrors?: Readonly<Record<string, string>>;
  submittedInput?: Readonly<Record<string, string>>;
  channelChecks?: Readonly<Record<string, { ok: boolean; message: string }>>;
};

function renderAllSettingsPage(
  req: Request,
  res: Response,
  consoleService: AdminConsoleService,
  status = 200,
  error?: string,
  state?: SettingsPageState
): void {
  const csrfToken = req.csrfToken ? req.csrfToken() : '';
  const fieldsFor = (category: ConfigCategory) =>
    consoleService.getSettings(category).map((field) => ({
      ...field,
      ...(state?.category === category &&
      !field.secret &&
      typeof state.submittedInput?.[field.key] === 'string'
        ? { value: state.submittedInput[field.key] }
        : {}),
    }));

  const countdownFields = fieldsFor('countdown');
  const notificationFields = fieldsFor('notifications');
  const practiceDestination = notificationFields.filter(
    (field) => field.key === 'practice_remind_threadid'
  );
  const otherNotifications = notificationFields.filter(
    (field) => field.key !== 'practice_remind_threadid'
  );
  const templateFields = fieldsFor('practice-template');
  const sesameFields = fieldsFor('sesame');
  const errors = state?.fieldErrors ?? {};
  const channelChecks = state?.channelChecks ?? {};
  const content = renderAllSettings({
    practiceDestination: renderSettingsForm(
      'notifications',
      practiceDestination,
      csrfToken,
      errors,
      channelChecks
    ),
    practiceTemplate: renderPracticeTemplate(
      consoleService.getPracticeTemplate(),
      templateFields,
      csrfToken,
      errors
    ),
    countdown: renderSettingsForm('countdown', countdownFields, csrfToken, errors, channelChecks),
    notifications: renderSettingsForm(
      'notifications',
      otherNotifications,
      csrfToken,
      errors,
      channelChecks
    ),
    advanced: renderSettingsForm('advanced', fieldsFor('advanced'), csrfToken, errors),
    sesame:
      sesameFields.length > 0
        ? renderSettingsForm('sesame', sesameFields, csrfToken, errors)
        : '<p>Sesame 連携は停止中です。</p>',
    system: renderSystemSettings(consoleService.getSystemStatus(), csrfToken),
  });
  res
    .status(status)
    .type('html')
    .send(
      renderPage({
        title: '設定',
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
