import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  DMChannel,
  Message,
  MessageReaction,
  MessageType,
  ThreadChannel,
  User,
} from 'discord.js';
import { LINENotifyService } from '../lineNotifyService';
import { NotionService } from '../notion/notionService';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { CONSTANTS } from '../../config/constants';
import axios from 'axios';
import { handleBreakoutRoomCommand } from './breakoutRoom';
import { handleLineDiscordCommand } from './commands/lineDiscord';
import { StatusMessage } from '../../types/types';
import { DiscordService } from './discordService';
import { SesameService } from '../sesame/sesameService';
import { format } from 'date-fns';

export class MessageHandler {
  private notion: NotionService;
  private lineNotify: LINENotifyService;
  private discordService: DiscordService;
  private sesameService: SesameService;

  constructor(discordService: DiscordService) {
    this.notion = discordService.getNotionService();
    this.lineNotify = discordService.getLINENotifyService();
    this.sesameService = discordService.getSesameService();
    this.discordService = discordService;
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
    const authorId = message.author.id;
    const authorName = message.author.displayName;
    const dmChannel = message.channel as DMChannel;

    // 「メッセージを送信中」を表示
    dmChannel.sendTyping();

    await this.lineNotify.postTextToLINENotify(
      config.lineNotify.voidToken,
      `${authorName}\n${messageContent}`
    );

    if (messageContent === 'リロード') {
      try {
        await config.initializeConfig();
        message.reply('リロードしました。');
        return;
      } catch (error) {
        message.reply('リロードに失敗しました。管理者に連絡してください。');
        logger.error(
          `${authorName} が config をリロードしようとしましたが、エラーが発生しました。`
        );
        return;
      }
    }

    // Notion から集金状況を取得
    try {
      const glanzeMember = await this.notion.memberService.retrieveGlanzeMember(authorId);

      // 団員名簿から情報を取得できなかった場合
      if (!glanzeMember) {
        message.reply(
          '### エラーが発生しました。\n- エラー内容：団員名簿からあなたの情報を見つけることができませんでした。準備が整っていない可能性があるので、管理者に問い合わせてください。'
        );
        return;
      }

      const reply = await this.notion.shukinService.retrieveShukinStatus(glanzeMember);

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
    }

    this.lineNotify.postTextToLINENotifyFromDiscordMessage(
      this.notion.lineDiscordPairService,
      message,
      true
    );

    // システムメッセージの場合
    if (message.type !== MessageType.Default && message.type !== MessageType.Reply) {
      logger.info(`system message, type: ${message.type}`);
      return;
    }

    if (message.content.startsWith('!deletechannel')) {
      try {
        const args = message.content.split(' ');

        if (args.length < 2) {
          message.reply('チャンネルIDを指定してください');
          return;
        }

        const channelId = args[1];
        const channel = message.guild?.channels.cache.get(channelId);
        if (!channel) {
          message.reply('チャンネルが見つかりませんでした');
          return;
        }

        await channel.delete();
        message.reply('チャンネルを削除しました');
        logger.info(`Channel ${channelId} deleted`);
      } catch (error) {
        logger.error('Error deleting channel: ' + error);
      }
    }

    if (message.content === 'KEY') {
      try {
        const status = await this.sesameService.getSesameDeviceStatus();
        const dateStr = format(new Date(status.timestamp), 'yyyy-MM-dd HH:mm:ss');
        message.reply(`施錠状態: ${StatusMessage[status.lockStatus]}, タイムスタンプ：${dateStr}`);
      } catch (error) {
        logger.error('Error fetching Sesame lock status: ' + error);
      }
    }

    if (message.content.startsWith('!br')) {
      await handleBreakoutRoomCommand(message);
      return;
    }

    if (message.content.startsWith('!line-discord')) {
      await handleLineDiscordCommand(message, this.notion.lineDiscordPairService);
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
    const pairs = await this.notion.lineDiscordPairService.getLINEDiscordPairs();
    let pair = pairs.find((v) => v.discordChannelId == message.channel.id);

    // スレッドの場合、親チャンネルにペアが設定されていないか確認する
    if (!pair && message.channel.isThread()) {
      const channel = message.channel as ThreadChannel;
      // 親チャンネルのIDが一致し、子スレッドを含む設定になっているペアを取得
      pair = pairs.find((v) => v.discordChannelId == channel.parentId && v.includeThreads);
    }

    // LINE に送信する場合、セーフガードとして送信用リアクションを追加する
    if (pair) {
      message.react('✅');
      logger.info('reaction added');

      const filter = (reaction: MessageReaction, user: User) => {
        return reaction.emoji.name === '✅' && user.id === message.author.id;
      };

      const reactionTimeSeconds = config.getConfig('reaction_time_seconds');
      const timeoutSeconds = reactionTimeSeconds
        ? parseInt(reactionTimeSeconds)
        : CONSTANTS.DEFAULT_REACTION_TIME_SECONDS;

      const collector = message.createReactionCollector({ filter, time: timeoutSeconds * 1000 });

      collector.on('collect', async () => {
        // チェックのリアクションを削除する
        message.reactions.cache.get('✅')?.remove();

        // 通知する
        this.lineNotify.postTextToLINENotifyFromDiscordMessage(
          this.notion.lineDiscordPairService,
          message,
          false
        );

        // コレクターを停止する
        collector.stop();
      });

      collector.on('end', async (collected) => {
        // チェックのリアクションを削除する
        message.reactions.cache.get('✅')?.remove();
      });
    }
  }
}
