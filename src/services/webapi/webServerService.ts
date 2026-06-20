import express, { Express, Request } from 'express';
import { Server } from 'node:http';
import { config } from '../../config';
import {
  isNotionAutomationWebhookEvent,
  NotionAutomationWebhookEvent,
  Services,
} from '../../types/types';
import { logger } from '../../utils/logger';
import { NotionAutomationService } from './notionAutomationService';
import {
  ServiceHealth,
  STATUS_PAGE_HTML,
  StatusSnapshot,
} from './statusPage';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAILY_STATS_RETENTION_DAYS = 14;

export class WebServerService {
  private readonly app: Express;
  private readonly notionAutomation: NotionAutomationService;
  private server?: Server;

  private readonly requestStats = {
    total: 0,
    daily: new Map<string, number>(),
    startTime: new Date(),
  };

  constructor(private readonly services: Services) {
    logger.info('WebServerService の初期化を開始します。');

    this.notionAutomation = new NotionAutomationService(services);
    this.app = express();

    this.configureMiddleware();
    this.setupAPIEndpoints();
    this.start();

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
    this.app.use('/automation', express.json({ limit: '256kb' }));
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
        .send(STATUS_PAGE_HTML);
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
        .sendFile('status-operational.png', { root: `${process.cwd()}/dist/assets` });
    });

    this.app.get('/health', (_req, res) => {
      res.set('Cache-Control', 'no-store').status(200).type('text').send('This app is running');
    });

    this.app.post('/automation', (req, res) => {
      try {
        logger.debug('Received webhook request to /automation');

        if (!req.body) {
          res.status(400).json({ error: 'missing_body' });
          return;
        }

        if (!isNotionAutomationWebhookEvent(req.body)) {
          res.status(400).json({ error: 'invalid_body' });
          return;
        }

        const event: NotionAutomationWebhookEvent = req.body;
        this.notionAutomation.handleNotionAutomationWebhookEvent(event);
        res.status(200).end();
      } catch (error) {
        logger.error(`Error in API endpoint: ${error}`);
        res.status(500).json({ error: 'internal_error' });
      }
    });

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

  private start() {
    logger.info('Glineze API サーバーの起動を試みます……');

    const port = config.app.port;
    this.server = this.app.listen(port, () => {
      logger.info(`Glineze API サーバーがポート ${port} で起動しました`);
    });

    this.server.requestTimeout = 15_000;
    this.server.headersTimeout = 16_000;
    this.server.keepAliveTimeout = 5_000;
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
    return [
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
        state: 'operational',
        label: '正常',
        detail: '受付可能',
        meta: 'Webhook ready',
      },
      {
        id: 'sesame',
        name: 'Sesame 連携',
        state: discordOnline ? 'operational' : 'degraded',
        label: discordOnline ? '正常' : '確認中',
        detail: '定期更新',
        meta: '5分間隔',
      },
      {
        id: 'webhook',
        name: 'Webhook API',
        state: 'operational',
        label: '正常',
        detail: '待機中',
        meta: '/automation',
      },
    ];
  }
}
