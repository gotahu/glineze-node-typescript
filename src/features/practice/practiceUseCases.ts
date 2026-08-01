import { format } from 'date-fns';
import { config } from '../../config';
import { Practice } from '../../types/types';
import { logger } from '../../utils/logger';
import { getStringPropertyValue, queryAllDatabasePages } from '../../utils/notionUtils';
import { PracticeDependencies } from './practicePorts';

export async function notifyPractice(
  service: PracticeDependencies,
  settings: { channelId: string; daysFromToday: number }
) {
  try {
    const { notion, discord } = service;
    const { channelId, daysFromToday } = settings;
    const practiceService = notion.practiceService;
    const practices = await practiceService.retrievePracticesForRelativeDay(daysFromToday);

    if (practices.length === 0) {
      logger.info(`${daysFromToday} 日後の練習は見つかりませんでした`);
      return;
    }

    logger.info(`練習連絡を ${channelId} に送信します`, { debug: true });

    // 送信する
    await discord.sendStringsToChannel(
      practices.map((p) => p.announceText),
      channelId
    );

    logger.info(`練習連絡の送信が正常に完了しました`, { debug: true });
  } catch (err) {
    logger.error('Error in announcePractice: ' + err);
  }
}

async function fetchRemindablePractices(
  notion: PracticeDependencies['notion']
): Promise<Practice[]> {
  try {
    const facilityDatabaseId = config.get('facility_databaseid');
    const facilities = await queryAllDatabasePages(notion.client, facilityDatabaseId, {
      property: 'リマインド',
      rich_text: { is_not_empty: true },
    });

    if (facilities.length === 0) {
      logger.info('リマインド日数が設定されている施設は見つかりませんでした', { debug: true });
      return [];
    }

    const remindablePractices = [];
    for (const facility of facilities) {
      const facilityName = getStringPropertyValue(facility, 'タイトル');
      const remindStr = getStringPropertyValue(facility, 'リマインド');
      const daysFromToday = remindStr ? Number.parseInt(remindStr) : NaN;

      if (daysFromToday === undefined || Number.isNaN(daysFromToday)) {
        logger.error(`リマインド日数が取得できませんでした: ${facilityName}`);
        continue;
      }

      const practices = await notion.practiceService.retrievePracticesForRelativeDay(daysFromToday);

      // practices の place が facilityName と一致するものがあるかどうか
      const targetPractices = practices.filter((p) => p.place === facilityName);

      if (targetPractices.length > 0) {
        // リマインド対象の練習を追加
        remindablePractices.push(...targetPractices);
      }
    }

    return remindablePractices;
  } catch (err) {
    logger.error('Error in fetchRemindablePractices: ' + err);
    return [];
  }
}

export async function remindPracticesToChannel(service: PracticeDependencies, channelId: string) {
  try {
    const { notion, discord } = service;
    const remindablePractices = await fetchRemindablePractices(notion);

    if (remindablePractices.length === 0) {
      logger.info('リマインド対象の練習はありません', { debug: true });
      return;
    }

    logger.info(`リマインド対象の練習は ${remindablePractices.length} 件です`, { debug: true });

    const practiceGroups = new Map<string, Practice[]>();
    for (const practice of remindablePractices) {
      const groupKey = `${practice.place}\u0000${format(practice.date, 'yyyy/MM/dd')}`;
      const group = practiceGroups.get(groupKey) ?? [];
      group.push(practice);
      practiceGroups.set(groupKey, group);
    }

    for (const practices of practiceGroups.values()) {
      const { place, date: practiceDate } = practices[0];
      const date = format(practiceDate, 'yyyy/MM/dd');

      const message =
        `## 場所取りリマインド\nリマインド対象の「${place}」で ${date} に練習があります。\n` +
        `${practices.map((practice) => `- [${practice.title}](${practice.url})`).join('\n')}`;

      logger.info(`${place}で${date}に行われる練習のリマインドを送信します`, { debug: true });

      // 送信する
      await discord.sendStringsToChannel([message], channelId);
    }

    logger.info('場所取りリマインドが正常に完了しました', { debug: true });
  } catch (err) {
    logger.error('Error in remindPracticeToBashotori: ' + err);
  }
}
