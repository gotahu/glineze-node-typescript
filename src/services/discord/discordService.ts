import { Client, EmbedBuilder, Events, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import { config } from '../../config';
import { Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { LINENotifyService } from '../lineNotifyService';
import { NotionService } from '../notion/notionService';
import { SesameService } from '../sesame/sesameService';
import { handleReactionAdd } from './discordInteraction';
import { MessageHandler } from './messageHandler';
import { SesameDiscordService } from './sesameDiscordService';
import { handleThreadMembersUpdate } from './threadMember';

interface MessageContent {
  content: string | EmbedBuilder[];
  channelId: string;
  threadId?: string;
}

// discordService.ts
export class DiscordService {
  public readonly client: Client;

  private readonly messageHandler: MessageHandler;
  public readonly sesameDiscordService: SesameDiscordService;

  private readonly services: Services;

  constructor(_services: {
    notion: NotionService;
    lineNotify: LINENotifyService;
    sesame: SesameService;
  }) {
    // インスタンスを格納
    this.services = {
      notion: _services.notion,
      lineNotify: _services.lineNotify,
      discord: this,
      sesame: _services.sesame,
    };

    // SesameDiscordService を初期化
    this.sesameDiscordService = new SesameDiscordService(this.services);

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
    // Discord Client を初期化
    this.client = new Client(options);

    // MessageHandler を初期化
    this.messageHandler = new MessageHandler(this.services);

    // イベントリスナーを初期化
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    this.client
      .on('ready', this.handleReady.bind(this))
      .on(Events.MessageCreate, this.messageHandler.handleMessageCreate.bind(this.messageHandler))
      .on(Events.MessageReactionAdd, (reaction, user) =>
        handleReactionAdd(reaction, user, this.services)
      )
      .on(Events.ThreadMembersUpdate, handleThreadMembersUpdate)
      .on(Events.MessageUpdate, this.messageHandler.handleMessageUpdate.bind(this.messageHandler));
  }

  private handleReady(): void {
    if (this.client.user) {
      logger.info(`Discord bot が ${this.client.user.tag} として起動しました`);
    } else {
      logger.error('Discord bot を起動できませんでした');
    }
  }

  public async start(): Promise<void> {
    await this.client.login(config.discord.botToken);
  }

  public async sendContentToChannel({ content, channelId }: MessageContent): Promise<void> {
    try {
      const channel = this.client.channels.cache.get(channelId) as TextChannel;

      if (!channel?.isTextBased()) {
        throw new Error('Channel is not a TextChannel');
      }

      if (Array.isArray(content) && content[0] instanceof EmbedBuilder) {
        await channel.send({ embeds: content });
      } else if (typeof content === 'string') {
        await channel.send(content);
      }

      logger.info(`Content sent to ${channel.isThread ? 'thread' : 'channel'}`);
    } catch (error) {
      logger.error(`Error sending content:, ${error}`);
      throw error;
    }
  }

  public async sendStringsToChannel(strings: string[], channelId: string): Promise<void> {
    await Promise.all(strings.map((content) => this.sendContentToChannel({ content, channelId })));
  }

  public async sendEmbedsToChannel(
    embeds: EmbedBuilder[],
    channelId: string,
    threadId?: string
  ): Promise<void> {
    await this.sendContentToChannel({ content: embeds, channelId, threadId });
  }

  public async sendLINEMessageToDiscord(lineGroupId: string, message: string): Promise<void> {
    const DEFAULT_CHANNEL_ID = '1037911984399724634';

    if (lineGroupId === 'undefined') {
      await this.sendStringsToChannel([message], DEFAULT_CHANNEL_ID);
      return;
    }

    const discordChannelId = await this.findMatchingDiscordChannel(lineGroupId);

    if (!discordChannelId) {
      logger.error(
        `LINE BOTがメッセージを受信しましたが、対応するDiscordチャンネルが見つかりませんでした`
      );
      return;
    }

    await this.sendStringsToChannel([message], discordChannelId);
  }

  public async findMatchingDiscordChannel(lineGroupId: string): Promise<string | undefined> {
    const { notion } = this.services;
    const pairs = await notion.lineDiscordPairService.getLINEDiscordPairs();

    return pairs
      .filter((pair) => pair.lineGroupId === lineGroupId)
      .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0))[0]?.discordChannelId;
  }
}
