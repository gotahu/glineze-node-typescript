import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';
import { MemberService } from '../../notion/memberService';
import { NotionService } from '../../notion/notionService';

export async function replyShukinStatus(notion: NotionService, message: Message) {
  try {
    const authorId = message.author.id;
    const glanzeMember = await notion.memberService.retrieveGlanzeMemberFromDiscordId(authorId);

    // 団員名簿から情報を取得できなかった場合
    if (!glanzeMember) {
      message.reply(
        '### エラーが発生しました。\n- エラー内容：団員名簿からあなたの情報を見つけることができませんでした。準備が整っていない可能性があるので、管理者に問い合わせてください。'
      );
      return;
    }

    const reply = await notion.shukinService.retrieveShukinStatus(glanzeMember);

    if (reply.status === 'error') {
      message.reply('### エラーが発生しました。\n- エラー内容：' + reply.message);
    } else {
      message.reply(reply.message);
    }
  } catch (error) {
    logger.error('Error in retrieveShukinStatus: ' + error);
    message.reply('### エラーが発生しました。\n- エラー内容：' + error);
  }
}
