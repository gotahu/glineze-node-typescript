import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { ActivityType, TextChannel } from 'discord.js';
import { DiscordService } from './discordService';
import { isValidDateString } from '../../utils/dateUtils';
import { config } from '../../config/config';

/**
 * Discordチャンネルのトピックを更新する関数
 * @param discord Discordクライアント
 * @param notion Notionサービス
 */
async function updateChannelTopic(discord: DiscordService) {
  // Channel Topic を変更する対象のチャンネルID
  const CHANNEL_ID = config.getConfig('discord_general_channelid');
  const targetDateString = config.getConfig('date_of_countdown_date');
  const targetEventName = config.getConfig('name_of_countdown');

  // 日付文字列の妥当性をチェック
  if (!isValidDateString(targetDateString)) {
    console.error('無効な日付文字列です:', targetDateString);
    return;
  }

  // 対象日を日本時間の00:00:00に設定
  const TARGET_DATE = startOfDay(parseISO(targetDateString));

  // 今日の日付を日本時間の00:00:00に設定
  const today = startOfDay(new Date());

  // 今日からターゲット日付までの日数を計算
  const daysLeft = differenceInDays(TARGET_DATE, today);

  // チャンネルを取得
  const channel = discord.client.channels.cache.get(CHANNEL_ID) as TextChannel;
  if (channel) {
    // 日数に応じてメッセージを変更
    let topicMessage: string;
    if (daysLeft > 0) {
      topicMessage = `${targetEventName}まであと ${daysLeft} 日`;
    } else if (daysLeft === 0) {
      topicMessage = `${targetEventName}は今日です！`;
    } else {
      topicMessage = `${targetEventName}は ${-daysLeft} 日前に終了しました`;
    }

    // チャンネルのトピックを更新
    await channel.setTopic(topicMessage);
    console.log(`チャンネルのトピックを更新しました: ${topicMessage}`);
  } else {
    console.error('指定されたチャンネルが見つかりませんでした。');
  }
}

function updateBotProfile(discord: DiscordService) {
  const targetDateString = config.getConfig('date_of_countdown_date');
  const targetEventName = config.getConfig('name_of_countdown');

  // 対象日を日本時間の00:00:00に設定
  const TARGET_DATE = startOfDay(parseISO(targetDateString));

  // 今日の日付を日本時間の00:00:00に設定
  const today = startOfDay(new Date());

  // 今日からターゲット日付までの日数を計算
  const daysLeft = differenceInDays(TARGET_DATE, today);

  // 日数に応じてメッセージを変更
  let topicMessage: string;
  if (daysLeft > 0) {
    topicMessage = `${targetEventName}まで ${daysLeft} 日`;
  } else if (daysLeft === 0) {
    topicMessage = `${targetEventName}は今日です！`;
  } else {
    topicMessage = `${targetEventName}は ${-daysLeft} 日前に終了しました`;
  }

  // ボットのステータスを更新
  discord.client.user.setActivity(topicMessage, { type: ActivityType.Custom });

  console.log(`ボットのステータスを更新しました: ${topicMessage}`);
}

export { updateChannelTopic, updateBotProfile };
