import { APIResponseError, Client } from '@notionhq/client';
import {
  PageObjectResponse,
  QueryDataSourceParameters,
} from '@notionhq/client/build/src/api-endpoints';

export async function queryAllDatabasePages(
  client: Client,
  databaseId: string,
  filter?: QueryDataSourceParameters['filter']
): Promise<PageObjectResponse[]> {
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

    return allResults;
  } catch (error) {
    if (error instanceof APIResponseError) {
      if (error.status === 404) {
        throw new Error(
          `Notionデータベースが見つかりません: ${databaseId}\nデータベースが存在しないか、Botに読み書きの権限がない可能性があります。データベースIDとIntegrationの共有設定を確認してください。`,
          { cause: error }
        );
      }
    }
    throw error;
  }
}
