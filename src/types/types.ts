export type LINEDiscordPairInfo = {
  name: string;
  lineGroupId: string;
  discordChannelId: string;
  lineNotifyKey: string;
  priority: boolean;
  includeThreads: boolean;
};

export type SesameAPIResponse = {
  type: number;
  timeStamp: number;
  historyTag: string;
  recordID: number;
  parameter: string;
};

export type LockInfo = {
  status: SesameStatus;
  latestType: number;
  timestamp: Date;
};

export enum SesameStatus {
  Locked = 1,
  Unlocked = 2,
  Error = 3,
}

export const StatusMessage = {
  [SesameStatus.Locked]: '🔐施錠中',
  [SesameStatus.Unlocked]: '🔓解錠中',
  [SesameStatus.Error]: '😵‍💫エラー',
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
  timetable: string;
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
