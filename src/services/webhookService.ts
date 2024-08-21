import simpleGit, { SimpleGit } from 'simple-git';
import { config } from '../config/config';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import webpack from 'webpack';
import path from 'path';
import fs from 'fs';
import { isDevelopment } from '../utils/environment';

// webpack の設定をインポート
import webpackDevConfig from '../../webpack/webpack.dev';
import webpackProdConfig from '../../webpack/webpack.prod';
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

  public async handlePushEvent(branch: string): Promise<void> {
    if (branch === config.repository.branch) {
      logger.info(`Received push event for branch ${branch}`);

      await this.pullChanges();
      await this.runBuild();

      // app.js の変更を確認
      const appJsPath = path.join(__dirname, '../../app.js');
      const hasChanged = await this.checkFileChanged(appJsPath);

      if (hasChanged) {
        logger.info('app.js has changed. The server will restart automatically.');
      } else {
        logger.info('No changes detected in app.js. No restart needed.');
      }

      logger.info('Build and check finished');
    } else {
      logger.info(`Received push event for branch ${branch}, but ignored`);
    }
  }

  private async checkFileChanged(filePath: string): Promise<boolean> {
    const oldHash = await this.getFileHash(filePath);
    const newHash = await this.getFileHash(filePath);
    return oldHash !== newHash;
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
    return new Promise((resolve, reject) => {
      // 環境に応じた webpack 設定を選択
      const webpackConfig = isDevelopment() ? webpackDevConfig : webpackProdConfig;

      webpack(webpackConfig, (err, stats) => {
        if (err || stats.hasErrors()) {
          logger.error('Error in webpack build: ' + err);
          reject(new Error('Webpack build failed'));
        } else {
          logger.info(stats.toString({ colors: true }));
          resolve();
        }
      });
    });
  }
}
