// src/services/cron/cronService.ts

import { config } from '../../config';
import type { ServiceContainer } from '../../bootstrap/ServiceContainer';
import {
  sendCountdownMessage,
  updateBotProfile,
} from '../../features/countdown/CountdownFunctions';
import { notifyPractice, remindPracticesToChannel } from '../../features/practice/practiceUseCases';
import type { ScheduledTask } from 'node-cron';
import { logger } from '../../utils/logger';
import { ScheduledJob } from './ScheduledJob';

type CronSchedule = typeof import('node-cron').schedule;

/**
 * 定期実行タスクを一元管理するクラス
 */
export class CronService {
  private services: ServiceContainer;
  private sesameSchedulerStarted = false;
  private countDownSchedulerStarted = false;
  private notifyPracticeStarted = false;
  private remindBashotoriStarted = false;
  private schedule!: CronSchedule;
  private readonly tasks: ScheduledTask[] = [];
  private readonly jobs = new Map<string, ScheduledJob>();

  constructor(services: ServiceContainer) {
    logger.info('CronService の初期化を開始します。');
    this.services = services;
    logger.info('CronService の初期化が終了しました。');
  }

  /**
   * スケジューラを開始するメソッド
   */
  public async start(): Promise<void> {
    logger.info('Cron スケジューラーを起動します……');
    const { schedule } = await import('node-cron');
    this.schedule = schedule;

    // ここで複数のジョブをスケジュール登録したりする
    if (this.services.sesame && this.services.discord.sesameDiscordService) {
      this.startSesameScheduler();
    } else {
      logger.info('Sesame status scheduler is disabled');
    }
    this.startCountdownScheduler();
    this.startNotifyPractice();
    this.startRemindBashotori();
    logger.info('Cron スケジューラーを起動しました。');
  }

  public async stop(): Promise<void> {
    for (const task of this.tasks.splice(0).reverse()) {
      await task.stop();
      await task.destroy();
    }
    this.sesameSchedulerStarted = false;
    this.countDownSchedulerStarted = false;
    this.notifyPracticeStarted = false;
    this.remindBashotoriStarted = false;
    this.jobs.clear();
    logger.info('Cron スケジューラーを停止しました。');
  }

  private register(
    expression: string,
    task: () => void | Promise<void>,
    options?: { timezone?: string }
  ): void {
    this.tasks.push(this.schedule(expression, task, options));
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
    this.register('*/5 * * * *', async () => {
      await this.runSesameScheduler();
    });
  }

  /**
   * Sesame の状態を更新するジョブ
   */
  private async runSesameScheduler() {
    await this.runJob('sesame-status', async () => {
      const { discord, sesame } = this.services;
      const sesameDiscordService = discord.sesameDiscordService;

      if (!sesame || !sesameDiscordService) {
        logger.info('Sesame status scheduler skipped because the integration is disabled');
        return;
      }

      logger.info('Updating Sesame status (manual or scheduled)');
      const deviceStatus = await sesame.getSesameDeviceStatus();
      logger.debug(`Device status: ${JSON.stringify(deviceStatus, null, 2)}`);
      await sesameDiscordService.updateSesameStatusAllVoiceChannels(deviceStatus);
    });
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
    void this.runCountdownScheduler();

    // 毎日0時1分に実行する
    this.register(
      '1 0 * * *',
      async () => {
        await this.runCountdownScheduler();
        await this.runSendCountdownMessage();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  /**
   * カウントダウンを更新するジョブ
   */
  private async runCountdownScheduler() {
    await this.runJob('countdown-profile', async () => {
      const { discord } = this.services;

      if (!discord) {
        logger.error('runCountdownScheduler: Discord service not available');
        return;
      }

      logger.info('Updating countdown (manual or scheduled)');
      updateBotProfile(discord);
    });
  }

  private async runSendCountdownMessage(): Promise<void> {
    await this.runJob('countdown-notification', async () => {
      const { discord } = this.services;

      if (!discord) {
        logger.error('runSendCountdownMessage: Discord service not available');
        return;
      }

      logger.info('runSendCountdownMessage: Sending countdown message (manual or scheduled)', {
        debug: true,
      });
      await sendCountdownMessage(this.services);
    });
  }

  private startNotifyPractice() {
    if (this.notifyPracticeStarted) {
      logger.info('Notify practice scheduler already started');
      return;
    }

    this.notifyPracticeStarted = true;
    logger.info('Starting Notify practice scheduler');

    // 毎日17時に実行する
    this.register(
      '0 17 * * *',
      async () => {
        await this.runNotifyPractice();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  private async runNotifyPractice() {
    await this.runJob('practice-notification', async () => {
      logger.info('練習連絡送信の定期実行を開始します。', { debug: true });

      const threadId = config.get('practice_remind_threadid');

      // 1日後の練習を通知する
      await notifyPractice(this.services, { channelId: threadId, daysFromToday: 1 });

      logger.info('練習連絡送信の定期実行を終了しました。', { debug: true });
    });
  }

  private startRemindBashotori() {
    if (this.remindBashotoriStarted) {
      logger.info('Remind Bashotori scheduler already started');
      return;
    }

    this.remindBashotoriStarted = true;
    logger.info('Starting Remind Bashotori scheduler');

    // 毎日8時に実行する
    this.register(
      '0 8 * * *',
      async () => {
        await this.runRemindBashotori();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  private async runRemindBashotori() {
    await this.runJob('practice-reminder', async () => {
      logger.info('Remind Bashotori (manual or scheduled)', { debug: true });

      const threadId = config.get('bashotori_remind_threadid');
      // 1日後の練習を通知する
      await remindPracticesToChannel(this.services, threadId);
    });
  }

  private async runJob(name: string, operation: () => Promise<void>): Promise<void> {
    let job = this.jobs.get(name);
    if (!job) {
      job = new ScheduledJob(name, operation);
      this.jobs.set(name, job);
    }
    await job.run();
  }
}
