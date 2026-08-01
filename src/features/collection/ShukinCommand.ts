import { CommandContext } from '../commands/CommandContext';
import { logger } from '../../utils/logger';
import { NotionService } from '../../services/notion/notionService';

export async function replyShukinStatus(notion: NotionService, context: CommandContext) {
  try {
    const authorId = context.userId;
    logger.info(`replyShukinStatus started: authorId=${authorId}`);

    const glanzeMember = await notion.memberService.retrieveGlanzeMemberFromDiscordId(authorId);
    logger.info(`replyShukinStatus member lookup finished: found=${Boolean(glanzeMember)}`);

    // 団員名簿から情報を取得できなかった場合
    if (!glanzeMember) {
      await context.reply(
        '### エラーが発生しました。\n- エラー内容：団員名簿からあなたの情報を見つけることができませんでした。準備が整っていない可能性があるので、管理者に問い合わせてください。'
      );
      logger.info('replyShukinStatus replied member-not-found');
      return;
    }

    const reply = await notion.shukinService.retrieveShukinStatus(glanzeMember);
    logger.info(`replyShukinStatus shukin lookup finished: status=${reply.status}`);

    if (reply.status === 'error') {
      await context.reply('### エラーが発生しました。\n- エラー内容：' + reply.message);
    } else {
      await context.reply(reply.message);
    }

    logger.info(`replyShukinStatus replied: status=${reply.status}`);
  } catch (error) {
    logger.error('Error in retrieveShukinStatus: ' + error);
    await context.reply('### エラーが発生しました。\n- エラー内容：' + error);
  }
}
