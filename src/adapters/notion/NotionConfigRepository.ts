import { Client } from '@notionhq/client';
import { getStringPropertyValue, queryAllDatabasePages } from '../../utils/notionUtils';
import { ConfigRepository } from '../../shared/config/ConfigRepository';
import { RawConfigUpdate } from '../../shared/config/configTypes';
import {
  ConfigurationPersistenceError,
  MissingConfigurationError,
} from '../../shared/config/errors';

type ConfigurationPage = {
  pageId: string;
  valuePropertyType: 'rich_text' | 'title' | 'url' | 'number' | 'select' | 'multi_select';
};

export class NotionConfigRepository implements ConfigRepository {
  private readonly configurationPages = new Map<string, ConfigurationPage>();

  constructor(
    private readonly client: Client,
    private readonly databaseId: string
  ) {}

  public async loadAll(): Promise<ReadonlyMap<string, string>> {
    const pages = await queryAllDatabasePages(this.client, this.databaseId);
    const values = new Map<string, string>();
    this.configurationPages.clear();

    for (const page of pages) {
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
        this.configurationPages.set(key, {
          pageId: page.id,
          valuePropertyType: valueProperty.type as ConfigurationPage['valuePropertyType'],
        });
      }
    }

    return values;
  }

  public async updateMany(
    updates: readonly RawConfigUpdate[],
    previousValues: ReadonlyMap<string, string>
  ): Promise<void> {
    const pages = updates.map(({ key }) => {
      const page = this.configurationPages.get(key);
      if (!page) {
        throw new MissingConfigurationError(
          `Config に key: ${key} が存在しないか、更新できない形式です。`
        );
      }
      return page;
    });
    const completed: number[] = [];

    try {
      for (const [index, update] of updates.entries()) {
        await this.updatePage(pages[index], update.value);
        completed.push(index);
      }
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      for (const index of completed.reverse()) {
        const previousValue = previousValues.get(updates[index].key);
        if (previousValue === undefined) continue;
        try {
          await this.updatePage(pages[index], previousValue);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }

      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          'Config update failed and Notion rollback was incomplete',
          { cause: error }
        );
      }
      throw new ConfigurationPersistenceError('Failed to update configuration in Notion', {
        cause: error,
      });
    }
  }

  private async updatePage(page: ConfigurationPage, value: string): Promise<void> {
    await this.client.pages.update({
      page_id: page.pageId,
      properties: {
        value: createNotionValueProperty(page.valuePropertyType, value),
      },
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
