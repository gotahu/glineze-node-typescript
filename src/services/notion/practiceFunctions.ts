import { format } from 'date-fns';
import { config } from '../../config/config';
import { Practice, Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { getStringPropertyValue, queryAllDatabasePages } from '../../utils/notionUtils';
import { NotionService } from './notionService';

export async function notifyPractice(
  service: Services,
  settings: { channelId: string; daysFromToday: number }
) {
  try {
    const { notion, discord } = service;
    const { channelId, daysFromToday } = settings;
    const practiceService = notion.practiceService;
    const practices = await practiceService.retrievePracticesForRelativeDay(daysFromToday);

    if (practices.length === 0) {
      logger.info(`${daysFromToday} 日後の練習は見つかりませんでした`, { debug: true });
      return;
    }

    // 送信する
    await discord.sendStringsToChannel(
      practices.map((p) => p.announceText),
      channelId
    );

    logger.info(`練習のリマインドが正常に完了しました`, { debug: true });
  } catch (err) {
    logger.error('Error in announcePractice: ' + err);
  }
}

async function fetchRemindablePractices(notion: NotionService): Promise<Practice[]> {
  try {
    const facilityDatabaseId = config.getConfig('facility_databaseid');
    const facilities = await queryAllDatabasePages(notion.client, facilityDatabaseId, {
      property: 'リマインド',
      rich_text: { is_not_empty: true },
    });

    if (facilities.length === 0) {
      logger.info('リマインド対象の施設はありません', { debug: true });
      return [];
    }

    const remindablePractices = [];
    for (const facility of facilities) {
      const facilityName = getStringPropertyValue(facility, 'タイトル');
      const daysFromToday = Number.parseInt(getStringPropertyValue(facility, 'リマインド'));

      if (daysFromToday === undefined || Number.isNaN(daysFromToday)) {
        logger.error(`リマインド日数が取得できませんでした: ${facilityName}`);
        continue;
      }

      const practices = await notion.practiceService.retrievePracticesForRelativeDay(daysFromToday);

      // practices の place が facilityName と一致するものがあるかどうか
      const targetPractices = practices.filter((p) => p.place === facilityName);

      if (targetPractices.length > 0) {
        remindablePractices.push(...targetPractices);
      }
    }

    return remindablePractices;
  } catch (err) {
    logger.error('Error in fetchRemindablePractices: ' + err);
  }
}

export async function remindPracticesToChannel(service: Services, channelId: string) {
  try {
    const { notion, discord } = service;
    const remindablePractices = await fetchRemindablePractices(notion);

    if (remindablePractices.length === 0) {
      logger.info('リマインド対象の練習はありません', { debug: true });
      return;
    }

    for (const practice of remindablePractices) {
      const place = practice.place;
      const date = format(practice.date, 'yyyy/MM/dd');

      const message =
        `## 場所取りリマインド\nリマインド対象の「${place}」で ${date} に練習があります。\n` +
        `${remindablePractices.map((p) => `- [${p.title}](${p.url})`).join('\n')}`;

      logger.info(`${place}で${date}に行われる練習のリマインドを送信します`, { debug: true });

      // 送信する
      await discord.sendStringsToChannel([message], channelId);
    }

    logger.info('場所取りリマインドが正常に完了しました', { debug: true });
  } catch (err) {
    logger.error('Error in remindPracticeToBashotori: ' + err);
  }
}
