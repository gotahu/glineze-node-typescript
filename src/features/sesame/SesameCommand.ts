import { format } from 'date-fns';
import { CommandContext, CommandDependencies } from '../commands/CommandContext';
import { logger } from '../../utils/logger';

export async function handleSesameStatusCommand(
  context: CommandContext,
  _args: string[],
  services: CommandDependencies
) {
  try {
    const { sesame } = services;
    if (!sesame) {
      await context.reply('Sesame 連携は停止中です');
      return;
    }
    const status = await sesame.getSesameDeviceStatus();
    const dateStr = format(new Date(status.timestamp), 'yyyy-MM-dd HH:mm:ss');
    await context.reply(
      `施錠状態: ${sesame.getSesameLockStatusMessage(status.lockStatus)}, タイムスタンプ：${dateStr}`
    );
  } catch (error) {
    logger.error('施錠状態を取得できませんでした ' + error);
    await context.reply('施錠状態を取得できませんでした ' + error);
  }
}
