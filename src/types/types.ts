import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { DiscordService } from '../services/discord/discordService';
import { NotionService } from '../services/notion/notionService';
import { SesameService } from '../services/sesame/sesameService';
import { StatusPropertyType } from '../utils/notionUtils';

export type Services = {
  discord: DiscordService;
  notion: NotionService;
  sesame: SesameService;
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

export type ShukinReply = {
  status: 'success' | 'error';
  message: string;
};

export type ShukinInfo = {
  shukinName: string;
  shukinAmount: string;
  shukinStatus: string;
  shukinStatusPropertyType: StatusPropertyType;
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

export interface NotionAutomationWebhookEvent {
  source: {
    type: string;
    automation_id: string;
    action_id: string;
    event_id: string;
    attempt: number;
  };
  data: PageObjectResponse;
}

export function isNotionAutomationWebhookEvent(obj: any): obj is NotionAutomationWebhookEvent {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.source &&
    typeof obj.source === 'object' &&
    typeof obj.source.type === 'string' &&
    typeof obj.source.automation_id === 'string' &&
    typeof obj.source.action_id === 'string' &&
    typeof obj.source.event_id === 'string' &&
    typeof obj.source.attempt === 'number' &&
    obj.data &&
    typeof obj.data === 'object'
  );
}
