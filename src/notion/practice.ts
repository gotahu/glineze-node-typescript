import { logger } from '../utils/logger';
import { NotionService } from '../services/notionService';
import { DiscordService } from '../services/discord/discordService';

export async function announcePractice(
  notion: NotionService,
  discord: DiscordService,
  daysFromToday: number
) {
  try {
    const practices = await notion.retrievePracticesForRelativeDay(daysFromToday);

    if (practices.length === 0) {
      logger.info(`${daysFromToday} 日後の練習は見つかりませんでした`);
      return;
    }

    // 送信先のチャンネルIDとスレッドIDを取得
    const channelId = notion.getConfig('practice_remind_channelid');
    const threadId = notion.getConfig('practice_remind_threadid');

    // 送信する
    await discord.sendStringsToChannel(
      practices.map((p) => p.announceText),
      channelId,
      threadId
    );
  } catch (err) {
    logger.error('Error in announcePractice: ' + err);
  }
}

export async function remindPracticeToBashotori(notion: NotionService, discord: DiscordService) {
  try {
    const facilityDatabaseId = notion.getConfig('facility_databaseid');
    const facilities = await notion.queryAllDatabasePages(facilityDatabaseId, {
      property: 'リマインド',
      rich_text: { is_not_empty: true },
    });

    if (facilities.length === 0) {
      logger.info('リマインドが未設定の施設はありません');
      return;
    }

    for (const facility of facilities) {
      const facilityName = notion.getStringPropertyValue(facility, 'タイトル', 'title');
      const daysFromToday = Number.parseInt(
        notion.getStringPropertyValue(facility, 'リマインド', 'rich_text')
      );

      if (daysFromToday === undefined || Number.isNaN(daysFromToday)) {
        logger.error(`リマインド日数が取得できませんでした: ${facilityName}`);
        continue;
      }

      const practices = await notion.retrievePracticesForRelativeDay(daysFromToday);

      // practices の place が facilityName と一致するものがあるかどうか
      const targetPractices = practices.filter((p) => p.place === facilityName);

      console.log(targetPractices);

      if (targetPractices.length > 0) {
        // 送信先のチャンネルIDとスレッドIDを取得
        const channelId = notion.getConfig('bashotori_remind_channelid');
        const threadId = notion.getConfig('bashotori_remind_threadid');

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
