import { Client } from '@notionhq/client';
import { config } from '../config/config';
import { AppError } from '../utils/errorHandler';

import { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';

export const notionClient = new Client({
  auth: config.notion.token,
});

export async function getConfigurationValue(key: string): Promise<string | undefined> {
  try {
    const response = await notionClient.databases.query({
      database_id: config.notion.configurationDatabaseId,
      filter: {
        property: 'key',
        title: {
          equals: key,
        },
      },
    });

    if (!response.results.length) {
      return undefined;
    }

    const page = response.results[0];

    if ('properties' in page) {
      const valueProperty = page.properties['value'];

      if ('rich_text' in valueProperty && valueProperty['rich_text'].length > 0) {
        return (valueProperty['rich_text'] as RichTextItemResponse[])[0].plain_text;
      }
    }

    return undefined;
  } catch (error) {
    throw new AppError(`Failed to fetch the configuration value for key: ${key}`, 500);
  }
}

// その他の Notion 関連の関数をここに移動
