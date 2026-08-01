export const CONFIG_KEYS = [
  'bashotori_remind_threadid',
  'countdown_channelid',
  'countdown_date',
  'countdown_message',
  'countdown_notify_days',
  'countdown_title',
  'discord_and_notion_pairs_databaseid',
  'discord_general_channelid',
  'facility_databaseid',
  'practice_databaseid',
  'practice_remind_threadid',
  'sesame_app_api_key',
  'sesame_app_api_url',
  'sesame_device_publickey',
  'sesame_device_uuid',
  'sesame_message_when_loading',
  'sesame_message_when_locked',
  'sesame_message_when_unlocked',
  'shukin_databaseid',
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

export type ConfigValueMap = {
  [K in Exclude<ConfigKey, 'countdown_notify_days'>]: string;
} & {
  countdown_notify_days: number[];
};

export type RawConfigUpdate = Readonly<{ key: string; value: string }>;
