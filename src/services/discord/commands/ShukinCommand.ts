import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';
import { NotionService } from '../../notion/notionService';

export async function replyShukinStatus(notion: NotionService, message: Message) {
  try {
    const authorId = message.author.id;
    logger.info(
      `replyShukinStatus started: message=${message.id}, author=${message.author.tag}, authorId=${authorId}`
    );

    const glanzeMember = await notion.memberService.retrieveGlanzeMemberFromDiscordId(authorId);
    logger.info(
      `replyShukinStatus member lookup finished: message=${message.id}, found=${Boolean(glanzeMember)}`
    );

    // 団員名簿から情報を取得できなかった場合
    if (!glanzeMember) {
      await message.reply(
        '### エラーが発生しました。\n- エラー内容：団員名簿からあなたの情報を見つけることができませんでした。準備が整っていない可能性があるので、管理者に問い合わせてください。'
      );
      logger.info(`replyShukinStatus replied member-not-found: message=${message.id}`);
      return;
    }

    const reply = await notion.shukinService.retrieveShukinStatus(glanzeMember);
    logger.info(
      `replyShukinStatus shukin lookup finished: message=${message.id}, status=${reply.status}`
    );

    if (reply.status === 'error') {
      await message.reply('### エラーが発生しました。\n- エラー内容：' + reply.message);
    } else {
      await message.reply(reply.message);
    }

    logger.info(`replyShukinStatus replied: message=${message.id}, status=${reply.status}`);
  } catch (error) {
    logger.error('Error in retrieveShukinStatus: ' + error);
    await message.reply('### エラーが発生しました。\n- エラー内容：' + error);
  }
}
