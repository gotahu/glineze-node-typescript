import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Message,
  MessageType,
} from 'discord.js';
import { LINENotifyService } from '../lineNotifyService';
import { NotionService } from '../notionService';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { CONSTANTS } from '../../config/constants';
import axios from 'axios';

export class MessageHandler {
  constructor(
    private notion: NotionService,
    private lineNotify: LINENotifyService
  ) {}

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
    const authorId = message.author.id;
    const authorName = message.author.displayName;

    // 「メッセージを送信中」を表示
    message.channel.sendTyping();

    await this.lineNotify.postTextToLINENotify(
      config.lineNotify.voidToken,
      `${authorName}\n${messageContent}`
    );

    // Notion から集金状況を取得
    try {
      const glanzeMember = await this.notion.retrieveGlanzeMember(authorId);

      // 団員名簿から情報を取得できなかった場合
      if (!glanzeMember) {
        message.reply(
          '### エラーが発生しました。\n- エラー内容：団員名簿からあなたの情報を見つけることができませんでした。準備が整っていない可能性があるので、管理者に問い合わせてください。'
        );
        return;
      }

      const reply = await this.notion.retrieveShukinStatus(glanzeMember);

      if (reply.status === 'error') {
        message.reply('### エラーが発生しました。\n- エラー内容：' + reply.message);
      } else {
        message.reply(reply.message);
      }
    } catch (error) {
      logger.error('Error in retrieveShukinStatus: ' + error);
      message.reply('### エラーが発生しました。\n- エラー内容：' + error);
    }
  }

  private async handleGuildMessage(message: Message): Promise<void> {
    // テストサーバーでのメッセージの場合
    if (message.guild && message.guild.id === '1258189444888924324') {
      //
    }

    // システムメッセージの場合
    if (message.type !== MessageType.Default && message.type !== MessageType.Reply) {
      logger.info(`system message, type: ${message.type}`);
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
    const channelId =
      message.channel.isThread() && message.channel.parent
        ? message.channel.parent.id
        : message.channelId;

    // LINE に送信するかどうかを判定
    // ペアを取得
    const pairs = await this.notion.getLINEDiscordPairs();
    const pair = pairs.find((v) => v.discord_channel_id == channelId);

    // LINE に送信する場合、セーフガードとして送信用リアクションを追加する
    if (pair) {
      message.react('✅');
      logger.info('reaction added');

      const reactionTimeSeconds = this.notion.getConfig('reaction_time_seconds');
      const timeoutSeconds = reactionTimeSeconds
        ? parseInt(reactionTimeSeconds)
        : CONSTANTS.DEFAULT_REACTION_TIME_SECONDS;

      setTimeout(() => {
        message.reactions.cache.get('✅')?.remove();
        logger.info('reaction removed after timeout');
      }, timeoutSeconds * 1000);
    }

    if (!message.member || !message.channel) {
      logger.error('error: message member or channel cannot be detected');
      return;
    }

    this.lineNotify.postTextToLINENotifyFromDiscordMessage(this.notion, message, true);
  }
}
