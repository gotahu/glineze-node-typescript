import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';

export async function handleDeleteChannelCommand(message: Message, args: string[]) {
  try {
    if (args.length < 1) {
      await message.reply('チャンネル名を指定してください');
      return;
    }

    const channelId = args[0];

    if (args[1] !== 'confirm') {
      await message.reply('チャンネルを削除するには確認が必要です');
      return;
    }

    const channel = message.guild?.channels.cache.get(channelId);

    if (!channel) {
      await message.reply('チャンネルが見つかりません');
      return;
    }

    await channel.delete();
    await message.reply('チャンネルを削除しました');
    logger.info(`チャンネル ${channelId} を削除しました。`);
  } catch (error) {
    message.reply('チャンネル削除時にエラーが発生しました: ' + error);
    logger.error('チャンネル削除時にエラーが発生しました: ' + error);
  }
}
