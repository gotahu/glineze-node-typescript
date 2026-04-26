export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  ERROR = 'ERROR',
}

export interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
  loggerChannelId: string;
  lineNotifyToken: string;
  discordWebhookUrl: string;
  enableDebugOutput: boolean;
}
