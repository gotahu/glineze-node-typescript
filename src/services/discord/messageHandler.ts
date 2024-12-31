import { ChannelType, DMChannel, Message, MessageType, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import axios from 'axios';
import { handleBreakoutRoomCommand } from './breakoutRoom';
import { handleLineDiscordCommand } from './commands/lineDiscord';
import { addSendButtonReaction } from './messageFunction';
import { reloadConfig } from './commands/reload';
import { replyShukinStatus } from './commands/shukin';
import { handleDeleteChannelCommand } from './commands/deletechannel';
import { handleSesameStatusCommand } from './commands/sesame';
import { handleNotifyPracticesCommand } from './commands/practice';
import { remindPracticesToChannel } from '../notion/practiceFunctions';
import { Services } from '../../types/types';

export class MessageHandler {
  constructor(private readonly services: Services) {}

  public async handleMessageCreate(message: Message): Promise<void> {
    if (message.author.bot) return;

    console.log(message);

    if (message.channel.type === ChannelType.DM) {
      await this.handleDMMessage(message);
    } else {
      await this.handleGuildMessage(message);
    }
  }

  private async handleDMMessage(message: Message): Promise<void> {
    const { notion, lineNotify } = this.services;
    const messageContent = message.content;
    const authorName = message.author.displayName;
    const dmChannel = message.channel as DMChannel;

    // 「メッセージを送信中」を表示
    dmChannel.sendTyping();

    await lineNotify.relayMessage(message, true);

    if (messageContent === 'リロード') {
      await reloadConfig(message);
      return;
    } else {
      await replyShukinStatus(notion, message);
      return;
    }
  }

  private async handleGuildMessage(message: Message): Promise<void> {
    const { lineNotify, notion, sesame } = this.services;

    await lineNotify.relayMessage(message, true);

    // テストサーバーでのメッセージの場合
    if (message.guild && message.guild.id === '1258189444888924324') {
      if (message.content === 'リロード') {
        await reloadConfig(message);
        return;
      }
    }

    // システムメッセージの場合
    if (message.type !== MessageType.Default && message.type !== MessageType.Reply) {
      logger.info(`system message, type: ${message.type}`);
      return;
    }

    // メッセージに「練習連絡」が含まれており、BOT のみがメンションされている場合
    if (
      message.content.includes('練習連絡') &&
      message.mentions.has(message.client.user) &&
      message.mentions.members.size === 1 // これを追加しないと @everyone や @全員 に反応してしまう
    ) {
      await handleNotifyPracticesCommand(notion, message);
      return;
    }

    if (message.content.startsWith('!deletechannel')) {
      await handleDeleteChannelCommand(message);
      return;
    }

    if (message.content === 'KEY') {
      await handleSesameStatusCommand(sesame, message);
      return;
    }

    if (message.content.startsWith('!br')) {
      await handleBreakoutRoomCommand(message);
      return;
    }

    if (message.content.startsWith('!line-discord')) {
      await handleLineDiscordCommand(message, notion.lineDiscordPairService);
      return;
    }

    if (message.content.startsWith('!bashotoriremind')) {
      const channel = message.channel as TextChannel;
      await remindPracticesToChannel(notion, channel);
    }

    // メッセージにGLOBALIPが含まれている場合
    if (message.content.includes('GLOBALIP')) {
      try {
        const response = await axios.get('https://api.ipify.org?format=json');
        const ip = response.data.ip;
        message.reply(ip);
      } catch (error) {
        logger.error('Error fetching IP: ' + error);
      }
      return;
    }
    // それ以外の場合（通常のチャンネルやスレッドでのメッセージ）

    // LINE に送信するかどうかを判定
    // ペアを取得
    const pair = await notion.lineDiscordPairService.getLINEDiscordPairFromMessage(message);

    // LINE に送信する場合、セーフガードとして送信用リアクションを追加する
    if (pair) {
      addSendButtonReaction(this.services, message);
    }
  }

  /**
   * メッセージが編集された場合の処理
   * @param oldMessage
   * @param newMessage
   */
  public async handleMessageUpdate(oldMessage: Message, newMessage: Message): Promise<void> {
    const { notion, lineNotify } = this.services;
    if (newMessage.channel.type === ChannelType.GuildText) {
      const notionService = notion;
      const notifyService = lineNotify;

      await notifyService.relayMessage(newMessage, true);

      try {
        // ペアを取得
        const pair =
          await notionService.lineDiscordPairService.getLINEDiscordPairFromMessage(newMessage);

        // ペアが存在すれば
        if (pair) {
          logger.info('ペアが存在しているメッセージが編集されました');
          // LINE にもう一度送信できるようにする
          addSendButtonReaction(this.services, newMessage);
        }
      } catch (error) {
        logger.error('Error in handleMessageUpdate: ' + error);
      }
    }
  }
}
