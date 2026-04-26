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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
