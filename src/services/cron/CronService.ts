// src/services/cron/cronService.ts

import { schedule } from 'node-cron';
import { config } from '../../config';
import { Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { sendCountdownMessage, updateBotProfile } from '../discord/functions/CountdownFunctions';
import { notifyPractice, remindPracticesToChannel } from '../notion/practiceFunctions';

/**
 * 定期実行タスクを一元管理するクラス
 */
export class CronService {
  private services: Services;
  private sesameSchedulerStarted = false;
  private countDownSchedulerStarted = false;
  private notifyPracticeStarted = false;
  private remindBashotoriStarted = false;

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
    this.startNotifyPractice();
    this.startRemindBashotori();
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

    // 毎日0時1分に実行する
    schedule(
      '1 0 * * *',
      () => {
        this.runCountdownScheduler();
        this.runSendCountdownMessage();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  /**
   * カウントダウンを更新するジョブ
   */
  private runCountdownScheduler() {
    try {
      const { discord } = this.services;

      if (!discord) {
        logger.error('runCountdownScheduler: Discord service not available');
        return;
      }

      logger.info('Updating countdown (manual or scheduled)');
      updateBotProfile(discord);
    } catch (error) {
      logger.error(`runCountdownScheduler: Error updating countdown: ${error}`);
    }
  }

  private runSendCountdownMessage() {
    try {
      const { discord } = this.services;

      if (!discord) {
        logger.error('runSendCountdownMessage: Discord service not available');
        return;
      }

      logger.info('runSendCountdownMessage: Sending countdown message (manual or scheduled)', {
        debug: true,
      });
      sendCountdownMessage(this.services);
    } catch (error) {
      logger.error(`runSendCountdownMessage: Error sending countdown message: ${error}`);
    }
  }

  private startNotifyPractice() {
    if (this.notifyPracticeStarted) {
      logger.info('Notify practice scheduler already started');
      return;
    }

    this.notifyPracticeStarted = true;
    logger.info('Starting Notify practice scheduler');

    // 毎日17時に実行する
    schedule(
      '0 17 * * *',
      () => {
        this.runNotifyPractice();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  private async runNotifyPractice() {
    try {
      logger.info('Notify practice (manual or scheduled)', { debug: true });

      const threadId = config.getConfig('practice_remind_threadid');

      // 1日後の練習を通知する
      await notifyPractice(this.services, { channelId: threadId, daysFromToday: 1 });
    } catch (error) {
      logger.error(`onNotifyPractice: Error notify practice: ${error}`);
    }
  }

  private startRemindBashotori() {
    if (this.remindBashotoriStarted) {
      logger.info('Remind Bashotori scheduler already started');
      return;
    }

    this.remindBashotoriStarted = true;
    logger.info('Starting Remind Bashotori scheduler');

    // 毎日8時に実行する
    schedule(
      '0 8 * * *',
      () => {
        this.runRemindBashotori();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  private async runRemindBashotori() {
    try {
      logger.info('Remind Bashotori (manual or scheduled)', { debug: true });

      const threadId = config.getConfig('bashotori_remind_threadid');
      // 1日後の練習を通知する
      await remindPracticesToChannel(this.services, threadId);
    } catch (error) {
      logger.error(`onRemindBashotori: Error remind Bashotori: ${error}`);
    }
  }
}
