export type LINEDiscordPairInfo = {
  name: string;
  line_group_id: string;
  discord_channel_id: string;
  line_notify_key: string;
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

export type NotionDiscordPairInfo = {
  name: string;
  notionPageId: string;
  discordUserId: string;
};

export type NotificationMessage = {
  messageId: string;
  userId: string[];
};

export type LINENotifyPayload = {
  username: string;
  channelid: string;
  groupname: string;
  message: string;
  avatarURL: string;
  imageURL?: string;
  previewURL?: string;
  hasImage: boolean;
};

export type GASEvent = {
  type: string;
  groupid?: string;
  name?: string;
  message?: string;
};
