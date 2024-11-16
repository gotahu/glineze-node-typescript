import { logger } from '../../utils/logger';
import { NotionService } from './notionService';
import { DiscordService } from '../discord/discordService';
import { PracticeService } from './practiceService';
import { config } from '../../config/config';
import { getStringPropertyValue, queryAllDatabasePages } from '../../utils/notionUtils';
import { Practice } from '../../types/types';
import { format } from 'date-fns';
import { TextChannel, ThreadChannel } from 'discord.js';

export async function remindPractice(
  service: PracticeService,
  discord: DiscordService,
  daysFromToday: number
) {
  try {
    const practices = await service.retrievePracticesForRelativeDay(daysFromToday);

    if (practices.length === 0) {
      logger.info(`${daysFromToday} 日後の練習は見つかりませんでした`, { debug: true });
      return;
    }

    // 送信先のチャンネルIDとスレッドIDを取得
    const channelId = config.getConfig('practice_remind_channelid');
    const threadId = config.getConfig('practice_remind_threadid');

    // 送信する
    await discord.sendStringsToChannel(
      practices.map((p) => p.announceText),
      channelId,
      threadId
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

export async function remindPracticesToChannel(notion: NotionService, channel: TextChannel) {
  try {
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
      await channel.send(message);
    }

    logger.info('場所取りリマインドが正常に完了しました', { debug: true });
  } catch (err) {
    logger.error('Error in remindPracticeToBashotori: ' + err);
  }
}
