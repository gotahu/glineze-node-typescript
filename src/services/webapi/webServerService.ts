import express, { Express } from 'express';
import { config } from '../../config';
import {
  isNotionAutomationWebhookEvent,
  NotionAutomationWebhookEvent,
  Services,
} from '../../types/types';
import { logger } from '../../utils/logger';
import { NotionAutomationService } from './notionAutomationService';

export class WebServerService {
  private app: Express;
  private notionAutomation: NotionAutomationService;

  private requestStats = {
    total: 0,
    daily: new Map<string, number>(),
    startTime: new Date(),
  };

  constructor(private readonly services: Services) {
    console.log('WebServerService の初期化を開始します。');

    this.notionAutomation = new NotionAutomationService(services);

    this.app = express();
    this.app.use('/automation', express.json());

    this.setupAPIEndpoints();
    this.start();

    console.log('WebServerService の初期化が終了しました。');
  }

  private setupAPIEndpoints() {
    // リクエストのカウント用ミドルウェア
    this.app.use((req, res, next) => {
      this.incrementRequestCount();
      next();
    });

    // ステータスページへのルート
    this.app.get('/', (req, res) => {
      res.send(this.generateStatusHtml());
    });

    // https://<proxy-url>/api/ への GET リクエスト
    this.app.get('/health', (req, res) => {
      res.send('This app is running').end();
    });

    // https://<proxy-url>/glineze/automation への POST リクエスト
    this.app.post('/automation', async (req, res) => {
      try {
        console.log(req);

        if (!req.body) {
          logger.error('Invalid request: missing body');
          res.status(400).send('Invalid request: missing body');
          return;
        }

        if (!isNotionAutomationWebhookEvent(req.body)) {
          logger.error('Invalid request: invalid body');
          res.status(400).send('Invalid request: invalid body');
          return;
        }

        const event: NotionAutomationWebhookEvent = req.body;

        this.notionAutomation.handleNotionAutomationWebhookEvent(event);

        res.status(200).end();
      } catch (error) {
        logger.error(`Error in API endpoint: ${error}`);
        res.status(500).end();
      }
    });
  }

  /**
   * サーバーの起動
   */
  private start() {
    console.log('Glineze API サーバーの起動を試みます……');

    const port = config.app.port;
    this.app.listen(port, () => {
      logger.info(`Glineze API サーバーがポート ${port} で起動しました`);
    });
  }

  private incrementRequestCount() {
    this.requestStats.total++;
    // 日本時間 (JST) での日付を取得
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentCount = this.requestStats.daily.get(today) || 0;
    this.requestStats.daily.set(today, currentCount + 1);
  }

  private generateStatusHtml(): string {
    const memory = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayCount = this.requestStats.daily.get(today) || 0;

    const discordStatus = this.services.discord?.client?.isReady() ? '🟢 Online' : '🔴 Offline';
    
    // Discord Stats
    const discordDailyMessages = this.services.discord?.stats.dailyMessages.get(today) || 0;
    const discordDailyReactions = this.services.discord?.stats.dailyReactions.get(today) || 0;
    const popularEmojis = Array.from(this.services.discord?.stats.popularEmojis.entries() || [])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Top 5
      .map(([emoji, count]) => `<span style="display:inline-block; background:#eef2f5; padding:4px 8px; border-radius:4px; margin:2px;">${emoji} ${count}</span>`)
      .join('');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Glineze Status</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f9; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #3498db; }
        .stat-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #7f8c8d; text-transform: uppercase; }
        .stat-card .value { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .status-online { color: #27ae60; font-weight: bold; }
        .status-offline { color: #e74c3c; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Glineze Board Status</h1>
        
        <div class="stat-grid">
            <div class="stat-card">
                <h3>Discord Status</h3>
                <div class="value ${discordStatus.includes('Online') ? 'status-online' : 'status-offline'}">${discordStatus}</div>
            </div>
            <div class="stat-card">
                <h3>Discord Messages (Today)</h3>
                <div class="value">${discordDailyMessages}</div>
            </div>
            <div class="stat-card">
                <h3>Discord Reactions (Today)</h3>
                <div class="value">${discordDailyReactions}</div>
            </div>
            <div class="stat-card" style="grid-column: 1 / -1;">
                <h3>Popular Emojis (Since Startup)</h3>
                <div style="font-size: 18px; margin-top: 10px;">
                    ${popularEmojis || '<span style="color:#95a5a6; font-size:14px;">No emojis used yet</span>'}
                </div>
            </div>
        </div>
        
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 40px;">System Status</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <h3>Web Uptime</h3>
                <div class="value">${uptimeString}</div>
            </div>
            <div class="stat-card">
                <h3>Web Requests (Today)</h3>
                <div class="value">${todayCount}</div>
            </div>
            <div class="stat-card">
                <h3>Web Requests (Total)</h3>
                <div class="value">${this.requestStats.total}</div>
            </div>
            <div class="stat-card">
                <h3>Memory Usage (RSS)</h3>
                <div class="value">${Math.round(memory.rss / 1024 / 1024)} MB</div>
            </div>
            <div class="stat-card">
                <h3>Started At</h3>
                <div class="value" style="font-size: 16px;">${this.requestStats.startTime.toLocaleString('ja-JP')}</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }
}
