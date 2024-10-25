import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { logger } from './logger';

function getStringPropertyValue(page: PageObjectResponse, key: string): string {
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
  } else {
    throw new Error(`Cannot find property with key: ${key}`);
  }

  logger.error(`Found property with key: ${key} but cannot get value or undefined`);
  return undefined;
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
  filter?: any
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

export {
  getStringPropertyValue,
  getBooleanPropertyValue,
  getNumberPropertyValue,
  getDatePropertyValue,
  getRelationPropertyValue,
  queryAllDatabasePages,
};
