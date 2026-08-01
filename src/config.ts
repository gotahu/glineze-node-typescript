import { Client } from '@notionhq/client';
import { env } from './env';
import { logger } from './utils/logger';
import { getStringPropertyValue, queryAllDatabasePages } from './utils/notionUtils';

type ConfigurationPage = {
  pageId: string;
  valuePropertyType: 'rich_text' | 'title' | 'url' | 'number' | 'select' | 'multi_select';
};

// 設定オブジェクト
export const config = {
  discord: {
    botToken: env.DISCORD_BOT_TOKEN,
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
  configurationPages: new Map<string, ConfigurationPage>(),

  // 設定の初期化
  async initializeConfig() {
    logger.info('Config の初期化を開始します。');
    try {
      const client = new Client({ auth: this.notion.token });
      const databaseId = this.notion.configurationDatabaseId;
      const pages = await queryAllDatabasePages(client, databaseId);

      this.notionConfigs.clear();
      this.configurationPages.clear();

      for (const page of pages) {
        if ('properties' in page) {
          const keyName = getStringPropertyValue(page, 'key');
          const keyValue = getStringPropertyValue(page, 'value');

          if (keyName && keyValue) {
            this.notionConfigs.set(keyName, keyValue);
            const valueProperty = page.properties.value;
            if (
              valueProperty &&
              ['rich_text', 'title', 'url', 'number', 'select', 'multi_select'].includes(
                valueProperty.type
              )
            ) {
              this.configurationPages.set(keyName, {
                pageId: page.id,
                valuePropertyType: valueProperty.type as ConfigurationPage['valuePropertyType'],
              });
            }
          }
        }
      }

      logger.debug(
        `Loaded configs: ${JSON.stringify(Object.fromEntries(this.notionConfigs), null, 2)}`
      );
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
        `Config に key: ${key} が存在しません。設定内容とスペルを確認し、必要に応じて Discord で /reload を実行してください。`
      );
    }
    return value;
  },

  getAllConfigs(): ReadonlyMap<string, string> {
    return this.notionConfigs;
  },

  /** Notion の既存設定ページを更新し、実行中の設定にも即時反映する。 */
  async setConfig(key: string, value: string): Promise<void> {
    const configurationPage = this.configurationPages.get(key);
    if (!configurationPage) {
      throw new Error(`Config に key: ${key} が存在しないか、更新できない形式です。`);
    }

    const properties = {
      value: this.createNotionValueProperty(configurationPage.valuePropertyType, value),
    };
    const client = new Client({ auth: this.notion.token });
    await client.pages.update({ page_id: configurationPage.pageId, properties });
    this.notionConfigs.set(key, value);
    logger.info(`Config ${key} を Discord コマンドから更新しました。`);
  },

  createNotionValueProperty(type: ConfigurationPage['valuePropertyType'], value: string) {
    const text = [{ type: 'text' as const, text: { content: value } }];

    switch (type) {
      case 'rich_text':
        return { rich_text: text };
      case 'title':
        return { title: text };
      case 'url':
        return { url: value };
      case 'number': {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error('数値として解釈できない値です。');
        return { number };
      }
      case 'select':
        return { select: { name: value } };
      case 'multi_select':
        return {
          multi_select: value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .map((name) => ({ name })),
        };
    }
  },
};
