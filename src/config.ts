import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { getStringPropertyValue, queryAllDatabasePages } from './utils/notionUtils';

dotenv.config();

// バリデーション関数
function validateEnvVar(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not defined in the environment variables.`);
  }
  return value;
}

// 設定オブジェクト
export const config = {
  discord: {
    botToken: validateEnvVar(process.env.DISCORD_BOT_TOKEN, 'DISCORD_BOT_TOKEN'),
    webHook: validateEnvVar(process.env.DISCORD_ERROR_LOG_WEBHOOK, 'DISCORD_ERROR_LOG_WEBHOOK'),
    relayWebhook: validateEnvVar(process.env.DISCORD_RELAY_WEBHOOK, 'DISCORD_RELAY_WEBHOOK'),
  },
  notion: {
    token: validateEnvVar(process.env.NOTION_TOKEN, 'NOTION_TOKEN'),
    configurationDatabaseId: validateEnvVar(
      process.env.NOTION_CONFIGURATION_DATABASEID,
      'NOTION_CONFIGURATION_DATABASEID'
    ),
  },
  lineNotify: {
    voidToken: process.env.LINE_NOTIFY_VOID_TOKEN || '',
  },
  lineBot: {
    channelSecret: process.env.LINEBOT_CHANNEL_SECRET || '',
    channelAccessToken: process.env.LINEBOT_CHANNEL_ACCESS_TOKEN || '',
  },
  app: {
    port: Number(process.env.PORT) || 3001,
  },
  repository: {
    path: process.env.REPOSITORY_PATH || '',
    branch: process.env.BRANCH || 'refs/heads/main',
  },
  notionConfigs: new Map<string, string>(),

  // 設定の初期化
  async initializeConfig() {
    logger.info('Config の初期化を開始します。');
    try {
      const client = new Client({ auth: this.notion.token });
      const databaseId = this.notion.configurationDatabaseId;
      const pages = await queryAllDatabasePages(client, databaseId);

      for (const page of pages) {
        if ('properties' in page) {
          const keyName = getStringPropertyValue(page, 'key');
          const keyValue = getStringPropertyValue(page, 'value');

          if (keyName && keyValue) {
            this.notionConfigs.set(keyName, keyValue);
          }
        }
      }

      console.log(this.notionConfigs);
      logger.info('Config を Notion から読み込み、初期化が完了しました。');
    } catch (error) {
      logger.error(`Config の初期化に失敗しました: ${error}`);
      throw new Error('Failed to initialize configuration');
    }
  },

  // 設定値の取得
  getConfig(key: string): string {
    const value = this.notionConfigs.get(key);
    if (!value) {
      throw new Error(
        `Config に key: ${key} が存在しません。正しく設定されているかどうか、スペルが間違っていないかよく確認してください。リロードするには、DM で「リロード」と送信してください。`
      );
    }
    return value;
  },
};
