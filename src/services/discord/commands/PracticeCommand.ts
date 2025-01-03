import { Message } from 'discord.js';
import { NotionService } from '../../notion/notionService';

export async function handleNotifyPracticesCommand(notion: NotionService, message: Message) {
  // 「メッセージを送信中」を表示
  if (message.channel.isSendable()) {
    message.channel.sendTyping();
  }

  // 次の日の練習を取得
  const practices = await notion.practiceService.retrievePracticesForRelativeDay(1);

  if (practices.length === 0) {
    message.reply('練習はありません');
    return;
  }

  for (const practice of practices) {
    message.reply(practice.announceText);
  }

  return;
}
