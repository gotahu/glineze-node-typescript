import { z } from 'zod';

export type ConfigCategory =
  | 'countdown'
  | 'notifications'
  | 'practice-template'
  | 'advanced'
  | 'sesame';

export type ConfigInput = 'text' | 'textarea' | 'date' | 'url' | 'secret';

export type ConfigEffect = 'bot-profile' | 'practice-template' | 'sesame';

export type ConfigDefinition = {
  label: string;
  description: string;
  category: ConfigCategory;
  input: ConfigInput;
  secret?: boolean;
  editable?: boolean;
  effect?: ConfigEffect;
  schema: z.ZodType<string>;
};

const nonEmptyText = (max = 2_000) => z.string().trim().min(1).max(max);

const discordId = z
  .string()
  .trim()
  .regex(/^\d{15,22}$/, 'Discord ID は15〜22桁の数字で入力してください。');

const notionId = z
  .string()
  .trim()
  .refine(
    (value) =>
      /^[0-9a-f]{32}$/i.test(value) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value),
    'Notion ID は32桁の16進数またはUUID形式で入力してください。'
  );

const calendarDate = z
  .string()
  .trim()
  .refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, '実在する日を YYYY-MM-DD 形式で入力してください。');

const notifyDays = z
  .string()
  .trim()
  .transform((value, context) => {
    const parts = value.split(',').map((item) => item.trim());
    if (parts.length === 0 || parts.some((item) => !/^\d+$/.test(item) || Number(item) > 3650)) {
      context.addIssue({
        code: 'custom',
        message: '0〜3650の整数をカンマ区切りで入力してください。',
      });
      return z.NEVER;
    }
    return [...new Set(parts.map(Number))].sort((left, right) => right - left).join(',');
  });

export const CONFIG_DEFINITIONS = {
  countdown_title: {
    label: 'イベント名',
    description: 'カウントダウン対象のイベント名です。',
    category: 'countdown',
    input: 'text',
    effect: 'bot-profile',
    schema: nonEmptyText(200),
  },
  countdown_date: {
    label: '開催日',
    description: 'カウントダウン対象日です。',
    category: 'countdown',
    input: 'date',
    effect: 'bot-profile',
    schema: calendarDate,
  },
  countdown_channelid: {
    label: '通知先',
    description: 'カウントダウン通知を送る Discord チャンネル ID です。',
    category: 'countdown',
    input: 'text',
    schema: discordId,
  },
  countdown_notify_days: {
    label: '通知日',
    description: '残り何日に通知するかをカンマ区切りで指定します。',
    category: 'countdown',
    input: 'text',
    schema: notifyDays,
  },
  countdown_message: {
    label: '通知文',
    description: 'カウントダウン通知へ追加する文章です。',
    category: 'countdown',
    input: 'textarea',
    schema: nonEmptyText(2_000),
  },
  practice_remind_threadid: {
    label: '練習連絡の送信先',
    description: '毎日17時の練習連絡を送る Discord チャンネル ID です。',
    category: 'notifications',
    input: 'text',
    schema: discordId,
  },
  bashotori_remind_threadid: {
    label: '場所取り通知の送信先',
    description: '毎日8時の場所取り通知を送る Discord チャンネル ID です。',
    category: 'notifications',
    input: 'text',
    schema: discordId,
  },
  discord_general_channelid: {
    label: '標準チャンネル',
    description: 'Discord の標準送信先チャンネル ID です。',
    category: 'notifications',
    input: 'text',
    schema: discordId,
  },
  practice_announcement_template_page_id: {
    label: '練習連絡テンプレートページ',
    description: '練習連絡テンプレートを置いた Notion ページ ID です。',
    category: 'practice-template',
    input: 'text',
    effect: 'practice-template',
    schema: notionId,
  },
  practice_databaseid: {
    label: '練習データベース',
    description: '練習予定を管理する Notion データベース ID です。',
    category: 'advanced',
    input: 'text',
    schema: notionId,
  },
  facility_databaseid: {
    label: '施設データベース',
    description: '施設情報を管理する Notion データベース ID です。',
    category: 'advanced',
    input: 'text',
    schema: notionId,
  },
  shukin_databaseid: {
    label: '出欠データベース',
    description: '出欠情報を管理する Notion データベース ID です。',
    category: 'advanced',
    input: 'text',
    schema: notionId,
  },
  discord_and_notion_pairs_databaseid: {
    label: 'Discord・Notion 対応データベース',
    description: 'Discord ユーザーと Notion 団員を対応付けるデータベース ID です。',
    category: 'advanced',
    input: 'text',
    schema: notionId,
  },
  sesame_app_api_url: {
    label: 'Sesame API URL',
    description: 'Sesame API のベース URL です。',
    category: 'sesame',
    input: 'url',
    effect: 'sesame',
    schema: z.url(),
  },
  sesame_app_api_key: {
    label: 'Sesame API Key',
    description: '空欄で保存した場合は現在値を維持します。',
    category: 'sesame',
    input: 'secret',
    secret: true,
    effect: 'sesame',
    schema: nonEmptyText(2_000),
  },
  sesame_device_uuid: {
    label: 'Sesame デバイス UUID',
    description: 'Sesame デバイスの UUID です。',
    category: 'sesame',
    input: 'text',
    effect: 'sesame',
    schema: nonEmptyText(200),
  },
  sesame_device_publickey: {
    label: 'Sesame 公開鍵',
    description: '空欄で保存した場合は現在値を維持します。',
    category: 'sesame',
    input: 'secret',
    secret: true,
    effect: 'sesame',
    schema: nonEmptyText(4_000),
  },
  sesame_message_when_locked: {
    label: '施錠中メッセージ',
    description: 'Sesame が施錠中のときの表示です。',
    category: 'sesame',
    input: 'text',
    effect: 'sesame',
    schema: nonEmptyText(200),
  },
  sesame_message_when_unlocked: {
    label: '解錠中メッセージ',
    description: 'Sesame が解錠中のときの表示です。',
    category: 'sesame',
    input: 'text',
    effect: 'sesame',
    schema: nonEmptyText(200),
  },
  sesame_message_when_loading: {
    label: '取得中メッセージ',
    description: 'Sesame の状態を取得できないときの表示です。',
    category: 'sesame',
    input: 'text',
    effect: 'sesame',
    schema: nonEmptyText(200),
  },
} as const satisfies Record<string, ConfigDefinition>;

export type ConfigKey = keyof typeof CONFIG_DEFINITIONS;

export function isConfigKey(key: string): key is ConfigKey {
  return Object.hasOwn(CONFIG_DEFINITIONS, key);
}

export function normalizeConfigValue(key: string, value: string): string {
  if (!isConfigKey(key)) {
    const parsed = nonEmptyText(20_000).safeParse(value);
    if (!parsed.success) throw new ConfigValidationError(key, parsed.error.issues[0]?.message);
    return parsed.data;
  }

  const parsed = CONFIG_DEFINITIONS[key].schema.safeParse(value);
  if (!parsed.success) throw new ConfigValidationError(key, parsed.error.issues[0]?.message);
  return parsed.data;
}

export function isSensitiveConfigKey(key: string): boolean {
  return (
    (isConfigKey(key) &&
      'secret' in CONFIG_DEFINITIONS[key] &&
      Boolean(CONFIG_DEFINITIONS[key].secret)) ||
    /(token|api[_-]?key|secret|password|credential|privatekey|publickey|webhook)/i.test(key)
  );
}

export class ConfigValidationError extends Error {
  constructor(
    public readonly key: string,
    message = '設定値が不正です。'
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}
