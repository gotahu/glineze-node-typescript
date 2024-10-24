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

// 突貫工事で
export async function fetchKondate(notion: NotionService, discord: DiscordService) {
  const kondateDatabaseId = '4306f7cc80334f8a9b3333f7b445873a';
  const discordChannelId = '1278820346610450573';
  //const discordThreadId = '1278820346610450573';
  const kondates = await queryAllDatabasePages(notion.client, kondateDatabaseId);
  console.log(kondates);

  const am = set(new Date(), { hours: 6, minutes: 30 });
  const nt = set(new Date(), { hours: 16, minutes: 50 });

  const now = new Date();
  console.log(now);

  for (const kondate of kondates) {
    const kondateDateTime = getDatePropertyValue(kondate, '日付');

    if (kondateDateTime) {
      const kondateMenu = '\n' + getStringPropertyValue(kondate, '献立');
      const mealTime = format(kondateDateTime, 'H:mm');
      const gohanType = getStringPropertyValue(kondate, '時間');

      const title = `## 🍚 ${format(now, 'M月d日(eee)', { locale: ja })} の${gohanType}\n`;
      let message = '';

      if (differenceInMinutes(now, nt) >= 0 && differenceInMinutes(now, nt) < 5) {
        if (isSameDay(now, kondateDateTime) && gohanType === '夕ごはん')
          // 夕食リマインド
          message = `@everyone 午後の練習お疲れさまでした⭐️今日の夕食をお知らせします！\n夕食の時間は ${mealTime} を予定しています。`;
      } else if (differenceInMinutes(now, am) >= 0 && differenceInMinutes(now, am) < 5) {
        if (isSameDay(now, kondateDateTime) && gohanType === '朝ごはん')
          // 朝食リマインド
          message = `@everyone おはようございます☀️今日の朝食をお知らせします！\n朝食の時間は ${mealTime} を予定しています。`;
      } else if (
        differenceInMinutes(kondateDateTime, now) >= 10 &&
        differenceInMinutes(kondateDateTime, now) < 15
      ) {
        if (isSameDay(now, kondateDateTime) && gohanType === '昼ごはん')
          // 昼食リマインド
          message = `@everyone お昼ご飯だ〜🍙今日の昼食をお知らせします。\n昼食の時間は ${mealTime} を予定しています。`;
      }

      if (message) {
        const channel = (await discord.client.channels.fetch(discordChannelId)) as ThreadChannel;
        await channel.send(title + message + kondateMenu);
        return;
      }
    }
  }
}
