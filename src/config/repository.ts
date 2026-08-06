import { Client } from '@notionhq/client';
import { getStringPropertyValue, queryAllDatabasePages } from '../utils/notionUtils';

export type ConfigurationPage = {
  pageId: string;
  valuePropertyType: 'rich_text' | 'title' | 'url' | 'number' | 'select' | 'multi_select';
};

export type ConfigSnapshot = {
  values: Map<string, string>;
  pages: Map<string, ConfigurationPage>;
};

export class ConfigRepository {
  public readonly pages = new Map<string, ConfigurationPage>();

  constructor(
    private readonly token: string,
    private readonly databaseId: string,
    private readonly createClient: (token: string) => Client = (auth) => new Client({ auth })
  ) {}

  public async load(): Promise<ConfigSnapshot> {
    const client = this.createClient(this.token);
    const notionPages = await queryAllDatabasePages(client, this.databaseId);
    const values = new Map<string, string>();
    const pages = new Map<string, ConfigurationPage>();

    for (const page of notionPages) {
      if (!('properties' in page)) continue;
      const key = getStringPropertyValue(page, 'key');
      const value = getStringPropertyValue(page, 'value');
      if (!key || !value) continue;

      values.set(key, value);
      const valueProperty = page.properties.value;
      if (
        valueProperty &&
        ['rich_text', 'title', 'url', 'number', 'select', 'multi_select'].includes(
          valueProperty.type
        )
      ) {
        pages.set(key, {
          pageId: page.id,
          valuePropertyType: valueProperty.type as ConfigurationPage['valuePropertyType'],
        });
      }
    }

    this.pages.clear();
    for (const [key, page] of pages) this.pages.set(key, page);
    return { values, pages };
  }

  public async update(key: string, value: string): Promise<void> {
    const page = this.pages.get(key);
    if (!page) throw new Error(`Config に key: ${key} が存在しないか、更新できない形式です。`);

    const client = this.createClient(this.token);
    await client.pages.update({
      page_id: page.pageId,
      properties: { value: createNotionValueProperty(page.valuePropertyType, value) },
    });
  }
}

export function createNotionValueProperty(
  type: ConfigurationPage['valuePropertyType'],
  value: string
) {
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
}
