import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';

export async function handleDeleteChannelCommand(message: Message, args: string[]) {
  try {
    if (args.length < 1) {
      message.reply('チャンネル名を指定してください');
      return;
    }

    const channelId = args[0];
    const channel = message.guild?.channels.cache.get(channelId);

    if (!channel) {
      message.reply('チャンネルが見つかりません');
      return;
    }

    await channel.delete();
    message.reply('チャンネルを削除しました');
    logger.info(`チャンネル ${channelId} を削除しました。`);
  } catch (error) {
    message.reply('チャンネル削除時にエラーが発生しました: ' + error);
    logger.error('チャンネル削除時にエラーが発生しました: ' + error);
  }
}
