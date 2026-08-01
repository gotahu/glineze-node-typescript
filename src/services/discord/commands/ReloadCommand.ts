import { config } from '../../../config';
import { CommandContext, CommandDependencies } from '../../../features/commands/CommandContext';
import { logger } from '../../../utils/logger';

/**
 * config をリロードする
 * @param message
 * @param args
 */
export async function handleReloadCommand(
  context: CommandContext,
  _args: string[],
  services: CommandDependencies
) {
  try {
    await config.initialize();

    // セサミの施錠状態のメッセージも更新する
    services.sesame?.reloadConfiguration();

    await context.reply('config をリロードしました');
  } catch (error) {
    await context.reply('config リロード時にエラーが発生しました: ' + error);
    logger.error('config リロード時にエラーが発生しました: ' + error);
  }
}
