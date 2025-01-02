import { Message } from 'discord.js';
import { config } from '../../../config/config';
import {
  calculateDiffBetweenTodayAndEventDate,
  forceSendCountdownMessage,
} from '../countdownFunction';
import { Services } from '../../../types/types';

export async function handleCountdownCommand(message: Message, services: Services) {
  // countdown days 日数を取得
  // countdown date カウントダウンを行う日付を取得
  // countdown msg カウントダウンメッセージを取得
  // countdown title カウントダウンのタイトルを取得
  // countdown channel カウントダウンメッセージを送信するチャンネルを取得
  // countdown send カウントダウンメッセージを送信する
  // countdown send以外の情報をすべて表示する

  const messageContent = message.content;

  // カウントダウンの情報をすべて表示
  const daysLeft = calculateDiffBetweenTodayAndEventDate();
  const date = config.getConfig('countdown_date');
  const msg = config.getConfig('countdown_message');
  const title = config.getConfig('countdown_title');
  const channelId = config.getConfig('countdown_channelid');
  const sendChannel = channelId ?? config.getConfig('discord_general_channelid');

  if (messageContent === '!countdown') {
    const response = `カウントダウンの情報\n日数: ${daysLeft}\n日付: ${date}\nメッセージ: ${msg}\nタイトル: ${title}\nチャンネル: ${sendChannel}`;

    await message.reply(response);
    return;
  }

  const args = message.content.split(' ').slice(1);
  const subCommand = args[0];

  switch (subCommand) {
    case 'send':
      await forceSendCountdownMessage(services);
      break;
    case 'days':
      await message.reply(`カウントダウンの日数: ${daysLeft}`);
      break;
    case 'date':
      await message.reply(`カウントダウンの日付: ${date}`);
      break;
    case 'msg':
      await message.reply(`カウントダウンメッセージ: ${msg}`);
      break;
    case 'title':
      await message.reply(`カウントダウンのタイトル: ${title}`);
      break;
    case 'channel':
      await message.reply(`カウントダウンメッセージを送信するチャンネル: ${sendChannel}`);
      break;
  }
}
