import { CommandContext, CommandDependencies } from '../../../features/commands/CommandContext';
import { updateBotProfile } from '../../../features/countdown/CountdownFunctions';

export async function handleUpdateBotProfileCommand(
  context: CommandContext,
  _args: string[],
  services: CommandDependencies
) {
  const { discord } = services;

  if (!discord) {
    await context.reply('Discord service not available');
    return;
  }

  updateBotProfile(discord);

  await context.reply('BOTプロフィールを更新しました');
}
