import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { StatusPropertyType } from '../utils/notionUtils';

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

export function isNotionAutomationWebhookEvent(obj: unknown): obj is NotionAutomationWebhookEvent {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  const source = candidate.source;
  if (typeof source !== 'object' || source === null) return false;
  const sourceRecord = source as Record<string, unknown>;

  return (
    typeof sourceRecord.type === 'string' &&
    typeof sourceRecord.automation_id === 'string' &&
    typeof sourceRecord.action_id === 'string' &&
    typeof sourceRecord.event_id === 'string' &&
    typeof sourceRecord.attempt === 'number' &&
    typeof candidate.data === 'object' &&
    candidate.data !== null
  );
}
