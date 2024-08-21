import bodyParser from 'body-parser';
import express, { Application } from 'express';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { WebhookService } from './webhookService';
import { isDevelopment } from '../utils/environment';

export class WebServer {
  public app: Application;
  private webhookService: WebhookService;

  constructor() {
    this.app = express();
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());

    this.webhookService = new WebhookService();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post('/webhook', async (req, res) => {
      if (isDevelopment()) {
        logger.info('Received webhook event, but ignored in development mode');
        res.status(200).send('Success');
        return;
      }

      const signature = req.headers['x-hub-signature-256'] as string;
      if (!this.webhookService.verifySignature(JSON.stringify(req.body), signature)) {
        logger.error('Invalid webhook signature');
        res.status(403).send('Invalid signature');
        return;
      }

      try {
        console.log(req.body.ref);
        await this.webhookService.handlePushEvent(req.body.ref);
        res.status(200).send('Success');
      } catch (error) {
        logger.error('Error in handlePushEvent: ' + error);
        res.status(500).send('Error');
      }
    });
  }

  public start(): void {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.webhook.port;
    this.app.listen(port, () => {
      logger.info('Webhook server is online on port ' + port);
    });
  }
}

if (require.main === module) {
  const webServer = new WebServer();
  webServer.start();
}
