import simpleGit, { SimpleGit } from 'simple-git';
import { config } from '../config/config';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import webpack from 'webpack';
import { isDevelopment } from '../utils/environment';
import express from 'express';

// webpack の設定をインポート
import webpackDevConfig from '../../webpack/webpack.dev';
import webpackProdConfig from '../../webpack/webpack.prod';
import { promisify } from 'util';
import { AppServer } from '../server';
export class WebhookService {
  private git: SimpleGit;
  private webhookServer: express.Express;
  private appServer: AppServer;

  constructor(appServer: AppServer) {
    this.appServer = appServer;
    this.git = simpleGit(config.repository.path);
    this.webhookServer = express();
    this.webhookServer.use(
      express.json({
        verify: (req, res, buf) => {
          req['rawBody'] = buf.toString('utf-8');
        },
      })
    );
    this.webhookServer.listen(config.webhook.port, () => {
      logger.info(`Webhook server listening on port ${config.webhook.port}`);
    });

    this.setupWebhook();
  }

  private setupWebhook() {
    // /webhook に対して POST リクエスト
    this.webhookServer.post('/', async (req, res) => {
      // リスタートトークンが送信された場合は、プロセスを再起動
      if (req.body && req.body['token'] && req.body['token'] === config.webhook.restartToken) {
        logger.info('Received webhook with restart token');
        res.status(200).send('Success');
        await this.appServer.restartChildProcesses();
        return;
      } else {
        // それ以外の場合は、github webhook として処理
        logger.info('GitHub から push イベントの webhook を受信しました', { debug: true });
        try {
          const signature = req.headers['x-hub-signature-256'] as string;
          console.log(signature);
          if (!this.verifySignature(JSON.stringify(req.body), signature)) {
            logger.error('Invalid webhook signature');
            res.status(403).send('Invalid signature');
            return;
          }

          console.log(req.body.ref);
          res.status(200).send('Success'); // 200 応答を返す

          // プッシュイベントを処理
          const result = await this.handlePushEvent(req.body.ref);

          if (result) {
            await this.appServer.restartChildProcesses();
          }
        } catch (error) {
          logger.error('Error in handlePushEvent: ' + error);
          res.status(500).send('Error');
        }
      }
    });
  }

  public verifySignature(payload: string, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', config.webhook.secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  public async handlePushEvent(branch: string): Promise<boolean> {
    if (branch === config.repository.branch) {
      try {
        logger.info(`Received push event for branch ${branch}`);

        await this.pullChanges();
        await this.runBuild();

        return true;
      } catch (error) {
        logger.error(error);
        return false;
      }
    } else {
      logger.info(`Received push event for branch ${branch}, but ignored`);
    }
  }

  private async pullChanges(): Promise<void> {
    logger.info('Starting git pull');
    try {
      await this.git.pull('origin', config.repository.branch);
      logger.info('Git pull finished');
    } catch (error) {
      logger.error('Error in git pull: ' + error);
      throw error;
    }
  }

  private async runBuild(): Promise<void> {
    // 環境に応じた webpack 設定を選択
    const webpackConfig = isDevelopment() ? webpackDevConfig : webpackProdConfig;

    logger.info(
      `Starting webpack build in ${isDevelopment() ? 'development' : 'production'} mode`,
      { debug: true }
    );

    // webpack のビルドを非同期に実行
    const webpackAsync = promisify(webpack);

    try {
      const stats = await webpackAsync([webpackConfig]);

      if (stats.hasErrors()) {
        const errorDetails = stats.toString({
          colors: true,
          errors: true,
        });
        logger.error('Error in webpack build: ' + errorDetails);
        throw new Error('Webpack build failed with errors.');
      }

      logger.info(stats.toString({ colors: true }));
      logger.info('Webpack のビルドが完了しました。', { debug: true });
    } catch (err) {
      logger.error('Webpack build process failed: ' + err.message);
      throw err;
    }
  }
}
