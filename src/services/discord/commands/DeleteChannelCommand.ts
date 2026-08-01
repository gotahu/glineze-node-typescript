import { CommandContext } from '../../../features/commands/CommandContext';
import { logger } from '../../../utils/logger';

export async function handleDeleteChannelCommand(context: CommandContext, args: string[]) {
  try {
    if (args.length < 1) {
      await context.reply('チャンネル名を指定してください');
      return;
    }

    const channelId = args[0];

    if (args[1] !== 'confirm') {
      await context.reply(
        `チャンネルを削除するには \`!deletechannel ${channelId} confirm\` を実行してください`
      );
      return;
    }

    if (!(await context.operations.deleteChannel(channelId))) {
      await context.reply('チャンネルが見つかりません');
      return;
    }

    await context.reply('チャンネルを削除しました');
    logger.info(`チャンネル ${channelId} を削除しました。`);
  } catch (error) {
    await context.reply('チャンネル削除時にエラーが発生しました: ' + error);
    logger.error('チャンネル削除時にエラーが発生しました: ' + error);
  }
}
