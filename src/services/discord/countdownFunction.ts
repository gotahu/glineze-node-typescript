import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { ActivityType, TextChannel } from 'discord.js';
import { DiscordService } from './discordService';
import { isValidDateString } from '../../utils/dateUtils';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { Services } from '../../types/types';
import { tz } from '@date-fns/tz';

// 定数を分離
const COUNTDOWN_MESSAGES = {
  future: (title: string, days: number) => `${title}まで ${days} 日`,
  today: (title: string) => `${title}は今日です！`,
  past: (title: string, days: number) => `${title}は ${-days} 日前に終了しました`
} as const;

/**
 * イベントの状態を表す型
 */
type EventStatus = {
  message: string;
  daysLeft: number;
};

/**
 * イベントの状態を計算する関数
 */
function calculateEventStatus(daysLeft: number, eventTitle: string): EventStatus {
  if (daysLeft > 0) {
    return { message: COUNTDOWN_MESSAGES.future(eventTitle, daysLeft), daysLeft };
  } else if (daysLeft === 0) {
    return { message: COUNTDOWN_MESSAGES.today(eventTitle), daysLeft };
  } else {
    return { message: COUNTDOWN_MESSAGES.past(eventTitle, daysLeft), daysLeft };
  }
}

/**
 * カウントダウン対象日までの日数を計算
 */
function calculateDiffBetweenTodayAndEventDate(): number {
  const eventDateString = config.getConfig('countdown_date');

  if (!isValidDateString(eventDateString)) {
    throw new Error('無効な日付文字列です');
  }

  const targetDate = startOfDay(parseISO(eventDateString));
  const today = startOfDay(new Date());

  return differenceInDays(targetDate, today, {in: tz('Asia/Tokyo')});
}

/**
 * カウントダウン通知日かどうかを判定
 */
function isTodayTargetDate(): boolean {
  // カウントダウン通知日を取得
  // カウントダウン通知日はカンマ区切りで入力されるため、配列に変換
  const countdownDays = config.getConfig('countdown_notify_days')
    .split(',')
    .map(day => parseInt(day, 10));

  // カウントダウン対象日までの日数を計算
  const daysLeft = calculateDiffBetweenTodayAndEventDate();

  // カウントダウン通知日に含まれる場合はtrue、それ以外の場合はfalse
  return countdownDays.includes(daysLeft);
}

/**
 * カウントダウンメッセージを送信
 */
async function sendCountdownMessage(services: Services): Promise<void> {
  try {
    if (!isTodayTargetDate()) {
      logger.info('今日はカウントダウンメッセージを送信する日ではありません');
      return;
    }

    await forceSendCountdownMessage(services);
  } catch (error) {
    logger.error('カウントダウンメッセージの送信に失敗しました', { error });
    throw error;
  }
}

/**
 * カウントダウンメッセージを強制送信
 */
async function forceSendCountdownMessage(services: Services): Promise<void> {
  const { discord } = services;
  const daysLeft = calculateDiffBetweenTodayAndEventDate();
  const eventTitle = config.getConfig('countdown_title');
  const message = config.getConfig('countdown_message')
    .replace('{days}', daysLeft.toString())
    .replace('{title}', eventTitle);

  const channelId = config.getConfig('countdown_channelid') ??
    config.getConfig('discord_general_channelid');

  await discord.sendStringsToChannel([message], channelId);
  logger.info('カウントダウンメッセージを送信しました');
}

/**
 * チャンネルトピックを更新
 */
async function updateChannelTopic(discord: DiscordService): Promise<void> {
  try {
    const channelId = config.getConfig('discord_general_channelid');
    const channel = discord.client.channels.cache.get(channelId) as TextChannel;

    if (!channel) {
      throw new Error('指定されたチャンネルが見つかりません');
    }

    const eventTitle = config.getConfig('countdown_title');
    const { message } = calculateEventStatus(
      calculateDiffBetweenTodayAndEventDate(),
      eventTitle
    );

    await channel.setTopic(message);
    logger.info(`チャンネルトピックを更新しました: ${message}`);
  } catch (error) {
    logger.error('チャンネルトピックの更新に失敗しました', { error });
    throw error;
  }
}

/**
 * ボットのプロフィールを更新
 */
function updateBotProfile(discord: DiscordService): void {
  try {
    const eventTitle = config.getConfig('countdown_title');
    const { message } = calculateEventStatus(
      calculateDiffBetweenTodayAndEventDate(),
      eventTitle
    );

    discord.client.user.setActivity(message, { type: ActivityType.Custom });
    logger.info(`ボットのステータスを更新しました: ${message}`);
  } catch (error) {
    logger.error('ボットプロフィールの更新に失敗しました', { error });
    throw error;
  }
}

export {
  updateChannelTopic,
  updateBotProfile,
  sendCountdownMessage,
  forceSendCountdownMessage,
  calculateDiffBetweenTodayAndEventDate,
};
