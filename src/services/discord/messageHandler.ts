import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  DMChannel,
  Message,
  MessageType,
} from 'discord.js';
import { LINENotifyService } from '../lineNotifyService';
import { NotionService } from '../notion/notionService';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import axios from 'axios';
import { handleBreakoutRoomCommand } from './breakoutRoom';
import { handleLineDiscordCommand } from './commands/lineDiscord';
import { DiscordService } from './discordService';
import { SesameService } from '../sesame/sesameService';
import { addSendButtonReaction } from './messageFunction';
import { reloadConfig } from './commands/reload';
import { replyShukinStatus } from './commands/shukin';
import { handleDeleteChannelCommand } from './commands/deletechannel';
import { handleSesameStatusCommand } from './commands/sesame';
import { handleNotifyPracticesCommand } from './commands/practice';

export class MessageHandler {
  private notionService: NotionService;
  private lineNotify: LINENotifyService;
  private sesameService: SesameService;

  constructor(discordService: DiscordService) {
    this.notionService = NotionService.getInstance();
    this.lineNotify = discordService.getLINENotifyService();
    this.sesameService = discordService.getSesameService();
  }

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
    const messageContent = message.content;
    const authorName = message.author.displayName;
    const dmChannel = message.channel as DMChannel;

    // 「メッセージを送信中」を表示
    dmChannel.sendTyping();

    await this.lineNotify.postTextToLINENotify(
      config.lineNotify.voidToken,
      `${authorName}\n${messageContent}`
    );

    if (messageContent === 'リロード') {
      await reloadConfig(message);
      return;
    } else {
      await replyShukinStatus(this.notionService, message);
      return;
    }
  }

  private async handleGuildMessage(message: Message): Promise<void> {
    this.lineNotify.postTextToLINENotifyFromDiscordMessage(
      this.notionService.lineDiscordPairService,
      message,
      true
    );

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
      await handleNotifyPracticesCommand(this.notionService, message);
      return;
    }

    if (message.content.startsWith('!deletechannel')) {
      await handleDeleteChannelCommand(message);
      return;
    }

    if (message.content === 'KEY') {
      await handleSesameStatusCommand(this.sesameService, message);
      return;
    }

    if (message.content.startsWith('!br')) {
      await handleBreakoutRoomCommand(message);
      return;
    }

    if (message.content.startsWith('!line-discord')) {
      await handleLineDiscordCommand(message, this.notionService.lineDiscordPairService);
      return;
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

    // スレッドチャンネルで全員にメンションがある場合
    if (
      message.channel.isThread() &&
      message.channel.parent &&
      message.channel.parent.name.includes('スレッド') &&
      message.mentions.roles.some((role) => role.name.includes('全員'))
    ) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('delete').setLabel('消去する').setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ignore')
          .setLabel('無視する')
          .setStyle(ButtonStyle.Secondary)
      );

      message.reply({
        content:
          'スレッドチャンネルで全員にメンションを行いました。\nBOTはこのイベントを取り消すことはできません。\n\nもしこれが意図した動作ではない場合、スレッドの作成者・ボタンを押すあなた・BOTの3者を残し、他の人を一旦スレッドから削除します。\nその後、再度意図する人をメンションし直してください。',
        components: [row],
      });
      return;
    }

    // それ以外の場合（通常のチャンネルやスレッドでのメッセージ）

    // LINE に送信するかどうかを判定
    // ペアを取得
    const pair =
      await this.notionService.lineDiscordPairService.getLINEDiscordPairFromMessage(message);

    // LINE に送信する場合、セーフガードとして送信用リアクションを追加する
    if (pair) {
      addSendButtonReaction(message);
    }
  }

  /**
   * メッセージが編集された場合の処理
   * @param oldMessage
   * @param newMessage
   */
  public async handleMessageUpdate(oldMessage: Message, newMessage: Message): Promise<void> {
    if (newMessage.channel.type === ChannelType.GuildText) {
      const notion = NotionService.getInstance();
      const lineNotify = LINENotifyService.getInstance();

      await lineNotify.postTextToLINENotifyFromDiscordMessage(
        notion.lineDiscordPairService,
        newMessage,
        true
      );

      try {
        // ペアを取得
        const pair = await notion.lineDiscordPairService.getLINEDiscordPairFromMessage(newMessage);

        // ペアが存在すれば
        if (pair) {
          logger.info('ペアが存在しているメッセージが編集されました');
          // LINE にもう一度送信できるようにする
          addSendButtonReaction(newMessage);
        }
      } catch (error) {
        logger.error('Error in handleMessageUpdate: ' + error);
      }
    }
  }
}
