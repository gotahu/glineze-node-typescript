import express, { Express, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';
import { HTTPFetchError, middleware, webhook } from '@line/bot-sdk';
import { LINEBotService } from './lineBotService';
import { NotionAutomationWebhookEvent, Services } from '../../types/types';
import { handleShukinAutomation } from '../notion/automation/ShukinAutomation';

export class WebServerService {
  private app: Express;
  private line: LINEBotService;

  constructor(private readonly services: Services) {
    this.line = new LINEBotService(services);

    this.app = express();
    this.app.use('/linebot', middleware({ channelSecret: process.env.LINEBOT_CHANNEL_SECRET }));
    this.app.use('/glineze', express.json());

    this.setupAPIEndpoints();
    this.start();
  }

  private setupAPIEndpoints() {
    // https://<proxy-url>/api/ への GET リクエスト
    this.app.get('/', (req, res) => {
      res.send('This app is running').end();
    });

    // https://<proxy-url>/glineze/linebot への POST リクエスト
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

        const event = req.body as NotionAutomationWebhookEvent;

        // database_id が存在する
        if (event.data.parent['database_id']) {
          const databaseId = (event.data.parent['database_id'] as string).replace(/-/g, '');

          const shukinDatabaseId = config.getConfig('shukin_databaseid');

          if (databaseId === shukinDatabaseId) {
            handleShukinAutomation(event, this.services);
          } else {
            logger.error('Invalid request: invalid database_id');
          }
        } else {
          logger.error('Invalid request: missing database_id');
        }

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
