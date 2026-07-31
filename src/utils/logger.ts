import { EventEmitter } from 'events';
import { env } from '../env';
import { LoggerConfig, LogLevel, LogMessage } from '../types/types';

export class Logger extends EventEmitter {
  private static instance: Logger;
  private readonly config: LoggerConfig;

  private constructor(config: LoggerConfig) {
    super();
    this.config = config;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger({
        loggerChannelId: '1273731421663395973',
        lineNotifyToken: env.LINE_NOTIFY_VOID_TOKEN || '',
        enableDebugOutput: env.NODE_ENV !== 'production',
      });
    }
    return Logger.instance;
  }

  public getLoggerChannelId(): string {
    return this.config.loggerChannelId;
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

  private emitDiscordLog(logMessage: LogMessage): void {
    // Instead of using DiscordService directly, emit an event so app.ts can handle it
    this.emit('discordLog', logMessage);
  }

  public async info(message: string, metadata?: Record<string, unknown>): Promise<void> {
    const logMessage = this.formatLogMessage(LogLevel.INFO, message, metadata);
    console.log(`[${logMessage.timestamp.toISOString()}] ${logMessage.message}`);

    if (metadata?.debug) {
      this.emitDiscordLog(logMessage);
    }
  }

  public async debug(message: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.config.enableDebugOutput) return;

    const logMessage = this.formatLogMessage(LogLevel.DEBUG, message, metadata);
    console.log(`[${logMessage.timestamp.toISOString()}] ${logMessage.message}`);
    this.emitDiscordLog(logMessage);
  }

  public async error(message: string, metadata?: Record<string, unknown>): Promise<void> {
    const logMessage = this.formatLogMessage(LogLevel.ERROR, message, metadata);
    console.error(`[${logMessage.timestamp.toISOString()}] ${logMessage.message}`);

    this.emitDiscordLog(logMessage);
  }
}

export const logger = Logger.getInstance();
