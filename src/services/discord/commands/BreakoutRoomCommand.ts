// ba create 10
// ba remove
// ba random

import { Message } from 'discord.js';
import {
  createBreakoutRooms,
  removeBreakoutRooms,
  randomBreakoutRooms,
} from '../functions/BreakoutRoomFunctions';

export async function handleBreakoutRoomCommand(message: Message, args: string[]) {
  if (args.length < 1) {
    message.reply({ content: '引数が不足しています' });
    return;
  }
  const subCommand = args[0];
  if (subCommand === 'create') {
    if (args.length < 2) {
      message.reply({ content: '引数が不足しています' });
      return;
    }
    const number = parseInt(args[1]);
    if (isNaN(number)) {
      message.reply({ content: '引数が不正です' });
      return;
    }
    await createBreakoutRooms(message.guild, number);
    return;
  } else if (subCommand === 'remove') {
    await removeBreakoutRooms(message.guild);
    return;
  } else if (subCommand === 'random') {
    await randomBreakoutRooms(message);
    return;
  }
}
