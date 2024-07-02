import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { replaceEnglishDayWithJapanese } from '../utils/dateUtils';
import { getConfigurationValue, notionClient, retrieveNotionPage } from './notion-client';
import { logger } from '../utils/logger';

export const retrievePracticeForRelativeDay = async (daysFromToday: number) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysFromToday);

  const formattedDate = targetDate
    .toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/')
    .join('-');

  const database_id = await getConfigurationValue('practice_databaseid');
  if (!database_id) {
    throw new Error('practice_databaseid is not found.');
  }

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

export const retrievePracticeStringsForRelativeDay = async (
  daysFromToday: number
): Promise<string[]> => {
  try {
    const practices = await retrievePracticeForRelativeDay(daysFromToday);

    if (!practices.results || practices.results.length === 0) {
      logger.info('指定された日には練習がない模様です。');
      return [];
    }

    const renrakues: string[] = [];

    for (const practice of practices.results) {
      const notionPage = await retrieveNotionPage(practice.id);

      const renrakuText = extractRenrakuText(notionPage);
      if (renrakuText) {
        renrakues.push(renrakuText);
      }
    }

    return renrakues;
  } catch (error) {
    logger.error('練習情報の取得中にエラーが発生しました: ' + error);
    const errorMessage = error instanceof Error ? error.message : '';
    return ['練習情報の取得中にエラーが発生しました', errorMessage];
  }
};

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
