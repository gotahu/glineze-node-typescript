import axios from 'axios';
import { ChannelType, DMChannel, Message, MessageType, TextChannel } from 'discord.js';
import { env } from '../../env';
import { Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { PartialMessage } from 'discord.js';
import { remindPracticesToChannel } from '../notion/practiceFunctions';
import { handleCommand } from './commands';
import { handleNotifyPracticesCommand } from './commands/PracticeCommand';
import { replyShukinStatus } from './commands/ShukinCommand';
import { relayMessage } from './functions/RelayFunction';

export class MessageHandler {
  constructor(private readonly services: Services) {}

  public async handleMessageCreate(message: Message) {
    try {
      if (message.author.bot) return;

      this.services.discord.incrementMessageCount();

      logger.info(
        `message received: channel=${message.channel.id}, author=${message.author.tag}, dm=${message.channel.isDMBased()}`
      );

      if (message.channel.isDMBased()) {
        await this.handleDMMessage(message);
      } else if (message.channel) {
        if (message.guild?.id === env.DISCORD_VOID_GUILD_ID) return;
        await this.handleGuildMessage(message);
      }
    } catch (error) {
      logger.error(`message create handling failed: ${error}`);
    }
  }

  private async handleDMMessage(message: Message) {
    const { notion } = this.services;
    const dmChannel = message.channel as DMChannel;

    // 「メッセージを送信中」を表示
    await dmChannel.sendTyping().catch((error) => {
      logger.error(`DM typing indicator failed: ${error}`);
    });

    void relayMessage(message).catch((error) => {
      logger.error(`DM relay failed: ${error}`);
    });

    if (message.content.startsWith('!')) {
      const commandRecognized = await handleCommand(message, this.services);
      // コマンドが認識されなかった場合は、replyShukinStatusを呼び出す
      if (!commandRecognized) {
        await replyShukinStatus(notion, message);
      }
    } else {
      await replyShukinStatus(notion, message);
    }
  }

  /**
   * ギルドメッセージの処理
   * @param message Discord Message
   */
  private async handleGuildMessage(message: Message) {
    const { notion } = this.services;

    // await relayMessageToDiscordWebhook(message);
    await relayMessage(message);

    // システムメッセージの場合
    if (message.type !== MessageType.Default && message.type !== MessageType.Reply) {
      logger.info(`system message, type: ${message.type}`);
      return;
    }

    // メッセージに「練習連絡」が含まれており、BOT のみがメンションされている場合
    if (
      message.content.includes('練習連絡') &&
      message.mentions.has(message.client.user) &&
      message.mentions.members?.size === 1 // これを追加しないと @everyone や @全員 に反応してしまう
    ) {
      await handleNotifyPracticesCommand(notion, message);
      return;
    }

    await handleCommand(message, this.services);

    if (message.content.startsWith('!bashotoriremind')) {
      const channel = message.channel as TextChannel;
      await remindPracticesToChannel(this.services, channel.id);
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
  }

  /**
   * メッセージが編集された場合の処理
   * @param oldMessage
   * @param newMessage
   */
  public async handleMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
    if (newMessage.guild?.id === env.DISCORD_VOID_GUILD_ID) return;

    if (newMessage.channel.type === ChannelType.GuildText) {
      const fullMsg = newMessage.partial ? await newMessage.fetch() : newMessage;
      await relayMessage(fullMsg);
    }
  }
}
