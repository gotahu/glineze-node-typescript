import { Client } from '@notionhq/client';
import { config } from '../config/config';
import { AppError } from '../utils/errorHandler';

import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { logger } from '../utils/logger';
import {
  LINEDiscordPairInfo,
  GlanzeMember,
  ShukinReply,
  ShukinInfo,
  Practice,
} from '../types/types';
import { replaceEnglishDayWithJapanese } from '../utils';

export class NotionService {
  public client: Client;
  private cache: LINEDiscordPairInfo[] | null = null;

  constructor() {
    this.client = new Client({
      auth: config.notion.token,
    });
  }

  // LINEDiscordPairs を キャッシュから取得する
  public async getLINEDiscordPairs(): Promise<LINEDiscordPairInfo[]> {
    if (this.cache) {
      logger.info('LINEDiscordPairs をキャッシュから取得しました');
      return this.cache;
    }

    logger.info('LINEDiscordPairs を Notion から取得します');
    this.cache = await this.retireveLINEDiscordPairs();
    return this.cache;
  }

  // Notion から LINEDiscordPairs を取得する
  private async retireveLINEDiscordPairs(): Promise<LINEDiscordPairInfo[]> {
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
   * Notion の config データベースから key に対応する値を取得する
   * @param key string
   * @returns string | undefined
   */
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
    type: 'title' | 'select' | 'multi_select' | 'rich_text' | 'status' | 'url' | 'formula'
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

        if (prop.type === 'formula' && prop.formula) {
          if ('string' in prop.formula) {
            return prop.formula.string;
          }
        }
      }
    }

    return '';
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
              const pageObject = await this.retrieveNotionPage(pageId);
              return pageObject;
            })
          );
          relations.push(...pages);
        }
      })
    );

    return relations;
  }

  /**
   * 指定されたNotionデータベースIDのすべてのページをクエリします。
   * ページネーションを考慮して、すべてのページが取得されるまでループします。
   *
   * @param {string} database_id - クエリするNotionデータベースのID。
   * @returns {Promise<PageObjectResponse[]>} データベースのすべてのページを含む配列を返すPromise。
   */
  public async queryAllDatabasePages(
    database_id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: any
  ): Promise<PageObjectResponse[]> {
    let hasMore = true;
    let startCursor = undefined;
    const allResults = [] as PageObjectResponse[];

    while (hasMore) {
      const response = await this.client.databases.query({
        database_id: database_id,
        start_cursor: startCursor,
        filter: filter,
      });

      const results = response.results as PageObjectResponse[];
      allResults.push(...results);

      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    return allResults;
  }

  // 特定のページIDを使用してNotionページの詳細を取得するヘルパー関数
  public async retrieveNotionPage(pageId: string): Promise<PageObjectResponse> {
    return (await this.client.pages.retrieve({
      page_id: pageId,
    })) as PageObjectResponse;
  }

  public async retrieveGlanzeMember(discordId: string): Promise<GlanzeMember | undefined> {
    const databaseId = await this.getConfigValue('discord_and_notion_pairs_databaseid');

    if (!databaseId) {
      logger.error('Discord と Notion を紐付けるデータベースの ID が取得できませんでした');
      return undefined;
    }

    const query = await this.client.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Discord',
        rich_text: {
          equals: discordId,
        },
      },
    });

    if (!query || query.results.length === 0) {
      logger.error(
        `DiscordId: ${discordId} に対して、Discord と Notion のペア情報を正しく取得できませんでした。`
      );
      return undefined;
    }

    const result = query.results[0] as PageObjectResponse;

    const pair: GlanzeMember = {
      notionPageId: result.id,
      discordUserId: discordId,
      name: this.getStringPropertyValue(result, '名前', 'title'),
      generation: this.getStringPropertyValue(result, '期', 'select'),
      part4: this.getStringPropertyValue(result, '4パート', 'select'),
      part8: this.getStringPropertyValue(result, '8パート', 'select'),
    };

    console.debug(pair);

    return pair;
  }

  public async retrieveShukinStatus(member: GlanzeMember): Promise<ShukinReply> {
    const shukinDatabaseId = await this.getConfigValue('shukin_databaseid');

    if (!shukinDatabaseId) {
      logger.error('集金DBのIDがconfigから見つかりませんでした');

      return {
        status: 'error',
        message:
          '集金DBのIDがconfigに適切に設定されていない可能性があります。マネジに連絡してください。',
      };
    }

    const query = await this.client.databases.query({
      database_id: shukinDatabaseId,
      filter: {
        // 集金DBの「団員」プロパティのリレーションを、団員名簿のNotionページIDでフィルター
        property: '団員',
        relation: {
          contains: member.notionPageId,
        },
      },
    });

    if (!query || query.results.length === 0) {
      logger.error('集金DBにデータがありません');
      return {
        status: 'error',
        message:
          'Notion上の集金DBにあなたのデータが見つかりませんでした。整備が完了していない可能性があります。マネジに連絡してください。',
      };
    }

    const queryResult = query.results[0] as PageObjectResponse;
    console.debug(queryResult);

    const shukinList = [] as ShukinInfo[];

    Object.entries(queryResult.properties).forEach(([key, prop]) => {
      // プロパティのタイプが number かつ、集金額が入っている場合
      // 0円または空白の場合は集金対象外となっている、と考え、標示しない
      if (prop.type === 'number' && prop.number) {
        console.debug('number', prop.number);
        const statusProperty = queryResult.properties[key + 'ステータス'];
        console.log(key + 'ステータス', statusProperty);
        if (statusProperty.type === 'status' && statusProperty.status) {
          shukinList.push({
            shukinName: key,
            shukinAmount: prop.number + '円',
            shukinStatus: statusProperty.status.name,
          });
        }
      }
    });

    let replyMessage = `${member.name} さんの集金状況をお知らせします。\n### 集金状況`;

    replyMessage += shukinList.map((v) => {
      return `\n- ${v.shukinName}：${v.shukinAmount}（${v.shukinStatus}）`;
    });

    if (shukinList.length === 0) {
      replyMessage += '\n- 集金対象がありません。';
    }

    replyMessage +=
      '\n### 注意事項\n- （受取済）（振込済）の場合、パトマネさんが受け取ったあと、会計さんが確認中です。';
    replyMessage +=
      '\n- （受取確認済）（振込確認済）の場合、会計さんの確認まで全て終了しています。';

    return {
      status: 'success',
      message: replyMessage,
    };
  }

  public async retirevePracticesForRelativeDay(daysFromToday: number): Promise<Practice[]> {
    // 対象日を取得
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysFromToday);

    // Notion に渡す日付のフォーマット
    const formattedDate = targetDate
      .toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .split('/')
      .join('-');

    logger.info(`retirevePracticeForRelativeDay: formattedDate: ${formattedDate}`);

    const databaseId = await this.getConfigValue('practice_databaseid');
    if (!databaseId) {
      throw new AppError('practice_databaseid is not found.', 500);
    }

    // Notion から練習情報を取得
    const response = await this.client.databases.query({
      database_id: databaseId,
      filter: {
        property: '日付',
        date: {
          equals: formattedDate,
        },
      },
    });

    // ページを取得（型推論をつける）
    const results = response.results.filter(
      (result): result is PageObjectResponse => result.object === 'page'
    ) as PageObjectResponse[];

    // 練習情報を整形する
    const practices = [] as Practice[];
    for (const practice of results) {
      const notionPage = await this.retrieveNotionPage(practice.id);

      // Practice 型に変換
      const practiceInfo: Practice = {
        title: this.getStringPropertyValue(notionPage, 'タイトル', 'title'),
        date: targetDate,
        time: this.getStringPropertyValue(notionPage, '時間', 'select'),
        timetable: this.getStringPropertyValue(notionPage, '練習内容', 'rich_text'),
        place: '',
        announceText: '',
      };

      // 練習場所はリレーションのidから名前を取得
      const placeRelations = await this.getRelationPropertyValue(notionPage, '練習場所');
      if (placeRelations.length > 0) {
        practiceInfo.place = this.getStringPropertyValue(placeRelations[0], '名前', 'title');
      }

      // 練習連絡はformulaから取得するが、曜日を日本語に変換する
      const announceText = this.getStringPropertyValue(notionPage, '練習連絡', 'formula');
      if (announceText) {
        practiceInfo.announceText = replaceEnglishDayWithJapanese(announceText);
      }

      practices.push(practiceInfo);
    }

    return practices;
  }
}
