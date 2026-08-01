import { Message } from 'discord.js';

export async function handleVersionCommand(message: Message) {
  message.reply(`v${process.env.npm_package_version}`);
}
