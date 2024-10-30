import { logger } from '../../utils/logger';
import { NotionService } from './notionService';
import { DiscordService } from '../discord/discordService';
import { PracticeService } from './practiceService';
import { config } from '../../config/config';
import { getStringPropertyValue, queryAllDatabasePages } from '../../utils/notionUtils';

export async function remindPractice(
  service: PracticeService,
  discord: DiscordService,
  daysFromToday: number
) {
  try {
    const practices = await service.retrievePracticesForRelativeDay(daysFromToday);

    if (practices.length === 0) {
      logger.info(`${daysFromToday} 日後の練習は見つかりませんでした`, true);
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

    logger.info(`練習のリマインドが正常に完了しました`, true);
  } catch (err) {
    logger.error('Error in announcePractice: ' + err);
  }
}

export async function remindPracticeToBashotori(notion: NotionService, discord: DiscordService) {
  try {
    const facilityDatabaseId = config.getConfig('facility_databaseid');
    const facilities = await queryAllDatabasePages(notion.client, facilityDatabaseId, {
      property: 'リマインド',
      rich_text: { is_not_empty: true },
    });

    if (facilities.length === 0) {
      logger.info('リマインド対象の施設はありません');
      return;
    }

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
        // 送信先のチャンネルIDとスレッドIDを取得
        const channelId = config.getConfig('bashotori_remind_channelid');
        const threadId = config.getConfig('bashotori_remind_threadid');

        const message =
          `## 場所取りリマインド\nリマインド対象の「${facilityName}」で ${daysFromToday} 日後に練習があります。\n` +
          `${targetPractices.map((p) => `- [${p.title}](${p.url})`).join('\n')}`;

        // 送信する
        await discord.sendStringsToChannel([message], channelId, threadId);
        logger.info(`リマインドを送信しました: ${facilityName}`);
      } else {
        logger.info(`リマインド対象の練習はありませんでした: ${facilityName}`);
      }
    }
  } catch (err) {
    logger.error('Error in remindPracticeToBashotori: ' + err);
  }
}
