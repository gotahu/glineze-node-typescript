import { config } from '../../config';
import { CommandContext } from '../commands/CommandContext';
import {
  calculateDiffBetweenTodayAndEventDate,
  forceSendCountdownMessage,
} from './CountdownFunctions';
import { CountdownDependencies } from './countdownPorts';

export async function handleCountdownCommand(
  context: CommandContext,
  args: string[],
  services: CountdownDependencies
) {
  // countdown days 日数を取得
  // countdown date カウントダウンを行う日付を取得
  // countdown msg カウントダウンメッセージを取得
  // countdown title カウントダウンのタイトルを取得
  // countdown channel カウントダウンメッセージを送信するチャンネルを取得
  // countdown send カウントダウンメッセージを送信する
  // countdown send以外の情報をすべて表示する

  const messageContent = context.content;

  // カウントダウンの情報をすべて表示
  const daysLeft = calculateDiffBetweenTodayAndEventDate();
  const date = config.get('countdown_date');
  const msg = config.get('countdown_message');
  const title = config.get('countdown_title');
  const sendChannel =
    config.getOptional('countdown_channelid') ?? config.get('discord_general_channelid');

  // !countdownコマンドの場合は全情報を表示
  if (messageContent === '!countdown') {
    const response = `カウントダウンの情報\n日数: ${daysLeft}\n日付: ${date}\nメッセージ: ${msg}\nタイトル: ${title}\nチャンネル: ${sendChannel}`;
    await context.reply(response);
    return;
  }

  // サブコマンドの存在確認
  if (!args.length) {
    await context.reply(
      'サブコマンドを指定してください。\n使用可能なサブコマンド: send, days, date, msg, title, channel'
    );
    return;
  }

  const subCommand = args[0];
  const validSubCommands = ['send', 'days', 'date', 'msg', 'title', 'channel'];

  if (!validSubCommands.includes(subCommand)) {
    await context.reply(
      `無効なサブコマンドです。\n使用可能なサブコマンド: ${validSubCommands.join(', ')}`
    );
    return;
  }

  switch (subCommand) {
    case 'send':
      await forceSendCountdownMessage(services);
      break;
    case 'days':
      await context.reply(`カウントダウンの日数: ${daysLeft}`);
      break;
    case 'date':
      await context.reply(`カウントダウンの日付: ${date}`);
      break;
    case 'msg':
      await context.reply(`カウントダウンメッセージ: ${msg}`);
      break;
    case 'title':
      await context.reply(`カウントダウンのタイトル: ${title}`);
      break;
    case 'channel':
      await context.reply(`カウントダウンメッセージを送信するチャンネル: ${sendChannel}`);
      break;
  }
}
