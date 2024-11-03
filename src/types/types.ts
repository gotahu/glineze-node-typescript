export type LINEDiscordPairInfo = {
  name: string;
  lineGroupId: string;
  discordChannelId: string;
  lineNotifyKey: string;
  priority: boolean;
  includeThreads: boolean;
};

export type SesameHistory = {
  type: number;
  timeStamp: number;
  historyTag?: string;
  recordID: number;
  parameter: string;
};

export type SesameAPIResponse = {
  histories: SesameHistory[];
  cursor: number;
};

export type SesameDeviceStatus = {
  lockStatus: SesameLockStatus;
  latestType: number;
  timestamp: Date;
};

export enum SesameLockStatus {
  Locked = 1,
  Unlocked = 2,
  Error = 3,
}

export const StatusMessage = {
  [SesameLockStatus.Locked]: '倉庫｜🔐施錠中',
  [SesameLockStatus.Unlocked]: '倉庫｜🔓解錠中',
  [SesameLockStatus.Error]: '倉庫｜🔄取得中',
};

export type ShukinReply = {
  status: 'success' | 'error';
  message: string;
};

export type ShukinInfo = {
  shukinName: string;
  shukinAmount: string;
  shukinStatus: string;
};

export type Practice = {
  title: string;
  date: Date;
  time: string;
  place: string;
  content: string;
  announceText: string;
  id: string;
  url: string;
};

export type GlanzeMember = {
  name: string;
  notionPageId: string;
  discordUserId: string;
  generation: string;
  part4: string;
  part8: string;
};

export type NotificationMessage = {
  messageId: string;
  userId: string[];
};

export type GASEvent = {
  type: string;
  groupid?: string;
  name?: string;
  message?: string;
};

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
