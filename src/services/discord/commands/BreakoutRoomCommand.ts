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
  if (!message.guild) {
    return;
  }
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
    if (args[1] !== 'confirm') {
      await message.reply({
        content: 'すべてのブレイクアウトルームを削除するには確認が必要です',
      });
      return;
    }
    await removeBreakoutRooms(message.guild);
    return;
  } else if (subCommand === 'random') {
    if (args.length !== 2 || args[1] !== 'confirm') {
      await message.reply({
        content: 'メンバーを移動するには確認が必要です',
      });
      return;
    }
    await randomBreakoutRooms(message);
    return;
  }
}
