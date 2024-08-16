import { Client } from '@notionhq/client';
import { config } from '../config/config';
import { AppError } from '../utils/errorHandler';

import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { retrieveNotionPage } from '../notion/notion-client';
import { logger } from '../utils/logger';
import { LINEDiscordPairInfo } from '../types/types';

export class NotionService {
  public client: Client;

  constructor() {
    this.client = new Client({
      auth: config.notion.token,
    });
  }

  // Notion から LINEDiscordPairs を取得する
  public async retireveLINEDiscordPairs(): Promise<LINEDiscordPairInfo[]> {
    const pairsDatabaseId = await this.getConfigValue('discord_and_line_pairs_databaseid');

    if (!pairsDatabaseId) {
      return [];
    }

    const query = await this.client.databases.query({
      database_id: pairsDatabaseId,
    });

    if (!query) {
      logger.error('Discord と LINE のペア情報を Notion データベースから取得できませんでした');
      return [];
    }

    logger.info(`Discord と LINE のペア情報を${query.results.length}件取得しました`);

    if (!query.results) {
      return [];
    }

    const results = query.results.filter(
      (result): result is PageObjectResponse => result.object === 'page'
    ) as PageObjectResponse[];

    // Notion ページから LINEDiscordPairInfo を作成
    const pairs = results.map((page) => {
      const pair: LINEDiscordPairInfo = {
        name: this.getStringPropertyValue(page, '名前', 'title'),
        line_group_id: this.getStringPropertyValue(page, 'line_group_id', 'rich_text'),
        discord_channel_id: this.getStringPropertyValue(page, 'discord_channel_id', 'rich_text'),
        line_notify_key: this.getStringPropertyValue(page, 'line_notify_key', 'rich_text'),
      };

      return pair;
    });

    return pairs;
  }

  /**
   * Notion のページ内のプロパティーから値を取得する
   * @param page Notion ページ
   * @param key データベースのプロパティ名
   * @param type データベースのプロパティのタイプ
   * @returns string | undefined
   */
  public getStringPropertyValue(
    page: PageObjectResponse,
    key: string,
    type: 'title' | 'select' | 'multi_select' | 'rich_text' | 'status' | 'url'
  ): string | undefined {
    logger.info('getStringPropertyValue: key: ' + key + ', type: ' + type);

    for (const [propKey, prop] of Object.entries(page.properties)) {
      if (propKey === key && prop.type === type) {
        if (prop.type === 'title' && prop.title) {
          return prop.title[0].plain_text;
        }

        if (prop.type === 'select' && prop.select) {
          return prop.select.name;
        }

        if (prop.type === 'multi_select' && prop.multi_select) {
          return prop.multi_select.map((item) => item.name).join(',');
        }

        if (prop.type === 'rich_text' && prop.rich_text) {
          if (prop.rich_text.length > 0) {
            return prop.rich_text[0].plain_text;
          }
        }

        if (prop.type === 'status' && prop.status) {
          return prop.status.name;
        }

        if (prop.type === 'url' && prop.url) {
          return prop.url;
        }
      }
    }

    return '';
  }

  public async getConfigValue(key: string): Promise<string | undefined> {
    try {
      const response = await this.client.databases.query({
        database_id: config.notion.configurationDatabaseId,
        filter: {
          property: 'key',
          title: {
            equals: key,
          },
        },
      });

      if (response.results.length === 0) {
        logger.error(`Notion の config データベースに key: ${key} が存在しません`);
        return undefined;
      }

      const page = response.results[0] as PageObjectResponse;

      return this.getStringPropertyValue(page, 'value', 'rich_text');
    } catch (error) {
      throw new AppError(`Failed to fetch the configuration value for key: ${key}`, 500);
    }
  }

  public async getRelationPropertyValue(
    page: PageObjectResponse,
    key: string
  ): Promise<PageObjectResponse[]> {
    const relations: PageObjectResponse[] = [];

    await Promise.all(
      Object.entries(page.properties).map(async ([propKey, prop]) => {
        if (propKey === key && prop.type === 'relation') {
          const pages = await Promise.all(
            prop.relation.map(async (relation) => {
              const pageId = relation.id;
              const pageObject = await retrieveNotionPage(pageId);
              return pageObject;
            })
          );
          relations.push(...pages);
        }
      })
    );

    return relations;
  }
}
