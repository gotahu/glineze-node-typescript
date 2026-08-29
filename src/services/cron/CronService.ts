// src/services/cron/cronService.ts

import { config, configService } from '../../config';
import { Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { sendCountdownMessage, updateBotProfile } from '../discord/functions/CountdownFunctions';
import { notifyPractice, remindPracticesToChannel } from '../notion/practiceFunctions';
import { env } from '../../env';
import { AdminLoginLinkService } from '../admin/adminLoginLinkService';
import { synchronizeAllMembersRole } from '../discord/allMembersRole';

type CronSchedule = (
  expression: string,
  task: () => void | Promise<void>,
  options?: { timezone?: string }
) => { getNextRun?(): Date | null } | void;

/**
 * 定期実行タスクを一元管理するクラス
 */
export class CronService {
  private services: Services;
  private sesameSchedulerStarted = false;
  private countDownSchedulerStarted = false;
  private notifyPracticeStarted = false;
  private remindBashotoriStarted = false;
  private adminLoginLinkSchedulerStarted = false;
  private configSyncSchedulerStarted = false;
  private reminderSchedulerStarted = false;
  private reminderSchedulerRunning = false;
  private allMembersRoleSchedulerStarted = false;
  private allMembersRoleSchedulerRunning = false;
  private schedule!: CronSchedule;

  constructor(
    services: Services,
    private readonly adminLoginLinks?: AdminLoginLinkService
  ) {
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
    this.startConfigSyncScheduler();
    this.startNotifyPractice();
    this.startRemindBashotori();
    this.startReminderScheduler();
    this.startAllMembersRoleScheduler();
    if (this.adminLoginLinks) this.startAdminLoginLinkScheduler();
    logger.info('Cron スケジューラーを起動しました。');
  }

  /** 共有 Notion 設定を各プロセスへ定期的に反映します。 */
  private startConfigSyncScheduler(): void {
    if (this.configSyncSchedulerStarted) {
      logger.info('Config sync scheduler already started');
      return;
    }

    this.configSyncSchedulerStarted = true;
    logger.info('Starting config sync scheduler');
    this.schedule('*/1 * * * *', async () => {
      await this.runConfigSync();
    });
  }

  public async runConfigSync(): Promise<void> {
    try {
      await configService.refresh();
    } catch (error) {
      logger.error(`Config sync failed: ${error}`);
    }
  }

  private startReminderScheduler(): void {
    if (this.reminderSchedulerStarted) {
      logger.info('Reminder scheduler already started');
      return;
    }
    this.reminderSchedulerStarted = true;
    logger.info('Starting reminder scheduler');
    this.schedule(
      '* * * * *',
      async () => {
        await this.runReminderScheduler();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  public async runReminderScheduler(): Promise<void> {
    const reminderService = this.services.notion?.reminderService;
    if (!reminderService || this.reminderSchedulerRunning) return;
    this.reminderSchedulerRunning = true;
    try {
      await reminderService.dispatchDue(this.services.discord.client);
    } catch (error) {
      logger.error(`Reminder scheduler failed: ${error}`);
    } finally {
      this.reminderSchedulerRunning = false;
    }
  }

  /** 「全員」ロールを起動時と毎日4時に全サーバーメンバーへ同期します。 */
  private startAllMembersRoleScheduler(): void {
    if (this.allMembersRoleSchedulerStarted) {
      logger.info('All-members role scheduler already started');
      return;
    }

    this.allMembersRoleSchedulerStarted = true;
    logger.info('Starting all-members role scheduler');
    void this.runAllMembersRoleSync();
    this.schedule(
      '0 4 * * *',
      async () => {
        await this.runAllMembersRoleSync();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  public async runAllMembersRoleSync(): Promise<void> {
    if (this.allMembersRoleSchedulerRunning) return;
    this.allMembersRoleSchedulerRunning = true;
    try {
      await synchronizeAllMembersRole(this.services.discord.client);
    } catch (error) {
      logger.error(`All-members role scheduler failed: ${error}`);
    } finally {
      this.allMembersRoleSchedulerRunning = false;
    }
  }

  private startAdminLoginLinkScheduler(): void {
    if (this.adminLoginLinkSchedulerStarted || !this.adminLoginLinks) return;
    this.adminLoginLinkSchedulerStarted = true;
    void this.runAdminLoginLinkRotation();
    const task = this.schedule(
      env.ADMIN_TOKEN_ROTATION_CRON,
      async () => {
        await this.runAdminLoginLinkRotation();
        const nextRun = task?.getNextRun?.();
        if (nextRun) this.adminLoginLinks?.setNextRotationAt(nextRun);
      },
      {
        timezone: 'Asia/Tokyo',
      }
    );
    const nextRun = task?.getNextRun?.();
    if (nextRun) this.adminLoginLinks.setNextRotationAt(nextRun);
  }

  public async runAdminLoginLinkRotation(): Promise<void> {
    if (!this.adminLoginLinks) return;
    try {
      await this.adminLoginLinks.rotate();
    } catch {
      // AdminLoginLinkService records a redacted error. A temporary Notion failure
      // must not stop the remaining schedulers or the application process.
    }
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
    this.schedule('*/5 * * * *', async () => {
      await this.runSesameScheduler();
    });
  }

  /**
   * Sesame の状態を更新するジョブ
   */
  private async runSesameScheduler() {
    try {
      const { discord, sesame } = this.services;
      const sesameDiscordService = discord.sesameDiscordService;

      if (!sesame || !sesame.isEnabled() || !sesameDiscordService) {
        logger.info('Sesame status scheduler skipped because the integration is disabled');
        return;
      }

      logger.info('Updating Sesame status (manual or scheduled)');
      sesame.getSesameDeviceStatus().then((deviceStatus) => {
        logger.debug(`Device status: ${JSON.stringify(deviceStatus, null, 2)}`);
        sesameDiscordService.updateSesameStatusAllVoiceChannels(deviceStatus);
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
    this.schedule(
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
    this.schedule(
      '0 17 * * *',
      () => {
        this.runNotifyPractice();
      },
      { timezone: 'Asia/Tokyo' }
    );
  }

  private async runNotifyPractice() {
    try {
      logger.info('練習連絡送信の定期実行を開始します。', { debug: true });

      const threadId = config.getConfig('practice_remind_threadid');

      // 1日後の練習を通知する
      await notifyPractice(this.services, { channelId: threadId, daysFromToday: 1 });

      logger.info('練習連絡送信の定期実行を終了しました。', { debug: true });
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
    this.schedule(
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
