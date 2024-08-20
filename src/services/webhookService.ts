import simpleGit, { SimpleGit } from 'simple-git';
import { config } from '../config/config';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import webpack from 'webpack';

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

      logger.info('Build finished');
    } else {
      logger.info(`Received push event for branch ${branch}, but ignored`);
    }
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
      webpack(config.webpack, (err, stats) => {
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
