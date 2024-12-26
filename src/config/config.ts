import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { logger } from '../utils/logger';
import { getStringPropertyValue, queryAllDatabasePages } from '../utils/notionUtils';

dotenv.config();

export const config = {
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    webHook: process.env.DISCORD_ERROR_LOG_WEBHOOK,
  },
  notion: {
    token: process.env.NOTION_TOKEN,
    configurationDatabaseId: process.env.NOTION_CONFIGURATION_DATABASEID,
  },
  lineNotify: {
    voidToken: process.env.LINE_NOTIFY_VOID_TOKEN,
  },
  lineBot: {
    channelSecret: process.env.LINEBOT_CHANNEL_SECRET,
    channelAccessToken: process.env.LINEBOT_CHANNEL_ACCESS_TOKEN,
  },
  server: {
    port: Number(process.env.SERVER_PORT) || 3000,
  },
  app: {
    port: Number(process.env.APP_PORT) || 3001,
  },
  webhook: {
    port: Number(process.env.WEBHOOK_PORT) || 3002,
    secret: process.env.WEBHOOK_SECRET,
    restartToken: process.env.WEBHOOK_RESTART_TOKEN,
  },
  oshigla: {
    port: Number(process.env.OSHIGLA_PORT) || 3003,
  },
  repository: {
    path: process.env.REPOSITORY_PATH,
    branch: process.env.BRANCH || 'refs/heads/main',
  },
  notionConfigs: new Map<string, string>(),
  async initializeConfig() {
    logger.info('config の初期化を開始します。');
    try {
      const client = new Client({ auth: config.notion.token });
      const databaseId = config.notion.configurationDatabaseId;
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

      logger.info('config を Notion から読み込み、初期化が完了しました。');
      console.log(this.notionConfigs);
    } catch (error) {
      logger.error(`config の初期化に失敗しました: ${error}`);
      throw new Error('Failed to initialize configuration');
    }
  },
  getConfig(key: string): string {
    const value = this.notionConfigs.get(key);
    if (!value) {
      throw new Error(
        `config に key: ${key} が存在しません。正しく設定されているか、スペルが間違っていないかよく確認してください。リロードするには、DM で「リロード」と送信してください。`
      );
    }
    return value;
  },
};

// Validation
if (!config.discord.botToken) {
  throw new Error('DISCORD_BOT_TOKEN is not defined');
}

if (!config.notion.token) {
  throw new Error('NOTION_TOKEN is not defined');
}

if (!config.notion.configurationDatabaseId) {
  throw new Error('NOTION_CONFIGURATION_DATABASEID is not defined');
}

if (!config.webhook.secret) {
  throw new Error('WEBHOOK_SECRET is not defined');
}

// Ensure all ports are different
const ports = [config.server.port, config.app.port, config.webhook.port];
if (new Set(ports).size !== ports.length) {
  throw new Error('SERVER_PORT, APP_PORT, and WEBHOOK_PORT must all be different');
}
