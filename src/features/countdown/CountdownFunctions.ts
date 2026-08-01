import { tz, TZDate } from '@date-fns/tz';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { config } from '../../config';
import { isValidDateString } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import { BotActivityPort, CountdownDependencies } from './countdownPorts';

// 定数を分離
const COUNTDOWN_MESSAGES = {
  future: (title: string, days: number) => `${title}まで ${days} 日`,
  today: (title: string) => `${title}は今日です！`,
  past: (title: string, days: number) => `${title}は ${-days} 日前に終了しました`,
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
  const eventDateString = config.get('countdown_date');

  if (!isValidDateString(eventDateString)) {
    throw new Error('無効な日付文字列です');
  }

  const targetDate = startOfDay(new TZDate(parseISO(eventDateString), 'Asia/Tokyo'));
  const today = startOfDay(new TZDate(new Date(), 'Asia/Tokyo'));

  const diff = differenceInDays(targetDate, today, { in: tz('Asia/Tokyo') });

  return diff;
}

/**
 * カウントダウン通知日かどうかを判定
 */
function isTodayTargetDate(): boolean {
  // カウントダウン通知日を取得
  // カウントダウン通知日はカンマ区切りで入力されるため、配列に変換
  const countdownDays = config.get('countdown_notify_days');

  // カウントダウン対象日までの日数を計算
  const daysLeft = calculateDiffBetweenTodayAndEventDate();

  logger.info(`isTodayTargetDate: daysLeft: ${daysLeft}, countdownDays: ${countdownDays}`, {
    debug: true,
  });

  // カウントダウン通知日に含まれる場合はtrue、それ以外の場合はfalse
  return countdownDays.includes(daysLeft);
}

/**
 * カウントダウンメッセージを送信
 */
async function sendCountdownMessage(services: CountdownDependencies): Promise<void> {
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
async function forceSendCountdownMessage(services: CountdownDependencies): Promise<void> {
  const { discord } = services;
  const daysLeft = calculateDiffBetweenTodayAndEventDate();
  const eventTitle = config.get('countdown_title');
  const message = config
    .get('countdown_message')
    .replace('{days}', daysLeft.toString())
    .replace('{title}', eventTitle);

  const channelId =
    config.getOptional('countdown_channelid') || config.get('discord_general_channelid');

  await discord.sendStringsToChannel([message], channelId);
  logger.info('カウントダウンメッセージを送信しました');
}

/**
 * ボットのプロフィールを更新
 */
function updateBotProfile(discord: BotActivityPort): void {
  try {
    const eventTitle = config.get('countdown_title');
    const { message } = calculateEventStatus(calculateDiffBetweenTodayAndEventDate(), eventTitle);

    discord.setBotActivity(message);
    logger.info(`ボットのステータスを更新しました: ${message}`);
  } catch (error) {
    logger.error('ボットプロフィールの更新に失敗しました', { error });
    throw error;
  }
}

export {
  calculateDiffBetweenTodayAndEventDate,
  forceSendCountdownMessage,
  sendCountdownMessage,
  updateBotProfile,
};
