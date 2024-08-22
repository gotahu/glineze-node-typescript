import simpleGit, { SimpleGit } from 'simple-git';
import { config } from '../config/config';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import webpack from 'webpack';
import fs from 'fs';
import { isDevelopment } from '../utils/environment';

// webpack の設定をインポート
import webpackDevConfig from '../../webpack/webpack.dev';
import webpackProdConfig from '../../webpack/webpack.prod';
import { promisify } from 'util';
export class WebhookService {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit(config.repository.path);
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

  private async getFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => reject(err));
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  private async pullChanges(): Promise<void> {
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
    } catch (err) {
      logger.error('Webpack build process failed: ' + err.message);
      throw err;
    }
  }
}
