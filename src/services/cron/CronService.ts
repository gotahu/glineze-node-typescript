// src/services/cron/cronService.ts

import { schedule } from 'node-cron';
import { Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { updateBotProfile } from '../discord/countdown';

/**
 * 定期実行タスクを一元管理するクラス
 */
export class CronService {
  private services: Services;
  private sesameSchedulerStarted = false;
  private countDownSchedulerStarted = false;

  constructor(services: Services) {
    this.services = services;
  }

  /**
   * スケジューラを開始するメソッド
   */
  public start() {
    // ここで複数のジョブをスケジュール登録したりする
    this.startSesameScheduler();
    this.startCountdownScheduler();
  }

  /**
   * Sesame の状態を定期的に確認して Discord VoiceChannel を更新するジョブ
   */
  private startSesameScheduler(): void {
    if (this.sesameSchedulerStarted) {
      logger.info('Sesame status scheduler already started');
      return;
    }

    this.sesameSchedulerStarted = true;
    logger.info('Starting Sesame status scheduler');

    // セサミの状態を即時更新
    this.runSesameScheduler();

    // 5 分おきに実行する
    schedule('*/5 * * * *', async () => {
      await this.runSesameScheduler();
    });
  }

  /**
   * Sesame の状態を更新するジョブ
   */
  private async runSesameScheduler() {
    try {
      const { discord, sesame } = this.services;

      logger.info('Updating Sesame status (manual or scheduled)');
      sesame.getSesameDeviceStatus().then((deviceStatus) => {
        logger.debug(`Device status: ${JSON.stringify(deviceStatus, null, 2)}`);
        discord.sesameDiscordService.updateSesameStatusAllVoiceChannels(deviceStatus);
      });
    } catch (error) {
      logger.error(`onSesameScheduler: Error updating Sesame status: ${error}`);
    }
  }

  /**
   * カウントダウンを更新するジョブ
   */
  private startCountdownScheduler() {
    if (this.countDownSchedulerStarted) {
      logger.info('Countdown scheduler already started');
      return;
    }

    this.countDownSchedulerStarted = true;
    logger.info('Starting Countdown scheduler');

    // カウントダウンを即時更新
    this.runCountdownScheduler();

    // 1 日おきに実行する
    schedule('0 0 * * *', () => {
      this.runCountdownScheduler();
    });
  }

  /**
   * カウントダウンを更新するジョブ
   */
  private runCountdownScheduler() {
    try {
      const { discord } = this.services;

      if (!discord) {
        logger.error('onCountdownScheduler: Discord service not available');
        return;
      }

      logger.info('Updating countdown (manual or scheduled)');
      updateBotProfile(discord);
    } catch (error) {
      logger.error(`onCountdownScheduler: Error updating countdown: ${error}`);
    }
  }
}
