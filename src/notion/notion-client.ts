import dotenv from 'dotenv';
dotenv.config();
import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export const notionClient = new Client({
  auth: process.env.NOTION_TOKEN,
});

/**
 * Notionのデータベースから特定のキーに関連する設定値を非同期で取得します。
 *
 * @param {string} key - 取得する設定値のキー名。
 * @returns {Promise<string|undefined>} 指定されたキーに関連する設定値を文字列で返すPromise。
 *         設定値が存在しないか、エラーが発生した場合はundefinedを返します。
 */
export const getConfigurationValue = async (key: string): Promise<string | undefined> => {
  // 環境変数からNotionデータベースのIDを取得します。
  const database_id = process.env.NOTION_CONFIGURATION_DATABASEID as string;
  // データベースIDが設定されていない場合、エラーを投げます。
  if (!database_id) {
    throw new Error('NOTION_CONFIGURATION_DATABASEID is not set.');
  }

  try {
    // Notion APIを使用してデータベースをクエリし、特定のキーに対応する設定値を検索します。
    const response = await notionClient.databases.query({
      database_id,
      filter: {
        property: 'key',
        title: {
          equals: key,
        },
      },
    });

    // クエリの結果が空の場合、undefinedを返します。
    if (!response.results.length) {
      return undefined;
    }

    // クエリの最初の結果を取得し、PageObjectResponse型として解釈します。
    const pageResponse = response.results[0] as PageObjectResponse;
    // ページのプロパティから'value'プロパティを取得します。
    const valueProperty = pageResponse.properties['value'];

    // 'value'プロパティがリッチテキストを含み、その長さが0より大きい場合、値を取得します。
    if ('rich_text' in valueProperty && valueProperty['rich_text'].length > 0) {
      const value = valueProperty['rich_text'][0].plain_text;
      // コンソールにキーと値を出力します。
      console.log(`key: ${key}, value: ${value}`);
      // 取得した値を返します。
      return value;
    }

    // 上記の条件に一致しない場合、undefinedを返します。
    return undefined;
  } catch (error) {
    // エラーが発生した場合、コンソールにエラーメッセージを出力し、undefinedを返します。
    console.error(`Failed to fetch the configuration value for key: ${key}`, error);
    return undefined;
  }
};

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

  // hasMoreがfalseになるまで、またはすべてのページを取得するまでループします。
  while (hasMore) {
    // Notion APIを使用してデータベースをクエリします。
    const response = await notionClient.databases.query({
      database_id: database_id,
      start_cursor: startCursor,
      filter: filter,
    });

    // レスポンスからページオブジェクトを取得し、配列に追加します。
    const results = response.results as PageObjectResponse[];
    allResults.push(...results);

    // ページネーションに関する情報を更新します。
    hasMore = response.has_more;
    startCursor = response.next_cursor ?? undefined;
  }

  // すべてのページを含む配列を返します。
  return allResults;
}
