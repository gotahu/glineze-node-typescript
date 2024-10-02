import { Client } from '@notionhq/client';
import { config } from '../../config/config';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { logger } from '../../utils/logger';
import {
  LINEDiscordPairInfo,
  GlanzeMember,
  ShukinReply,
  ShukinInfo,
  Practice,
} from '../../types/types';
import { replaceEnglishDayWithJapanese } from '../../utils/dateUtils';

export class NotionService {
  public client: Client;
  private cache: LINEDiscordPairInfo[] | null = null;
  private config: Map<string, string> = new Map();

  private static readonly ERROR_MESSAGES = {
    DB_ID_NOT_FOUND:
      '集金DBのIDがconfigに適切に設定されていない可能性があります。マネジに連絡してください。',
    NO_DATA_FOUND:
      'Notion上の集金DBにあなたのデータが見つかりませんでした。整備が完了していない可能性があります。マネジに連絡してください。',
  };

  private static readonly STATUS_NOTES = [
    '（受取済）（振込済）の場合、パトマネさんが受け取ったあと、会計さんが確認中です。',
    '（受取確認済）（振込確認済）の場合、会計さんの確認まで全て終了しています。',
  ];
  constructor() {
    this.client = new Client({
      auth: config.notion.token,
    });

    this.initializeConfig();
  }

  private async initializeConfig(): Promise<void> {
    try {
      const configDatabase = await this.queryAllDatabasePages(
        config.notion.configurationDatabaseId
      );

      for (const page of configDatabase) {
        const key = this.getStringPropertyValue(page, 'key', 'title');
        const value = this.getStringPropertyValue(page, 'value', 'rich_text');

        this.config.set(key, value);
      }

      console.log('config を初期化しました');
      console.log(this.config);
    } catch (error) {
      logger.error(`Failed to initialize configuration on NotionService: ${error}`);
      throw new Error('Failed to initialize NotionService due to missing configuration');
    }
  }

  public reloadConfig(): Promise<void> {
    this.config.clear();
    logger.info('config を初期化しました');
    return this.initializeConfig();
  }

  public getConfig(key: string): string {
    const value = this.config.get(key);

    if (!value) {
      throw new Error(`Configuration key not found: ${key}`);
    }

    return value;
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
    try {
      const pairsDatabaseId = this.getConfig('discord_and_line_pairs_databaseid');

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
          name: this.getStringPropertyValue(page, 'name', 'title'),
          lineGroupId: this.getStringPropertyValue(page, 'line_group_id', 'rich_text'),
          discordChannelId: this.getStringPropertyValue(page, 'discord_channel_id', 'rich_text'),
          lineNotifyKey: this.getStringPropertyValue(page, 'line_notify_key', 'rich_text'),
          priority: this.getBooleanPropertyValue(page, 'priority', 'checkbox'),
          includeThreads: this.getBooleanPropertyValue(page, 'include_threads', 'checkbox'),
        };

        return pair;
      });

      return pairs;
    } catch (error) {
      logger.error(`Failed to retrieve LINEDiscordPairs: ${error}`);
      return [];
    }
  }

  public async addLineDiscordPair(pair: LINEDiscordPairInfo): Promise<void> {
    try {
      const databaseId = this.getConfig('discord_and_line_pairs_databaseid');

      await this.client.pages.create({
        parent: { database_id: databaseId },
        properties: {
          discord_channel_id: { rich_text: [{ text: { content: pair.discordChannelId } }] },
          line_group_id: { rich_text: [{ text: { content: pair.lineGroupId } }] },
          line_notify_key: { rich_text: [{ text: { content: pair.lineNotifyKey } }] },
          name: { title: [{ text: { content: pair.name } }] },
          include_threads: { checkbox: pair.includeThreads },
        },
      });

      // キャッシュを更新
      this.cache = await this.retireveLINEDiscordPairs();

      // ログ
      logger.info(`LineDiscordPair を追加しました: ${pair.name}`);
    } catch (error) {
      logger.error(`Failed to add LineDiscordPair: ${error}`);
      throw new Error('Failed to add LineDiscordPair');
    }
  }

  public async getLineDiscordPairByChannelId(
    channelId: string
  ): Promise<LINEDiscordPairInfo | null> {
    const pairs = await this.getLINEDiscordPairs();
    return pairs.find((pair) => pair.discordChannelId === channelId) ?? null;
  }

  public async removeLineDiscordPair(channelId: string): Promise<void> {
    try {
      const pair = await this.getLineDiscordPairByChannelId(channelId);
      if (!pair) {
        throw new Error('Pair not found');
      }

      const databaseId = this.getConfig('discord_and_line_pairs_databaseid');

      const query = await this.client.databases.query({
        database_id: databaseId,
        filter: {
          property: 'discord_channel_id',
          rich_text: {
            equals: channelId,
          },
        },
      });

      if (!query || query.results.length === 0) {
        throw new Error('Pair not found');
      }

      const pageId = query.results[0].id;

      await this.client.pages.update({
        page_id: pageId,
        archived: true,
      });

      // キャッシュから削除
      this.cache = this.cache?.filter((pair) => pair.discordChannelId !== channelId);

      // ログ
      logger.info(`LineDiscordPair を削除しました: ${pair.name}`);
    } catch (error) {
      logger.error(`Failed to remove LineDiscordPair: ${error}`);
      throw new Error('Failed to remove LineDiscordPair');
    }
  }

  /**
   * Notion の config データベースから key に対応する値を取得する
   * @param key string
   * @returns string | undefined
   */
  private async getConfigValue(key: string): Promise<string | undefined> {
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
      throw new Error(`Failed to fetch the configuration value for key: ${key}`);
    }
  }

  /**
   * Notion のページ内プロパティーから真偽値を取得する
   * @param {PageObjectResponse} page Notion ページ
   * @param {string} key データベースのプロパティ名
   * @param {string} type データベースのプロパティのタイプ
   * @returns {boolean}
   */
  public getBooleanPropertyValue(page: PageObjectResponse, key: string, type: 'checkbox'): boolean {
    for (const [propKey, prop] of Object.entries(page.properties)) {
      if (propKey === key && prop.type === type) {
        if (prop.type === 'checkbox' && prop.checkbox) {
          return prop.checkbox;
        }
      }
    }
  }

  /**
   * Notion のページ内のプロパティーから文字列を取得する
   * @param {PageObjectResponse} page Notion ページ
   * @param {string} key データベースのプロパティ名
   * @param type データベースのプロパティのタイプ
   * @returns {string | undefined}
   */
  public getStringPropertyValue(
    page: PageObjectResponse,
    key: string,
    type: 'title' | 'select' | 'multi_select' | 'rich_text' | 'status' | 'url' | 'formula'
  ): string | undefined {
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

    logger.error(`Notionページ ${page.id} に ${key} プロパティは存在しません`);
    return '';
  }

  /**
   * Notion のページ内のプロパティーから日付を取得する
   * @param page
   * @param key
   * @param type
   * @returns
   */
  public getDatePropertyValue(page: PageObjectResponse, key: string): Date | undefined {
    for (const [propKey, prop] of Object.entries(page.properties)) {
      if (propKey === key && prop.type === 'date') {
        if (prop.type === 'date' && prop.date) {
          return new Date(prop.date.start);
        }
      }
    }

    return undefined;
  }

  /**
   * Notion のページ内のプロパティーから数値を取得する
   * @param page
   * @param key
   * @param type
   * @returns {number | undefined}
   */
  public getNumberPropertyValue(
    page: PageObjectResponse,
    key: string,
    type: 'number'
  ): number | undefined {
    for (const [propKey, prop] of Object.entries(page.properties)) {
      if (propKey === key && prop.type === type) {
        if (prop.type === 'number' && prop.number) {
          return prop.number;
        }
      }
    }

    return undefined;
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
    try {
      const databaseId = this.getConfig('discord_and_notion_pairs_databaseid');

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
    } catch (error) {
      logger.error(`Failed to retrieve GlanzeMember: ${error}`);
      return undefined;
    }
  }

  public async retrieveShukinStatus(member: GlanzeMember): Promise<ShukinReply> {
    try {
      const shukinDatabaseId = this.getConfig('shukin_databaseid');
      const queryResult = await this.queryShukinDatabase(shukinDatabaseId, member.notionPageId);

      const shukinList = this.extractShukinInfo(queryResult);
      const replyMessage = this.formatReplyMessage(member.name, shukinList);

      return {
        status: 'success',
        message: replyMessage,
      };
    } catch (error) {
      logger.error(`Error in retrieveShukinStatus: ${error}`);
      return this.createErrorReply('予期せぬエラーが発生しました。マネジに連絡してください。');
    }
  }

  private async queryShukinDatabase(
    databaseId: string,
    memberPageId: string
  ): Promise<PageObjectResponse | null> {
    const query = await this.client.databases.query({
      database_id: databaseId,
      filter: {
        property: '団員',
        relation: { contains: memberPageId },
      },
    });

    if (!query || query.results.length === 0) {
      throw new Error(NotionService.ERROR_MESSAGES.NO_DATA_FOUND);
    }

    return query.results[0] as PageObjectResponse;
  }

  private extractShukinInfo(queryResult: PageObjectResponse): ShukinInfo[] {
    const shukinList: ShukinInfo[] = [];

    Object.entries(queryResult.properties).forEach(([key, prop]) => {
      if (prop.type === 'number' && prop.number) {
        const statusProperty = queryResult.properties[`${key}ステータス`];
        if (statusProperty.type === 'status' && statusProperty.status) {
          shukinList.push({
            shukinName: key,
            shukinAmount: `${prop.number}円`,
            shukinStatus: statusProperty.status.name,
          });
        }
      }
    });

    return shukinList;
  }

  private formatReplyMessage(memberName: string, shukinList: ShukinInfo[]): string {
    let replyMessage = `${memberName} さんの集金状況をお知らせします。\n### 集金状況`;

    if (shukinList.length === 0) {
      replyMessage += '\n- 集金対象がありません。';
    } else {
      replyMessage += shukinList
        .map((v) => `\n- ${v.shukinName}：${v.shukinAmount}（${v.shukinStatus}）`)
        .join('');
    }

    replyMessage += '\n### 注意事項';
    replyMessage += NotionService.STATUS_NOTES.map((note) => `\n- ${note}`).join('');

    return replyMessage;
  }

  private createErrorReply(message: string): ShukinReply {
    return { status: 'error', message };
  }

  public async retrievePracticesForRelativeDay(daysFromToday: number): Promise<Practice[]> {
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

    try {
      const databaseId = this.getConfig('practice_databaseid');

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
        const practicePage = await this.retrieveNotionPage(practice.id);

        console.log(practicePage);

        // Practice 型に変換
        const practiceInfo: Practice = {
          url: practicePage.url,
          id: practicePage.id,
          title: this.getStringPropertyValue(practicePage, 'タイトル', 'title'),
          date: targetDate,
          time: this.getStringPropertyValue(practicePage, '時間', 'select'),
          timetable: this.getStringPropertyValue(practicePage, '練習内容', 'rich_text'),
          place: '',
          announceText: '',
        };

        // 練習場所はリレーションのidから名前を取得
        const placeRelations = await this.getRelationPropertyValue(practicePage, '練習場所');
        console.log(placeRelations);
        if (placeRelations.length > 0) {
          practiceInfo.place = this.getStringPropertyValue(placeRelations[0], 'タイトル', 'title');
        }

        // 練習連絡はformulaから取得するが、曜日を日本語に変換する
        const announceText = this.getStringPropertyValue(practicePage, '練習連絡', 'formula');
        if (announceText) {
          practiceInfo.announceText = replaceEnglishDayWithJapanese(announceText);
        }

        practices.push(practiceInfo);
      }

      return practices;
    } catch (error) {
      logger.error(`Failed to retrieve practices for relative day: ${error}`);
      throw new Error('Failed to retrieve practices for relative day');
    }
  }
}
