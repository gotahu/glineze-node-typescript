import { Message } from 'discord.js';
import { Services } from '../../../types/types';
import { handleDeleteChannelCommand } from './deleteChannel';
import { handleCountdownCommand } from './countdown';
import { handleBreakoutRoomCommand } from '../breakoutRoom';
import { logger } from '../../../utils/logger';
import { handleLineDiscordCommand } from './lineDiscord';
import { handleReloadCommand } from './reload';
import { handleSesameStatusCommand } from './sesame';

export const commandMap = new Map<
  string,
  (message: Message, args: string[], services: Services) => Promise<void>
>([
  ['deletechannel', handleDeleteChannelCommand],
  ['countdown', handleCountdownCommand],
  ['br', handleBreakoutRoomCommand],
  ['line-discord', handleLineDiscordCommand],
  ['reload', handleReloadCommand],
  ['sesame', handleSesameStatusCommand],
]);

/**
 * メッセージからコマンドを判定し、対応する関数を実行する
 */
export async function handleCommand(message: Message, services: Services): Promise<void> {
  const content = message.content.trim();

  // 先頭が '!' でなければコマンドとして扱わない
  if (!content.startsWith('!')) return;

  // "!countdown send" のように、文字列をパース
  const [commandWithBang, ...args] = content.slice(1).split(' ');
  const command = commandWithBang.toLowerCase();

  // コマンドがMapに登録されていれば実行
  const executor = commandMap.get(command);
  if (executor) {
    try {
      await executor(message, args, services);
    } catch (error) {
      logger.error(`コマンド実行時にエラーが発生しました: ${error}`);
      await message.reply('コマンド実行時にエラーが発生しました。管理者に連絡してください。');
    }
  }
}