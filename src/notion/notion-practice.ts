import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { replaceEnglishDayWithJapanese } from '../utils';
import { getConfigurationValue, notionClient, retrieveNotionPage } from './notion-client';

/**
 * 明日の日付に関する練習情報をNotionデータベースから取得します。
 * 指定されたデータベースIDを使用してNotionデータベースをクエリし、
 * 明日の日付に関連する練習情報を取得します。
 *
 * @returns 明日の練習情報が含まれるオブジェクトを返すPromise。
 * @throws {Error} データベースIDが見つからない場合にエラーを投げます。
 */
const retrieveLatestPractice = async () => {
  // 今日の日付を取得し、明日の日付に設定します。
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 明日の日付をYYYY-MM-DD形式にフォーマットします。
  const formattedDate = tomorrow
    .toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/')
    .join('-');

  // NotionデータベースのIDを取得します。
  const database_id = await getConfigurationValue('practice_databaseid');
  if (!database_id) {
    throw new Error('practice_databaseid is not found.');
  }

  // Notion APIを使用してデータベースをクエリし、明日の練習情報を取得します。
  const response = await notionClient.databases.query({
    database_id,
    filter: {
      property: '日付',
      date: {
        equals: formattedDate,
      },
    },
  });

  return response;
};

/**
 * 最新の練習情報を取得し、その内容をテキストの配列として返します。
 * Notion APIを使用して練習情報を取得し、各練習に関する連絡事項を配列に格納します。
 *
 * @returns {Promise<string[]>} 練習連絡事項のテキストを含む配列を返すPromise。
 */
export const retrieveLatestPracticeStrings = async (): Promise<string[]> => {
  try {
    // 最新の練習情報を取得します。
    const practices = await retrieveLatestPractice();

    // 練習情報がない場合、空の配列を返して処理を終了します。
    if (!practices.results || practices.results.length === 0) {
      console.log('明日は練習がない模様です。');
      return [];
    }

    // 練習連絡を格納するための配列を初期化します。
    const renrakues: string[] = [];

    // 取得した各練習情報に対する処理を行います。
    for (const practice of practices.results) {
      // Notion APIを使用して特定のページの詳細を取得します。
      const notionPage = await retrieveNotionPage(practice.id);

      // 「練習連絡」プロパティからテキストを取得します。
      const renrakuText = extractRenrakuText(notionPage);
      if (renrakuText) {
        // 変換後のテキストを配列に追加します。
        renrakues.push(renrakuText);
      }
    }

    // 練習連絡のテキストを含む配列を返します。
    return renrakues;
  } catch (error) {
    console.error('練習情報の取得中にエラーが発生しました:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    return ['練習情報の取得中にエラーが発生しました', errorMessage];
  }
};

// Notionページオブジェクトから「練習連絡」テキストを抽出するヘルパー関数
function extractRenrakuText(notionPage: PageObjectResponse): string | undefined {
  const renrakuProperties = notionPage.properties['練習連絡'];
  if ('formula' in renrakuProperties) {
    const formulaProperty = renrakuProperties['formula'];
    if ('string' in formulaProperty) {
      const renraku = formulaProperty['string'] as string;
      return replaceEnglishDayWithJapanese(renraku);
    }
  }
  return undefined;
}
