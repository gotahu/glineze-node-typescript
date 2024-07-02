import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notionClient, getConfigurationValue } from '../services/notionService';

export { notionClient, getConfigurationValue };

// 特定のページIDを使用してNotionページの詳細を取得するヘルパー関数
export async function retrieveNotionPage(pageId: string): Promise<PageObjectResponse> {
  return (await notionClient.pages.retrieve({
    page_id: pageId,
  })) as PageObjectResponse;
}

/**
 * 指定されたNotionデータベースIDのすべてのページをクエリします。
 * ページネーションを考慮して、すべてのページが取得されるまでループします。
 *
 * @param {string} database_id - クエリするNotionデータベースのID。
 * @returns {Promise<PageObjectResponse[]>} データベースのすべてのページを含む配列を返すPromise。
 */
export async function queryAllDatabasePages(
  database_id: string,
  filter?: any
): Promise<PageObjectResponse[]> {
  let hasMore = true;
  let startCursor = undefined;
  const allResults = [] as PageObjectResponse[];

  while (hasMore) {
    const response = await notionClient.databases.query({
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
