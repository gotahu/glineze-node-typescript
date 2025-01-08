import { Message } from 'discord.js';

export async function handleVersionCommand(message: Message, args: string[]) {
  message.reply(`v${process.env.npm_package_version}`);
}
