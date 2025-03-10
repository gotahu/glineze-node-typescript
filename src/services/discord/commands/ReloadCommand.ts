import { Message } from 'discord.js';
import { config } from '../../../config';
import { Services } from '../../../types/types';
import { logger } from '../../../utils/logger';

/**
 * config をリロードする
 * @param message
 * @param args
 */
export async function handleReloadCommand(message: Message, args: string[], services: Services) {
  try {
    await config.initializeConfig();

    // セサミの施錠状態のメッセージも更新する
    const { sesame } = services;
    sesame.loadSesameLockStatusMessage();

    message.reply('config をリロードしました');
  } catch (error) {
    message.reply('config リロード時にエラーが発生しました: ' + error);
    logger.error('config リロード時にエラーが発生しました: ' + error);
  }
}
