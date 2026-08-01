// ba create 10
// ba remove
// ba random

import { CommandContext } from '../commands/CommandContext';

export async function handleBreakoutRoomCommand(context: CommandContext, args: string[]) {
  if (!context.operations.guildAvailable) {
    return;
  }
  if (args.length < 1) {
    await context.reply('引数が不足しています');
    return;
  }
  const subCommand = args[0];
  if (subCommand === 'create') {
    if (args.length < 2) {
      await context.reply('引数が不足しています');
      return;
    }
    const number = parseInt(args[1]);
    if (isNaN(number)) {
      await context.reply('引数が不正です');
      return;
    }
    await context.operations.createBreakoutRooms(number);
    return;
  } else if (subCommand === 'remove') {
    if (args[1] !== 'confirm') {
      await context.reply(
        '全てのブレイクアウトルームを削除するには `!br remove confirm` を実行してください'
      );
      return;
    }
    await context.operations.removeBreakoutRooms();
    return;
  } else if (subCommand === 'random') {
    if (args.length !== 2 || args[1] !== 'confirm') {
      await context.reply('メンバーを移動するには `!br random confirm` を実行してください');
      return;
    }
    const result = await context.operations.randomBreakoutRooms();
    if (result === 'no_breakout_rooms') {
      await context.reply('ブレイクアウトルームが未作成です');
    } else if (result === 'not_in_voice') {
      await context.reply('ボイスチャンネルに参加してから実行してください');
    } else {
      await context.reply('メンバーをランダムにブレイクアウトルームに分配しました');
    }
    return;
  }
}
