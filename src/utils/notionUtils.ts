import { Client } from '@notionhq/client';
import {
  PageObjectResponse,
  QueryDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints';
import { logger } from './logger';

export class NotFoundPropertyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundPropertyError';
  }
}

export enum StatusPropertyType {
  TODO = 'To-do',
  IN_PROGRESS = 'In Progress',
  COMPLETE = 'Complete',
}

function getStringPropertyValue(page: PageObjectResponse, key: string): string | undefined {
  const property = page.properties[key];

  if (property) {
    if (property.type === 'title' && property.title.length > 0) {
      return property.title[0].plain_text;
    }

    if (property.type === 'rich_text' && property.rich_text.length > 0) {
      return property.rich_text[0].plain_text;
    }

    if (property.type === 'url') {
      return property.url;
    }

    if (property.type === 'number' && property.number) {
      return property.number.toString();
    }

    if (property.type === 'select' && property.select) {
      return property.select.name;
    }

    if (property.type === 'multi_select' && property.multi_select) {
      return property.multi_select.map((option) => option.name).join(', ');
    }

    if (property.type === 'formula' && property.formula && property.formula.type === 'string') {
      return property.formula.string;
    }

    if (property.type === 'status' && property.status) {
      return property.status.name;
    }
  } else {
    throw new NotFoundPropertyError(`プロパティ ${key} が見つかりません`);
  }

  logger.info(`プロパティ ${key} は見つかりましたが、その値が存在しないか空になっています`, {
    debug: true,
  });
  return undefined;
}

/**
 * ステータスプロパティのグループを取得する関数
 * @param client Notion Client
 * @param page ページ情報
 * @param propertyKey プロパティキー
 * @returns ステータスプロパティのグループ
 */
async function getStatusPropertyGroup(
  client: Client,
  page: PageObjectResponse,
  propertyKey: string
): Promise<StatusPropertyType> {
  if (page.parent.type === 'database_id') {
    // page から key に該当するステータスプロパティを取得する
    let statusId: string;
    for (const [key, property] of Object.entries(page.properties)) {
      if (property.type === 'status' && property.status && key === propertyKey) {
        statusId = property.status.id;
      }
    }

    if (!statusId) {
      throw new Error(`ステータスプロパティ ${propertyKey} が見つかりません`);
    }

    // ページから親データベースを取得する
    const databaseId = page.parent.database_id;
    const database = await client.databases.retrieve({ database_id: databaseId });

    let groupName: StatusPropertyType;

    // データベースのステータスプロパティを取得する
    for (const [key, property] of Object.entries(database.properties)) {
      if (property.type === 'status' && property.status && key === propertyKey) {
        const groups = property.status.groups;
        for (const group of groups) {
          if (group.option_ids.includes(statusId)) {
            groupName = group.name as StatusPropertyType;
          }
        }
      }
    }

    if (!groupName) {
      throw new Error(`ステータスプロパティ ${propertyKey} のグループが見つかりません`);
    }

    return groupName;
  }

  throw new Error('ページの親がデータベースではありません');
}

/**
 * ページのタイトルを取得する関数
 * @param {PageObjectResponse} page ページ情報
 * @returns {string} ページのタイトル
 */
function getPageTitle(page: PageObjectResponse): string {
  const properties = page.properties;

  for (const [key, prop] of Object.entries(properties)) {
    if (prop.type === 'title' && prop.title.length > 0) {
      return prop.title.map((title) => title.plain_text).join('');
    }
  }

  throw new Error('ページタイトルが見つかりません');
}

function getBooleanPropertyValue(page: PageObjectResponse, key: string): boolean {
  const property = page.properties[key];

  if (property) {
    if (property.type === 'checkbox') {
      return property.checkbox;
    }
  }

  throw new Error(`Cannot get boolean property value for key: ${key}`);
}

function getNumberPropertyValue(page: PageObjectResponse, key: string): number {
  const property = page.properties[key];

  if (property) {
    if (property.type === 'number' && property.number) {
      return property.number;
    }
  }

  throw new Error(`Cannot get number property value for key: ${key}`);
}

function getDatePropertyValue(page: PageObjectResponse, key: string): Date {
  const property = page.properties[key];

  if (property) {
    if (property.type === 'date' && property.date) {
      return new Date(property.date.start);
    }
  }

  throw new Error(`Cannot get date property value for key: ${key}`);
}

async function getRelationPropertyValue(
  client: Client,
  page: PageObjectResponse,
  key: string
): Promise<PageObjectResponse[]> {
  const property = page.properties[key];

  if (property && property.type === 'relation' && property.relation) {
    const relations: PageObjectResponse[] = [];
    try {
      for (const relation of property.relation) {
        const response = (await client.pages.retrieve({
          page_id: relation.id,
        })) as PageObjectResponse;
        relations.push(response);
      }
    } catch (error) {
      throw new Error(`Cannot get relation property value for key: ${key}`);
    }

    return relations;
  } else {
    throw new Error(`Cannot get relation property value for key: ${key}`);
  }
}

async function queryAllDatabasePages(
  client: Client,
  databaseId: string,
  filter?: QueryDatabaseParameters['filter']
): Promise<PageObjectResponse[]> {
  let hasMore = true;
  let startCursor = undefined;
  const allResults = [] as PageObjectResponse[];

  while (hasMore) {
    const response = await client.databases.query({
      database_id: databaseId,
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

/**
 * 2つのUUIDが同一かどうかを判定する関数
 * @param uuid1 判定対象のUUID (ハイフンあり/なし)
 * @param uuid2 判定対象のUUID (ハイフンあり/なし)
 * @returns 同一なら true、異なるなら false
 */
function areUUIDsEqual(uuid1: string, uuid2: string): boolean {
  // 両方のUUIDからハイフンを除去して比較
  const normalizedUUID1 = uuid1.replace(/-/g, '').toLowerCase();
  const normalizedUUID2 = uuid2.replace(/-/g, '').toLowerCase();
  return normalizedUUID1 === normalizedUUID2;
}

export {
  areUUIDsEqual,
  getBooleanPropertyValue,
  getDatePropertyValue,
  getNumberPropertyValue,
  getPageTitle,
  getRelationPropertyValue,
  getStringPropertyValue,
  queryAllDatabasePages,
};
