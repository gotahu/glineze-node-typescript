import { DiscordService } from '../services/discord/discordService';
import { postToLINENotify } from '../services/lineNotifyService';
import { sendDiscordWebhookMessage } from '../services/discord/discordWebhook';
import { LoggerConfig, LogMessage, LogLevel } from '../types/types';

export class Logger {
  private static instance: Logger;
  private readonly config: LoggerConfig;

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
    try {
      const discordService = DiscordService.getInstance();
      if (!discordService) {
        throw new Error('DiscordService is not initialized');
      }

      const formattedMessage = `[${logMessage.level}] [${logMessage.timestamp.toISOString()}] ${logMessage.message}`;
      await discordService.sendStringsToChannel([formattedMessage], this.config.loggerChannelId);
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

    if (metadata?.debug) {
      await Promise.allSettled([this.sendToLineNotify(logMessage), this.sendToWebhook(logMessage)]);
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

// 使いやすいようにデフォルトエクスポートを提供
export const logger = Logger.getInstance();
