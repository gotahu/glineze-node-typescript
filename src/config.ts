import { Client } from '@notionhq/client';
import { env } from './env';
import { logger } from './utils/logger';
import { getStringPropertyValue, queryAllDatabasePages } from './utils/notionUtils';

// 設定オブジェクト
export const config = {
  discord: {
    botToken: env.DISCORD_BOT_TOKEN,
    webHook: env.DISCORD_ERROR_LOG_WEBHOOK,
    relayWebhook: env.DISCORD_RELAY_WEBHOOK,
  },
  notion: {
    token: env.NOTION_TOKEN,
    configurationDatabaseId: env.NOTION_CONFIGURATION_DATABASEID,
  },
  app: {
    port: env.PORT,
  },
  repository: {
    path: env.REPOSITORY_PATH,
    branch: env.BRANCH,
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

      logger.debug(`Loaded configs: ${JSON.stringify(Object.fromEntries(this.notionConfigs), null, 2)}`);
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
