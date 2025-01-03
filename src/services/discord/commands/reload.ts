import { Message } from 'discord.js';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';

/**
 * config をリロードします
 * @param message
 * @returns
 */
export async function reloadConfig(message: Message): Promise<void> {
  const messageContent = message.content;
  const authorName = message.author.displayName;

  if (messageContent === 'リロード') {
    try {
      await config.initializeConfig();
      message.reply('リロードしました。');
      return;
    } catch (error) {
      message.reply('リロードに失敗しました。管理者に連絡してください。');
      logger.error(`${authorName} が config をリロードしようとしましたが、エラーが発生しました。`);
      return;
    }
  }
}
