import { CommandContext } from '../../../features/commands/CommandContext';

export async function handleVersionCommand(context: CommandContext) {
  await context.reply(`v${process.env.npm_package_version}`);
}
