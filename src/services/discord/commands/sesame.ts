import { Message } from 'discord.js';
import { SesameService } from '../../sesame/sesameService';
import { format } from 'date-fns';
import { Services, StatusMessage } from '../../../types/types';
import { logger } from '../../../utils/logger';

export async function handleSesameStatusCommand(
  message: Message,
  args: string[],
  services: Services
) {
  try {
    const { sesame } = services;
    const status = await sesame.getSesameDeviceStatus();
    const dateStr = format(new Date(status.timestamp), 'yyyy-MM-dd HH:mm:ss');
    message.reply(`施錠状態: ${StatusMessage[status.lockStatus]}, タイムスタンプ：${dateStr}`);
  } catch (error) {
    logger.error('施錠状態を取得できませんでした ' + error);
    message.reply('施錠状態を取得できませんでした ' + error);
  }
}
