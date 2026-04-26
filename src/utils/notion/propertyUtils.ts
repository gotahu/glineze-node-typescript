import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { logger } from '../logger';
import { NotFoundPropertyError } from './errors';
import { StatusPropertyType } from './types';

// ステータスIDとグループ名のキャッシュ
interface StatusCache {
  // データベースID + プロパティキー -> ステータスオプションマップ
  databaseStatusOptions: Map<string, Map<string, StatusPropertyType>>;
}

const statusCache: StatusCache = {
  databaseStatusOptions: new Map(),
};

export function getStringPropertyValue(page: PageObjectResponse, key: string): string | undefined {
  const property = page.properties[key];

  if (property) {
    if (property.type === 'title' && property.title.length > 0) {
      return property.title[0].plain_text;
    }
    if (property.type === 'rich_text' && property.rich_text.length > 0) {
      return property.rich_text[0].plain_text;
    }
    if (property.type === 'url') {
      return property.url ?? undefined;
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
      return property.formula.string ?? undefined;
    }
    if (property.type === 'status' && property.status) {
      return property.status.name;
    }
  } else {
    throw new NotFoundPropertyError(`プロパティ ${key} が見つかりません`);
  }

  logger.info(`プロパティ ${key} は見つかりましたが、その値が存在しないか空になっています`, { debug: true });
  return undefined;
}

export async function getStatusPropertyGroup(
  client: Client,
  page: PageObjectResponse,
  propertyKey: string
): Promise<StatusPropertyType> {
  if (page.parent.type === 'data_source_id') {
    let statusId: string | undefined;
    for (const [key, property] of Object.entries(page.properties)) {
      if (property.type === 'status' && property.status && key === propertyKey) {
        statusId = property.status.id;
      }
    }

    if (!statusId) {
      throw new Error(`ステータスプロパティ ${propertyKey} が見つかりません`);
    }

    const databaseId = page.parent.data_source_id;
    const cacheKey = `${databaseId}_${propertyKey}`;

    if (!statusCache.databaseStatusOptions.has(cacheKey)) {
      logger.info(`ステータスオプションをキャッシュに保存: ${cacheKey}`, { debug: true });
      const database = await client.dataSources.retrieve({ data_source_id: databaseId });
      const optionsMap = new Map<string, StatusPropertyType>();

      for (const [key, property] of Object.entries(database.properties)) {
        if (property.type === 'status' && property.status && key === propertyKey) {
          const groups = property.status.groups;
          for (const group of groups) {
            for (const optionId of group.option_ids) {
              optionsMap.set(optionId, group.name as StatusPropertyType);
            }
          }
        }
      }
      statusCache.databaseStatusOptions.set(cacheKey, optionsMap);
    }

    const optionsMap = statusCache.databaseStatusOptions.get(cacheKey);
    const groupName = optionsMap?.get(statusId);

    if (!groupName) {
      throw new Error(`ステータスプロパティ ${propertyKey} のグループが見つかりません`);
    }

    return groupName;
  }
  throw new Error('ページの親がデータベースではありません');
}

export function getPageTitle(page: PageObjectResponse): string {
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === 'title' && prop.title.length > 0) {
      return prop.title.map((title) => title.plain_text).join('');
    }
  }
  throw new Error('ページタイトルが見つかりません');
}

export function getBooleanPropertyValue(page: PageObjectResponse, key: string): boolean {
  const property = page.properties[key];
  if (property && property.type === 'checkbox') {
    return property.checkbox;
  }
  throw new Error(`Cannot get boolean property value for key: ${key}`);
}

export function getNumberPropertyValue(page: PageObjectResponse, key: string): number {
  const property = page.properties[key];
  if (property && property.type === 'number' && property.number) {
    return property.number;
  }
  throw new Error(`Cannot get number property value for key: ${key}`);
}

export function getDatePropertyValue(page: PageObjectResponse, key: string): Date {
  const property = page.properties[key];
  if (property && property.type === 'date' && property.date) {
    return new Date(property.date.start);
  }
  throw new Error(`Cannot get date property value for key: ${key}`);
}

export async function getRelationPropertyValue(
  client: Client,
  page: PageObjectResponse,
  key: string
): Promise<PageObjectResponse[]> {
  const property = page.properties[key];
  if (property && property.type === 'relation' && property.relation) {
    const relations: PageObjectResponse[] = [];
    try {
      for (const relation of property.relation) {
        const response = (await client.pages.retrieve({ page_id: relation.id })) as PageObjectResponse;
        relations.push(response);
      }
    } catch (error) {
      throw new Error(`Cannot get relation property value for key: ${key}`, { cause: error });
    }
    return relations;
  }
  throw new Error(`Cannot get relation property value for key: ${key}`);
}

export function clearStatusPropertyCache(databaseId?: string, propertyKey?: string): void {
  if (!databaseId) {
    statusCache.databaseStatusOptions.clear();
    logger.info('全てのステータスプロパティキャッシュをクリアしました', { debug: true });
    return;
  }
  if (!propertyKey) {
    for (const key of statusCache.databaseStatusOptions.keys()) {
      if (key.startsWith(`${databaseId}_`)) {
        statusCache.databaseStatusOptions.delete(key);
      }
    }
    logger.info(`データベース ${databaseId} のステータスプロパティキャッシュをクリアしました`, { debug: true });
    return;
  }
  const cacheKey = `${databaseId}_${propertyKey}`;
  statusCache.databaseStatusOptions.delete(cacheKey);
  logger.info(`キャッシュをクリア: ${cacheKey}`, { debug: true });
}
