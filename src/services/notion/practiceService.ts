import { Client } from '@notionhq/client';
import { logger } from '../../utils/logger';
import { Practice } from '../../types/types';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { replaceEnglishDayWithJapanese } from '../../utils/dateUtils';
import { config } from '../../config';
import { getRelationPropertyValue, getStringPropertyValue } from '../../utils/notionUtils';
import { addDays, format } from 'date-fns';

export class PracticeService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async retrievePracticesForRelativeDay(daysFromToday: number): Promise<Practice[]> {
    const targetDate = addDays(new Date(), daysFromToday);
    const formattedDate = format(targetDate, 'yyyy-MM-dd');

    logger.info(`Retrieving practices for date: ${formattedDate}`, { debug: true });

    try {
      const databaseId = config.getConfig('practice_databaseid');
      const response = await this.client.databases.query({
        database_id: databaseId,
        filter: { property: '日付', date: { equals: formattedDate } },
      });

      const pages = response.results as PageObjectResponse[];
      const practices: Practice[] = [];

      for (const page of pages) {
        const practice: Practice = {
          url: page.url,
          id: page.id,
          title: getStringPropertyValue(page, 'タイトル') || '',
          date: targetDate,
          time: getStringPropertyValue(page, '時間') || '',
          content: getStringPropertyValue(page, '練習内容') || '未定義',
          place: '',
          announceText: '',
        };

        const placeRelations = await getRelationPropertyValue(this.client, page, '練習場所');
        if (placeRelations.length > 0) {
          practice.place = getStringPropertyValue(placeRelations[0], 'タイトル') || '';
        }

        const announceText =
          getStringPropertyValue(page, '練習連絡') || '練習連絡が取得できませんでした';
        if (announceText) {
          practice.announceText = replaceEnglishDayWithJapanese(announceText);
        }

        practices.push(practice);
      }

      return practices;
    } catch (error) {
      logger.error(`Failed to retrieve practices: ${error}`);
      throw new Error('Failed to retrieve practices');
    }
  }
}
