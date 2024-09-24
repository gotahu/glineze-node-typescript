import { differenceInDays } from 'date-fns';
import { TextChannel } from 'discord.js';
import { DiscordService } from './discordService';
import { NotionService } from '../notion/notionService';

/**
 * Discordチャンネルのトピックを更新する関数
 * @param client Discordクライアント
 */
async function updateChannelTopic(discord: DiscordService, notion: NotionService) {
  // Channel Topic を変更する対象のチャンネルID
  const CHANNEL_ID = notion.getConfig('discord_general_channelid');
  const TARGET_DATE = new Date(notion.getConfig('date_of_annual_concert'));

  // 今日の日付を取得
  const today = new Date();

  // 今日からターゲット日付までの日数を計算
  const daysLeft = differenceInDays(TARGET_DATE, today);

  // チャンネルを取得
  const channel = discord.client.channels.cache.get(CHANNEL_ID) as TextChannel;
  if (channel) {
    // チャンネルのトピックを更新
    await channel.setTopic(`定期演奏会まであと ${daysLeft} 日`);
    console.log(`チャンネルのトピックを更新しました: あと ${daysLeft} 日`);
  } else {
    console.error('指定されたチャンネルが見つかりませんでした。');
  }
}

export { updateChannelTopic };
