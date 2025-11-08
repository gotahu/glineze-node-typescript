import { tz } from '@date-fns/tz';
import { Client } from '@notionhq/client';
import { addDays, format } from 'date-fns';
import { config } from '../../config';
import { Practice } from '../../types/types';
import { replaceEnglishDayWithJapanese } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import {
  getRelationPropertyValue,
  getStringPropertyValue,
  queryAllDatabasePages,
} from '../../utils/notionUtils';

export class PracticeService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async retrievePracticesForRelativeDay(daysFromToday: number): Promise<Practice[]> {
    // タイムゾーンを日本時間に設定し、日付を取得
    const targetDate = addDays(new Date(), daysFromToday, { in: tz('Asia/Tokyo') });

    // 日付を yyyy-MM-dd 形式にフォーマット
    const formattedDate = format(targetDate, 'yyyy-MM-dd');

    logger.info(`${formattedDate} の練習を練習DBから取得します。`, { debug: true });

    try {
      const databaseId = config.getConfig('practice_databaseid');
      const pages = await queryAllDatabasePages(this.client, databaseId, {
        property: '日付',
        date: { equals: formattedDate },
      });
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

      logger.info(`${practices.length} 件の練習を取得しました。`, { debug: true });

      return practices;
    } catch (error) {
      logger.error(`Failed to retrieve practices: ${error}`);
      throw new Error('Failed to retrieve practices');
    }
  }
}
