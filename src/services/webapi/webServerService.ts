import express, { Express, Request } from 'express';
import { Server } from 'node:http';
import { join } from 'node:path';
import type { ServiceContainer } from '../../bootstrap/ServiceContainer';
import { config } from '../../config';
import { env, parseCommaSeparatedIds } from '../../env';
import { isNotionAutomationWebhookEvent, NotionAutomationWebhookEvent } from '../../types/types';
import { logger } from '../../utils/logger';
import { HealthRecord, healthRegistry } from '../../shared/health/HealthRegistry';
import {
  NotionAutomationService,
  UnsupportedNotionWebhookResourceError,
} from './notionAutomationService';
import { NotionWebhookSecurity } from './notionWebhookSecurity';
import { ServiceHealth, StatusSnapshot } from './statusPage';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAILY_STATS_RETENTION_DAYS = 14;
const WEB_ASSET_DIRECTORY = join(__dirname, 'assets');

export class WebServerService {
  private readonly app: Express;
  private readonly notionAutomation?: NotionAutomationService;
  private readonly notionWebhookSecurity?: NotionWebhookSecurity;
  private server?: Server;

  private readonly requestStats = {
    total: 0,
    daily: new Map<string, number>(),
    startTime: new Date(),
  };

  constructor(private readonly services: ServiceContainer) {
    logger.info('WebServerService の初期化を開始します。');

    if (env.NOTION_AUTOMATION_ENABLED) {
      const verificationToken = env.NOTION_AUTOMATION_VERIFICATION_TOKEN;
      const allowedAutomationIds = env.NOTION_AUTOMATION_ALLOWED_AUTOMATION_IDS;
      const allowedActionIds = env.NOTION_AUTOMATION_ALLOWED_ACTION_IDS;
      const allowedDatabaseIds = env.NOTION_AUTOMATION_ALLOWED_DATABASE_IDS;

      if (!verificationToken || !allowedAutomationIds || !allowedActionIds || !allowedDatabaseIds) {
        throw new Error('Notion automation configuration is incomplete');
      }

      this.notionWebhookSecurity = new NotionWebhookSecurity({
        verificationToken,
        allowedAutomationIds: parseCommaSeparatedIds(allowedAutomationIds),
        allowedActionIds: parseCommaSeparatedIds(allowedActionIds),
        allowedDatabaseIds: parseCommaSeparatedIds(allowedDatabaseIds),
      });
      this.notionAutomation = new NotionAutomationService(services, this.notionWebhookSecurity);
    } else {
      logger.info('Notion automation is disabled');
    }
    this.app = express();

    this.configureMiddleware();
    this.setupAPIEndpoints();

    logger.info('WebServerService の初期化が終了しました。');
  }

  private configureMiddleware() {
    this.app.disable('x-powered-by');
    this.app.use((req, res, next) => {
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      });

      if (!this.isMonitoringRequest(req)) {
        this.incrementRequestCount();
      }
      next();
    });
    if (env.NOTION_AUTOMATION_ENABLED) {
      this.app.use(
        '/automation',
        express.json({
          limit: '256kb',
          verify: (req, _res, body) => {
            (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(body);
          },
        })
      );
    }
  }

  private setupAPIEndpoints() {
    this.app.get('/', (_req, res) => {
      res
        .set({
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
          'Content-Security-Policy':
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        })
        .type('html')
        .sendFile('status.html', { root: WEB_ASSET_DIRECTORY });
    });

    this.app.get('/api/status', (_req, res) => {
      res
        .set({
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
        })
        .json(this.createStatusSnapshot());
    });

    this.app.get('/assets/status-operational.png', (_req, res) => {
      res
        .set('Cache-Control', 'public, max-age=31536000, immutable')
        .sendFile('status-operational.png', { root: WEB_ASSET_DIRECTORY });
    });

    this.app.get('/health', (_req, res) => {
      const snapshot = this.createStatusSnapshot();
      res
        .set('Cache-Control', 'no-store')
        .status(snapshot.overall === 'offline' ? 503 : 200)
        .json({
          status: snapshot.overall,
          generatedAt: snapshot.generatedAt,
          services: snapshot.services,
        });
    });

    const notionAutomation = this.notionAutomation;
    const notionWebhookSecurity = this.notionWebhookSecurity;

    if (!notionAutomation || !notionWebhookSecurity) {
      this.app.post('/automation', (_req, res) => {
        res.status(503).json({ error: 'service_disabled' });
      });
    } else {
      this.app.post('/automation', async (req, res) => {
        let reservedEventId: string | undefined;
        try {
          logger.debug('Received webhook request to /automation');

          const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
          const signature = req.get('X-Notion-Signature');
          if (!rawBody || !notionWebhookSecurity.verifySignature(rawBody, signature)) {
            res.status(401).json({ error: 'invalid_signature' });
            return;
          }

          if (!req.body) {
            res.status(400).json({ error: 'missing_body' });
            return;
          }

          if (!isNotionAutomationWebhookEvent(req.body)) {
            res.status(400).json({ error: 'invalid_body' });
            return;
          }

          const event: NotionAutomationWebhookEvent = req.body;
          const authorization = notionWebhookSecurity.reserveEvent(event);
          if (authorization === 'unsupported_source') {
            res.status(403).json({ error: 'unsupported_source' });
            return;
          }
          if (authorization === 'replay') {
            res.status(200).end();
            return;
          }

          reservedEventId = event.source.event_id;
          await notionAutomation.handleNotionAutomationWebhookEvent(event);
          res.status(200).end();
        } catch (error) {
          if (error instanceof UnsupportedNotionWebhookResourceError) {
            logger.error(`Rejected Notion webhook resource: ${error.message}`);
            res.status(403).json({ error: 'unsupported_resource' });
            return;
          }

          if (reservedEventId) notionWebhookSecurity.releaseEvent(reservedEventId);
          logger.error(`Error in API endpoint: ${error}`);
          res.status(500).json({ error: 'internal_error' });
        }
      });
    }

    this.app.use((_req, res) => {
      res.status(404).json({ error: 'not_found' });
    });

    this.app.use(
      (
        error: unknown,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        void _next;
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status?: unknown }).status)
            : 500;

        logger.error(
          `Web server request failed: ${error instanceof Error ? error.message : String(error)}`
        );
        if (!res.headersSent) {
          if (status === 400) {
            res.status(400).json({ error: 'invalid_json' });
          } else if (status === 413) {
            res.status(413).json({ error: 'payload_too_large' });
          } else {
            res.status(500).json({ error: 'internal_error' });
          }
        }
      }
    );
  }

  public async start(): Promise<void> {
    if (this.server) return;

    logger.info('Glineze API サーバーの起動を試みます……');

    const port = config.app.port;
    const server = this.app.listen(port);
    this.server = server;

    server.requestTimeout = 15_000;
    server.headersTimeout = 16_000;
    server.keepAliveTimeout = 5_000;

    await new Promise<void>((resolve, reject) => {
      const handleListening = () => {
        server.off('error', handleError);
        logger.info(`Glineze API サーバーがポート ${port} で起動しました`);
        resolve();
      };
      const handleError = (error: Error) => {
        server.off('listening', handleListening);
        this.server = undefined;
        reject(error);
      };

      server.once('listening', handleListening);
      server.once('error', handleError);
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) return;

    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private isMonitoringRequest(req: Request): boolean {
    return (
      req.method === 'GET' &&
      (req.path === '/' || req.path === '/api/status' || req.path === '/health')
    );
  }

  private incrementRequestCount() {
    this.requestStats.total++;
    const today = this.getJstDateKey();
    this.requestStats.daily.set(today, (this.requestStats.daily.get(today) ?? 0) + 1);
    this.pruneDailyStats();
  }

  private pruneDailyStats() {
    if (this.requestStats.daily.size <= DAILY_STATS_RETENTION_DAYS) return;

    const oldestKeys = [...this.requestStats.daily.keys()]
      .sort()
      .slice(0, this.requestStats.daily.size - DAILY_STATS_RETENTION_DAYS);
    for (const key of oldestKeys) {
      this.requestStats.daily.delete(key);
    }
  }

  private getJstDateKey(): string {
    return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
  }

  private createStatusSnapshot(): StatusSnapshot {
    const today = this.getJstDateKey();
    const discordOnline = this.services.discord.client.isReady();
    const services = this.createServiceHealth(discordOnline);

    return {
      generatedAt: new Date().toISOString(),
      overall: services.some((service) => service.state === 'offline')
        ? 'offline'
        : services.some((service) => service.state === 'degraded')
          ? 'degraded'
          : 'operational',
      services,
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        requestsToday: this.requestStats.daily.get(today) ?? 0,
        requestsTotal: this.requestStats.total,
        memoryRssBytes: process.memoryUsage().rss,
        startedAt: this.requestStats.startTime.toISOString(),
      },
      activity: {
        discordMessagesToday: this.services.discord.stats.dailyMessages.get(today) ?? 0,
        discordReactionsToday: this.services.discord.stats.dailyReactions.get(today) ?? 0,
        popularReactions: [...this.services.discord.stats.popularEmojis.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 5)
          .map(([emoji, count]) => ({ emoji, count })),
      },
    };
  }

  private createServiceHealth(discordOnline: boolean): ServiceHealth[] {
    const services: ServiceHealth[] = [
      {
        id: 'discord',
        name: 'Discord',
        state: discordOnline ? 'operational' : 'offline',
        label: discordOnline ? '正常' : '停止',
        detail: discordOnline ? '接続中' : '未接続',
        meta: discordOnline ? 'Gateway ready' : '再接続を待機',
      },
      {
        id: 'web-api',
        name: 'Web API',
        state: 'operational',
        label: '正常',
        detail: '稼働中',
        meta: 'HTTP 200 OK',
      },
      {
        id: 'notion-automation',
        name: 'Notion 自動化',
        ...(env.NOTION_AUTOMATION_ENABLED
          ? this.observedHealth('integration:notion', '受付可能', 'Notion API')
          : this.disabledHealth()),
      },
      {
        id: 'sesame',
        name: 'Sesame 連携',
        ...(env.SESAME_ENABLED
          ? this.observedHealth('integration:sesame', '定期更新', '5分間隔')
          : this.disabledHealth()),
      },
      {
        id: 'webhook',
        name: 'Webhook API',
        state: env.NOTION_AUTOMATION_ENABLED ? 'operational' : 'disabled',
        label: env.NOTION_AUTOMATION_ENABLED ? '正常' : '停止',
        detail: env.NOTION_AUTOMATION_ENABLED ? '待機中' : '受付停止',
        meta: '/automation',
      },
    ];

    const jobHealth = healthRegistry
      .getAll()
      .filter(({ id }) => id.startsWith('job:'))
      .map((record) => ({
        id: record.id,
        name: `Cron: ${record.id.slice(4)}`,
        ...this.mapObservedRecord(record, '定期ジョブ', '多重実行防止あり'),
      }));

    return [...services, ...jobHealth];
  }

  private observedHealth(
    id: string,
    detail: string,
    meta: string
  ): Omit<ServiceHealth, 'id' | 'name'> {
    const record = healthRegistry.get(id);
    if (!record) {
      return {
        state: 'degraded',
        label: '未確認',
        detail,
        meta: `${meta} / 起動後の成功記録なし`,
      };
    }
    return this.mapObservedRecord(record, detail, meta);
  }

  private mapObservedRecord(
    record: HealthRecord,
    detail: string,
    meta: string
  ): Omit<ServiceHealth, 'id' | 'name'> {
    const operational = record.state === 'operational';
    return {
      state: operational ? 'operational' : 'degraded',
      label: operational ? '正常' : record.state === 'running' ? '実行中' : '要確認',
      detail,
      meta,
      attempts: record.attempts,
      skipped: record.skipped,
      lastSuccessAt: record.lastSuccessAt,
      lastFailureAt: record.lastFailureAt,
      lastDurationMs: record.lastDurationMs,
      lastError: record.lastError,
    };
  }

  private disabledHealth(): Omit<ServiceHealth, 'id' | 'name'> {
    return {
      state: 'disabled',
      label: '停止',
      detail: '無効化済み',
      meta: 'Feature disabled',
    };
  }
}
