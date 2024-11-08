import { EmbedBuilder, Client, GatewayIntentBits, Partials, Events, TextChannel } from 'discord.js';
import { schedule } from 'node-cron';
import { logger } from '../../utils/logger';
import { LINENotifyService } from '../lineNotifyService';
import { NotionService } from '../notion/notionService';
import { SesameService } from '../sesame/sesameService';
import { handleReactionAdd } from './discordInteraction';
import { MessageHandler } from './messageHandler';
import { SesameDiscordService } from './sesameDiscord';
import { handleThreadMembersUpdate } from './threadMember';
import { config } from '../../config/config';

// types.ts
interface DiscordServiceDependencies {
  notionService: NotionService;
  lineNotifyService: LINENotifyService;
  sesameService?: SesameService;
}

interface MessageContent {
  content: string | EmbedBuilder[];
  channelId: string;
  threadId?: string;
}

// discordService.ts
export class DiscordService {
  private static instance: DiscordService;
  public readonly client: Client;

  private readonly dependencies: DiscordServiceDependencies;
  private readonly messageHandler: MessageHandler;
  private readonly sesameDiscordService: SesameDiscordService;
  private sesameSchedulerStarted = false;

  private static readonly CLIENT_OPTIONS = {
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

  private constructor({
    notionService,
    lineNotifyService,
    sesameService = new SesameService(),
  }: DiscordServiceDependencies) {
    this.dependencies = { notionService, lineNotifyService, sesameService };
    this.sesameDiscordService = new SesameDiscordService(sesameService, this);
    this.messageHandler = new MessageHandler(this);
    this.client = new Client(DiscordService.CLIENT_OPTIONS);

    this.initializeEventListeners();
  }

  public static getInstance(dependencies?: DiscordServiceDependencies): DiscordService {
    if (!DiscordService.instance) {
      if (!dependencies?.notionService || !dependencies?.lineNotifyService) {
        throw new Error('NotionService と LINENotifyService は初期化時に必要です');
      }
      DiscordService.instance = new DiscordService(dependencies);
    }
    return DiscordService.instance;
  }

  private initializeEventListeners(): void {
    this.client
      .on('ready', this.handleReady.bind(this))
      .on(Events.MessageCreate, this.messageHandler.handleMessageCreate.bind(this.messageHandler))
      .on(Events.MessageReactionAdd, (reaction, user) =>
        handleReactionAdd(
          reaction,
          user,
          this.dependencies.notionService,
          this.dependencies.lineNotifyService
        )
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
    await this.startSesameScheduler();
  }

  private async startSesameScheduler(): Promise<void> {
    if (this.sesameSchedulerStarted) {
      logger.info('Sesame status scheduler already started');
      return;
    }

    this.sesameSchedulerStarted = true;
    logger.info('Starting Sesame status scheduler');

    schedule('*/5 * * * *', async () => {
      try {
        logger.info('Updating Sesame status (on schedule)');
        const deviceStatus = await this.dependencies.sesameService?.getSesameDeviceStatus();
        logger.debug(`Device status:, ${deviceStatus}`);
        await this.sesameDiscordService.updateSesameStatusAllVoiceChannels();
      } catch (error) {
        logger.error(`Error updating Sesame status (on schedule):, ${error}`);
      }
    });
  }

  public async sendContentToChannel({
    content,
    channelId,
    threadId,
  }: MessageContent): Promise<void> {
    try {
      const channel = this.client.channels.cache.get(channelId) as TextChannel;

      if (!channel?.isTextBased()) {
        throw new Error('Channel is not a TextChannel');
      }

      const target = threadId ? await channel.threads.fetch(threadId) : channel;

      if (!target) {
        throw new Error(`${threadId ? 'Thread' : 'Channel'} not found`);
      }

      if (Array.isArray(content) && content[0] instanceof EmbedBuilder) {
        await target.send({ embeds: content });
      } else if (typeof content === 'string') {
        await target.send(content);
      }

      logger.info(`Content sent to ${threadId ? 'thread' : 'channel'}`);
    } catch (error) {
      logger.error(`Error sending content:, ${error}`);
      throw error;
    }
  }

  public async sendStringsToChannel(
    strings: string[],
    channelId: string,
    threadId?: string
  ): Promise<void> {
    await Promise.all(
      strings.map((content) => this.sendContentToChannel({ content, channelId, threadId }))
    );
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

  private async findMatchingDiscordChannel(lineGroupId: string): Promise<string | undefined> {
    const pairs =
      await this.dependencies.notionService.lineDiscordPairService.getLINEDiscordPairs();

    return pairs
      .filter((pair) => pair.lineGroupId === lineGroupId)
      .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0))[0]?.discordChannelId;
  }

  // Getters
  public getLINENotifyService = () => this.dependencies.lineNotifyService;
  public getNotionService = () => this.dependencies.notionService;
  public getSesameDiscordService = () => this.sesameDiscordService;
  public getSesameService = () => this.dependencies.sesameService;
}
