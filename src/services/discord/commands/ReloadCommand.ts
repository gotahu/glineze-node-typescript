import { Message } from 'discord.js';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';

/**
 * config をリロードする
 * @param message
 * @param args
 */
export async function handleReloadCommand(message: Message, args: string[]) {
  try {
    await config.initializeConfig();

    message.reply('config をリロードしました');
  } catch (error) {
    message.reply('config リロード時にエラーが発生しました: ' + error);
    logger.error('config リロード時にエラーが発生しました: ' + error);
  }
}