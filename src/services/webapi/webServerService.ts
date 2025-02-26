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
}
