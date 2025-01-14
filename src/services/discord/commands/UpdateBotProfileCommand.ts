import { Message } from 'discord.js';
import { Services } from '../../../types/types';
import { updateBotProfile } from '../functions/CountdownFunctions';

export async function handleUpdateBotProfileCommand(
  message: Message,
  args: string[],
  services: Services
) {
  const { discord } = services;

  if (!discord) {
    message.reply('Discord service not available');
    return;
  }

  updateBotProfile(discord);

  message.reply('BOTプロフィールを更新しました');
}
