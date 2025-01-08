import { differenceInMinutes, format, isSameDay, set } from 'date-fns';
import { NotionService } from './notionService';
import { DiscordService } from '../discord/discordService';
import { ThreadChannel } from 'discord.js';
import { ja } from 'date-fns/locale/ja';
import {
  getDatePropertyValue,
  getStringPropertyValue,
  queryAllDatabasePages,
} from '../../utils/notionUtils';

interface MealConfig {
  type: '朝ごはん' | '昼ごはん' | '夕ごはん';
  checkTime: Date;
  message: string;
}

const KONDATE_CONFIG = {
  DATABASE_ID: '4306f7cc80334f8a9b3333f7b445873a',
  CHANNEL_ID: '1278820346610450573',
  NOTIFICATION_WINDOW: 5, // minutes
  LUNCH_NOTIFICATION_WINDOW: { start: 10, end: 15 }, // minutes
} as const;

const MEAL_CONFIGS: MealConfig[] = [
  {
    type: '朝ごはん',
    checkTime: set(new Date(), { hours: 6, minutes: 30 }),
    message: 'おはようございます☀️今日の朝食をお知らせします！',
  },
  {
    type: '昼ごはん',
    checkTime: new Date(), // 昼食は時間との差分で判定
    message: 'お昼ご飯だ〜🍙今日の昼食をお知らせします。',
  },
  {
    type: '夕ごはん',
    checkTime: set(new Date(), { hours: 16, minutes: 50 }),
    message: '午後の練習お疲れさまでした⭐️今日の夕食をお知らせします！',
  },
];

function createMealMessage(mealTime: string, baseMessage: string): string {
  return `@everyone ${baseMessage}\n${mealTime} を予定しています。`;
}

export async function fetchKondate(notion: NotionService, discord: DiscordService) {
  try {
    const kondates = await queryAllDatabasePages(notion.client, KONDATE_CONFIG.DATABASE_ID);
    const now = new Date();

    for (const kondate of kondates) {
      const kondateDateTime = getDatePropertyValue(kondate, '日付');
      if (!kondateDateTime || !isSameDay(now, kondateDateTime)) continue;

      const gohanType = getStringPropertyValue(kondate, '時間');
      const mealConfig = MEAL_CONFIGS.find((config) => config.type === gohanType);
      if (!mealConfig) continue;

      /*
       * 昼ごはんの場合は時間との差分で判定
       * 朝ごはんと夕ごはんの場合は時間との差分で判定
       */
      const shouldNotify =
        gohanType === '昼ごはん'
          ? differenceInMinutes(kondateDateTime, now) >=
              KONDATE_CONFIG.LUNCH_NOTIFICATION_WINDOW.start &&
            differenceInMinutes(kondateDateTime, now) < KONDATE_CONFIG.LUNCH_NOTIFICATION_WINDOW.end
          : differenceInMinutes(now, mealConfig.checkTime) >= 0 &&
            differenceInMinutes(now, mealConfig.checkTime) < KONDATE_CONFIG.NOTIFICATION_WINDOW;

      // 通知する場合
      if (shouldNotify) {
        const mealTime = format(kondateDateTime, 'H:mm');
        const kondateMenu = '\n' + getStringPropertyValue(kondate, '献立');
        const title = `## 🍚 ${format(now, 'M月d日(eee)', { locale: ja })} の${gohanType}\n`;
        const message = createMealMessage(mealTime, mealConfig.message);

        const channel = (await discord.client.channels.fetch(
          KONDATE_CONFIG.CHANNEL_ID
        )) as ThreadChannel;
        await channel.send(title + message + kondateMenu);
        return;
      }
    }
  } catch (error) {
    console.error('献立の取得・通知処理でエラーが発生しました:', error);
    throw error;
  }
}
