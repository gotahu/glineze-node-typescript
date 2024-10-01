import {
  Client,
  Collection,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  TextChannel,
} from 'discord.js';
import { logger } from '../../utils/logger';
import { handleInteractionCreate, handleReactionAdd } from './discordInteraction';
import { config } from '../../config/config';
import { NotionService } from '../notion/notionService';
import { LINENotifyService } from '../lineNotifyService';
import { MessageHandler } from './messageHandler';
import handleThreadMembersUpdate from './threadMember';

export class DiscordService {
  public client: Client;
  private static instance: DiscordService;

  private notionService: NotionService;
  private lineNotifyService: LINENotifyService;
  private messageHandler: MessageHandler;

  constructor(notionService: NotionService, lineNotifyService: LINENotifyService) {
    this.notionService = notionService;
    this.lineNotifyService = lineNotifyService;

    DiscordService.instance = this;

    this.messageHandler = new MessageHandler(notionService, lineNotifyService);

    const options = {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.ThreadMember,
        Partials.GuildMember,
      ],
    };

    this.client = new Client(options);

    this.client.on('ready', () => {
      if (this.client.user) {
        logger.info('Discord bot is online as ' + this.client.user.tag);
      } else {
        console.log('Discord bot を起動できませんでした');
      }
    });

    this.client.on(Events.MessageCreate, (message) => {
      this.messageHandler.handleMessageCreate(message);
    });
    this.client.on(Events.MessageReactionAdd, (reaction, user) =>
      handleReactionAdd(reaction, user, this.notionService, this.lineNotifyService)
    );
    this.client.on(Events.InteractionCreate, handleInteractionCreate);

    this.client.on(Events.ThreadMembersUpdate, handleThreadMembersUpdate);
  }

  public start(): void {
    this.client.login(config.discord.botToken);
  }

  public static getInstance(): DiscordService {
    if (!DiscordService.instance) {
      console.error('DiscordService は初期化されていません');
    }
    return DiscordService.instance;
  }

  /**
   * チャンネルまたはスレッドに文字列および embed を送信する
   * @param client
   * @param content
   * @param channelId
   * @param threadId 任意
   */
  private async sendContentToChannel(
    client: Client,
    content: string | EmbedBuilder[],
    channelId: string,
    threadId?: string
  ) {
    try {
      const channel = client.channels.cache.get(channelId) as TextChannel;

      if (!channel.isTextBased) {
        logger.error('Channel is not a TextChannel');
        return;
      }

      const target = threadId ? await channel.threads.fetch(threadId) : channel;

      if (target) {
        if (Array.isArray(content) && content[0] instanceof EmbedBuilder) {
          await target.send({ embeds: content });
        } else if (typeof content === 'string') {
          await target.send(content);
        }
        logger.info(`Content sent to ${threadId ? 'thread' : 'channel'}`);
      } else {
        logger.error(`${threadId ? 'Thread' : 'Channel'} not found`);
      }
    } catch (error) {
      logger.error('Error sending content: ' + error);
    }
  }

  /**
   * チャンネルやスレッドに文字列を送信する
   * @param client
   * @param strings
   * @param channelId
   * @param threadId 任意
   */
  public async sendStringsToChannel(strings: string[], channelId: string, threadId?: string) {
    for (const str of strings) {
      await this.sendContentToChannel(this.client, str, channelId, threadId);
    }
  }

  /**
   * チャンネルまたはスレッドに embed を送信する
   * @param client
   * @param embeds
   * @param channelId
   * @param threadId 任意
   */
  public async sendEmbedsToChannel(embeds: EmbedBuilder[], channelId: string, threadId?: string) {
    await this.sendContentToChannel(this.client, embeds, channelId, threadId);
  }

  /**
   * LINE からのメッセージを Discord に送信する
   * @param {string} lineGroupId
   * @param {string} message
   * @returns void
   */
  public async sendLINEMessageToDiscord(lineGroupId: string, message: string) {
    // lineGroupId が undefined の場合、既定のチャンネルIDを使用
    if (lineGroupId === 'undefined') {
      await this.sendStringsToChannel([message], '1037911984399724634');
      return;
    }

    const lineDiscordPairs = await this.notionService.getLINEDiscordPairs();

    // 対応するDiscordチャンネルIDを見つける
    let discordChannelId = '';
    for (const pair of lineDiscordPairs) {
      if (pair.line_group_id === lineGroupId) {
        // priorityがtrueならそれを優先
        if (pair.priority) {
          discordChannelId = pair.discord_channel_id;
          break;
        }
        // priorityがtrueでなければ、最初に見つかったものを使用
        if (!discordChannelId) {
          discordChannelId = pair.discord_channel_id;
        }
      }
    }

    if (!discordChannelId) {
      logger.error(
        `error: LINE BOTがメッセージを受信しましたが、対応するDiscordチャンネルが見つかりませんでした\nlineGroupId: ${lineGroupId}\nmessage: ${message}`
      );
      return;
    }

    // Discord に送信
    await this.sendStringsToChannel([message], discordChannelId);
  }
}
