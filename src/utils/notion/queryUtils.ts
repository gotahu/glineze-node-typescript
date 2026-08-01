import { APIResponseError, Client } from '@notionhq/client';
import {
  PageObjectResponse,
  QueryDataSourceParameters,
} from '@notionhq/client/build/src/api-endpoints';
import { healthRegistry } from '../../shared/health/HealthRegistry';

export async function queryAllDatabasePages(
  client: Client,
  databaseId: string,
  filter?: QueryDataSourceParameters['filter']
): Promise<PageObjectResponse[]> {
  const startedAt = Date.now();
  healthRegistry.started('integration:notion', new Date(startedAt));
  try {
    const database = await client.databases.retrieve({ database_id: databaseId });

    if (!('data_sources' in database) || database.data_sources.length === 0) {
      throw new Error(`データベース ${databaseId} にデータソースが見つかりません。`);
    }

    const dataSourceId = database.data_sources[0].id;

    let hasMore = true;
    let startCursor = undefined;
    const allResults: PageObjectResponse[] = [];

    while (hasMore) {
      const response = await client.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: startCursor,
        filter: filter,
        result_type: 'page',
      });

      const results = response.results as PageObjectResponse[];
      allResults.push(...results);

      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    healthRegistry.succeeded('integration:notion', Date.now() - startedAt);
    return allResults;
  } catch (error) {
    healthRegistry.failed('integration:notion', error, Date.now() - startedAt);
    if (error instanceof APIResponseError) {
      if (error.status === 404) {
        throw new Error(
          `Notion データベースが見つかりません: ${databaseId}\nデータベースが存在しないか、BOT にデータベースを読み書きする権限が与えられていない可能性があります。\nhttps://www.notion.so/chorglanze/1b21ea2409888007977ad23654285ece?pvs=4 をご覧ください。`,
          { cause: error }
        );
      }
    }
    throw error;
  }
}
