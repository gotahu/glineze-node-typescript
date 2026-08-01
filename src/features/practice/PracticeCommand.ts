import { CommandContext } from '../commands/CommandContext';
import { NotionService } from '../../services/notion/notionService';

export async function handleNotifyPracticesCommand(notion: NotionService, context: CommandContext) {
  // 「メッセージを送信中」を表示
  await context.sendTyping();

  // 次の日の練習を取得
  const practices = await notion.practiceService.retrievePracticesForRelativeDay(1);

  if (practices.length === 0) {
    await context.reply('練習はありません');
    return;
  }

  for (const practice of practices) {
    await context.reply(practice.announceText);
  }

  return;
}
