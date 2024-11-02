import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';

export async function handleDeleteChannelCommand(message: Message) {
  try {
    const args = message.content.split(' ');

    if (args.length < 2) {
      message.reply('チャンネル名を指定してください');
      return;
    }

    const channelId = args[1];
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
