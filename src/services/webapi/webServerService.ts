import { HTTPFetchError, middleware, webhook } from '@line/bot-sdk';
import express, { Express, Request, Response } from 'express';
import { config } from '../../config/config';
import {
  isNotionAutomationWebhookEvent,
  NotionAutomationWebhookEvent,
  Services,
} from '../../types/types';
import { logger } from '../../utils/logger';
import { LINEBotService } from './lineBotService';
import { NotionAutomationService } from './notionAutomationService';

export class WebServerService {
  private app: Express;
  private line: LINEBotService;
  private notionAutomation: NotionAutomationService;

  constructor(private readonly services: Services) {
    this.line = new LINEBotService(services);
    this.notionAutomation = new NotionAutomationService(services);

    this.app = express();
    this.app.use('/linebot', middleware({ channelSecret: config.lineBot.channelSecret }));
    this.app.use('/automation', express.json());

    this.setupAPIEndpoints();
    this.start();
  }

  private setupAPIEndpoints() {
    // https://<proxy-url>/api/ への GET リクエスト
    this.app.get('/health', (req, res) => {
      res.send('This app is running').end();
    });

    // https://<proxy-url>/linebot への POST リクエスト
    this.app.post('/linebot', async (req: Request, res: Response) => {
      console.log('GAS: LINE メッセージ受信リクエスト受信');

      const callbackRequest: webhook.CallbackRequest = req.body;
      const events: webhook.Event[] = callbackRequest.events!;

      // Process all the received events asynchronously.
      await Promise.all(
        events.map(async (event: webhook.Event) => {
          try {
            await this.line.handleLINEMessageEvent(event);
          } catch (err: unknown) {
            if (err instanceof HTTPFetchError) {
              console.error(err.status);
              console.error(err.headers.get('x-line-request-id'));
              console.error(err.body);
            } else if (err instanceof Error) {
              console.error(err);
            }

            // Return an error message.
            res.status(500).json({
              status: 'error',
            });
          }
        })
      );

      // Return a successful message.
      res.status(200).json({
        status: 'success',
      });
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
    const port = config.app.port;
    this.app.listen(port, () => {
      logger.info(`Glineze API サーバーがポート ${port} で起動しました`);
    });
  }
}
