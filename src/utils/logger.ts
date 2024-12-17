import { DiscordService } from '../services/discord/discordService';
import { postToLINENotify } from '../services/lineNotifyService';
import { sendDiscordWebhookMessage } from '../services/discord/discordWebhook';
import { LoggerConfig, LogMessage, LogLevel } from '../types/types';

export class Logger {
  private static instance: Logger;
  private readonly config: LoggerConfig;
  private discordService?: DiscordService; // 後から注入されるDiscordService

  private constructor(config: LoggerConfig) {
    this.config = config;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger({
        loggerChannelId: '1273731421663395973',
        lineNotifyToken: process.env.LINE_NOTIFY_VOID_TOKEN,
        discordWebhookUrl: process.env.DISCORD_ERROR_LOG_WEBHOOK,
        enableDebugOutput: process.env.NODE_ENV !== 'production',
      });
    }
    return Logger.instance;
  }

  /**
   * DiscordServiceを後から注入するメソッド
   * DiscordServiceが完全に初期化されてから呼び出してください。
   */
  public setDiscordService(discordService: DiscordService): void {
    this.discordService = discordService;
  }

  private formatLogMessage(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): LogMessage {
    return {
      level,
      message,
      timestamp: new Date(),
      metadata,
    };
  }

  private async sendToDiscord(logMessage: LogMessage): Promise<void> {
    // DiscordService が未初期化ならDiscordへの送信はスキップ
    if (!this.discordService) {
      return;
    }

    try {
      const formattedMessage = `[${logMessage.level}] [${logMessage.timestamp.toISOString()}] ${logMessage.message}`;
      await this.discordService.sendStringsToChannel(
        [formattedMessage],
        this.config.loggerChannelId
      );
    } catch (error) {
      console.error(
        `Failed to send message to Discord: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async sendToLineNotify(logMessage: LogMessage): Promise<void> {
    try {
      const formattedMessage = `[${logMessage.level}] ${logMessage.message}`;
      await postToLINENotify(this.config.lineNotifyToken, formattedMessage);
    } catch (error) {
      console.error(
        `Failed to send message to LINE Notify: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async sendToWebhook(logMessage: LogMessage): Promise<void> {
    try {
      const formattedMessage = `[${logMessage.level}] ${logMessage.message}`;
      await sendDiscordWebhookMessage(this.config.discordWebhookUrl, formattedMessage);
    } catch (error) {
      console.error(
        `Failed to send message to Discord webhook: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public async info(message: string, metadata?: Record<string, unknown>): Promise<void> {
    const logMessage = this.formatLogMessage(LogLevel.INFO, message, metadata);
    console.log(`[${logMessage.timestamp.toISOString()}] ${logMessage.message}`);

    // debugオプション付きの場合はLINEとWebhookにも送信
    if (metadata?.debug) {
      await Promise.allSettled([
        this.sendToLineNotify(logMessage),
        this.sendToWebhook(logMessage),
        this.sendToDiscord(logMessage),
      ]);
    }
  }

  public async debug(message: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.config.enableDebugOutput) return;

    const logMessage = this.formatLogMessage(LogLevel.DEBUG, message, metadata);
    console.log(`[${logMessage.timestamp.toISOString()}] ${logMessage.message}`);
    await this.sendToDiscord(logMessage);
  }

  public async error(message: string, metadata?: Record<string, unknown>): Promise<void> {
    const logMessage = this.formatLogMessage(LogLevel.ERROR, message, metadata);
    console.error(`[${logMessage.timestamp.toISOString()}] ${logMessage.message}`);

    await Promise.allSettled([
      this.sendToLineNotify(logMessage),
      this.sendToWebhook(logMessage),
      this.sendToDiscord(logMessage),
    ]);
  }
}

export const logger = Logger.getInstance();
