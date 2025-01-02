import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { ActivityType, TextChannel } from 'discord.js';
import { DiscordService } from './discordService';
import { isValidDateString } from '../../utils/dateUtils';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { Services } from '../../types/types';
import { tz } from '@date-fns/tz';

/**
 * 今日がターゲット日付かどうかを判定する関数
 * @returns {Promise<boolean>} 今日がターゲット日付の場合はtrue、それ以外の場合はfalse
 */
function isTodayTargetDate(): boolean {
  // 何日前にカウントダウンを行うか取得し、数値型の配列に変換
  const countdownDaysString = config.getConfig('countdown_notify_days'); // バリデーションはconfigで行う
  const countdownDays = countdownDaysString.split(',').map((day) => parseInt(day, 10)); // カンマ区切りで分割して数値に変換

  console.log(countdownDays);

  // 今日からの日数を計算
  const daysLeft = calculateDiffBetweenTodayAndEventDate();

  // 今日がターゲット日付かどうかを判定
  // 配列に今日からの日数が含まれる場合はtrue、それ以外の場合はfalse
  return countdownDays.includes(daysLeft);
}

/**
 * カウントダウンメッセージを送信する関数
 * @param services サービス群
 * @returns
 * @throws {Error} カウントダウンメッセージの送信に失敗した場合
 */
async function sendCountdownMessage(services: Services) {
  try {
    if (!isTodayTargetDate()) {
      logger.info('今日はカウントダウンメッセージを送信する日ではありません', { debug: true });
      return;
    }

    forceSendCountdownMessage(services);
  } catch (error) {
    logger.error(`カウントダウンメッセージの送信に失敗しました: ${error}`);
    throw error;
  }
}

async function forceSendCountdownMessage(services: Services) {
  // カウントダウンメッセージを取得
  const message = config.getConfig('countdown_message');

  // カウントダウンの日数を計算
  const daysLeft = calculateDiffBetweenTodayAndEventDate();

  // カウントダウンのタイトルを取得
  const eventTitle = config.getConfig('countdown_title');

  // カウントダウンメッセージを更新
  const updatedMessage = message
    .replace('{days}', daysLeft.toString())
    .replace('{title}', eventTitle);

  // カウントダウンメッセージを送信
  const { discord } = services;
  const channelId =
    config.getConfig('countdown_channelid') ?? config.getConfig('discord_general_channelid');

  await discord.sendStringsToChannel([updatedMessage], channelId);

  logger.info('カウントダウンメッセージを送信しました', { debug: true });
}

/**
 * Discordチャンネルのトピックを更新する関数
 * @param discord Discordクライアント
 * @param notion Notionサービス
 */
async function updateChannelTopic(discord: DiscordService) {
  // Channel Topic を変更する対象のチャンネルID
  const CHANNEL_ID = config.getConfig('discord_general_channelid');
  const targetEventName = config.getConfig('countdown_title');

  // 今日からの日数を計算
  const daysLeft = calculateDiffBetweenTodayAndEventDate();

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
  const targetEventName = config.getConfig('countdown_title');

  // 今日からの日数を計算
  const daysLeft = calculateDiffBetweenTodayAndEventDate();

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

  logger.info(`ボットのステータスを更新しました: ${topicMessage}`, { debug: true });
}

/**
 * 日付文字列を受け取り、今日からの日数を計算する関数
 * @param targetDateString ISO形式の日付文字列
 * @returns 今日からの日数
 */
function calculateDiffBetweenTodayAndEventDate(): number {
  const eventDateString = config.getConfig('countdown_date');

  // 日付文字列の妥当性をチェック
  if (!isValidDateString(eventDateString)) {
    throw new Error('無効な日付文字列です');
    return;
  }

  // 対象日を日本時間の00:00:00に設定
  const TARGET_DATE = startOfDay(parseISO(eventDateString), { in: tz('Asia/Tokyo') });

  // 今日の日付を日本時間の00:00:00に設定
  const today = startOfDay(new Date(), { in: tz('Asia/Tokyo') });

  // 今日からターゲット日付までの日数を計算
  return differenceInDays(TARGET_DATE, today, { in: tz('Asia/Tokyo') });
}

export {
  updateChannelTopic,
  updateBotProfile,
  sendCountdownMessage,
  forceSendCountdownMessage,
  calculateDiffBetweenTodayAndEventDate,
};
