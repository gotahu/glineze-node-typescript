import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { replaceEnglishDayWithJapanese } from '../utils';
import { getConfigurationValue, notionClient, retrieveNotionPage } from './notion-client';

/**
 * 指定された日数後の日付に関する練習情報をNotionデータベースから取得します。
 * 指定されたデータベースIDを使用してNotionデータベースをクエリし、
 * 指定された日数後の日付に関連する練習情報を取得します。
 *
 * @param {number} daysFromToday 今日からの相対的な日数。
 * @returns 指定された日数後の練習情報が含まれるオブジェクトを返すPromise。
 * @throws {Error} データベースIDが見つからない場合にエラーを投げます。
 */
const retrievePracticeForRelativeDay = async (daysFromToday: number) => {
  // 今日の日付を取得し、指定された日数後の日付に設定します。
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysFromToday);

  // 指定された日付をYYYY-MM-DD形式にフォーマットします。
  const formattedDate = targetDate
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

  // Notion APIを使用してデータベースをクエリし、指定された日付の練習情報を取得します。
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
 * 指定された日数後の日付に関する練習情報を取得し、その内容をテキストの配列として返します。
 * Notion APIを使用して練習情報を取得し、各練習に関する連絡事項を配列に格納します。
 *
 * @param {number} daysFromToday 今日からの相対的な日数。
 * @returns {Promise<string[]>} 指定された日数後の練習連絡事項のテキストを含む配列を返すPromise。
 */
export const retrievePracticeStringsForRelativeDay = async (
  daysFromToday: number
): Promise<string[]> => {
  try {
    // 指定された日数後の練習情報を取得します。
    const practices = await retrievePracticeForRelativeDay(daysFromToday);

    // 練習情報がない場合、空の配列を返して処理を終了します。
    if (!practices.results || practices.results.length === 0) {
      console.log('指定された日には練習がない模様です。');
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
