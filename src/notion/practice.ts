import { logger } from '../utils/logger';
import { NotionService } from '../services/notionService';
import { DiscordService } from '../services/discord/discordService';

export async function announcePractice(
  notion: NotionService,
  discord: DiscordService,
  daysFromToday: number
) {
  try {
    const practices = await notion.retirevePracticesForRelativeDay(daysFromToday);

    if (practices.length === 0) {
      logger.info(`${daysFromToday} 日後の練習は見つかりませんでした`);
      return;
    }

    // 送信先のチャンネルIDとスレッドIDを取得
    const channelId = await notion.getConfigValue('practice_remind_channelid');
    const threadId = await notion.getConfigValue('practice_remind_threadid');

    // 送信する
    await discord.sendStringsToChannel(
      discord.client,
      practices.map((p) => p.announceText),
      channelId,
      threadId
    );
  } catch (err) {
    logger.error('Error in announcePractice: ' + err);
  }
}
