import { Client, EmbedBuilder, Events, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import { Services } from '../../types/types';
import { logger } from '../../utils/logger';
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

  constructor(_services: { notion: NotionService; sesame: SesameService }) {
    console.log('DiscordService の初期化を開始します。');

    // インスタンスを格納
    this.services = {
      notion: _services.notion,
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
        GatewayIntentBits.GuildWebhooks,
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

    console.log('DiscordService の初期化が終了しました。');
  }

  private initializeEventListeners() {
    this.client
      .on('ready', this.handleReady.bind(this))
      .on(Events.MessageCreate, this.messageHandler.handleMessageCreate.bind(this.messageHandler))
      .on(Events.MessageReactionAdd, (reaction, user) =>
        handleReactionAdd(reaction, user, this.services)
      )
      .on(Events.ThreadMembersUpdate, handleThreadMembersUpdate)
      .on(Events.MessageUpdate, this.messageHandler.handleMessageUpdate.bind(this.messageHandler));
  }

  private handleReady() {
    if (this.client.user) {
      logger.info(`Discord bot が ${this.client.user.tag} として起動しました`);
    } else {
      logger.error('Discord bot を起動できませんでした');
    }
  }

  public async start() {
    console.log('Discord BOT のログインを試みます。');
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

    if (!DISCORD_BOT_TOKEN) {
      console.error('DISCORD_BOT_TOKEN が設定されていません。プログラムを終了します。');
      process.exit(0);
    }

    await this.client.login(DISCORD_BOT_TOKEN);
    console.log('Discord BOT のログインが終了しました。');
  }

  public async sendContentToChannel({ content, channelId }: MessageContent) {
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

  public async sendStringsToChannel(strings: string[], channelId: string) {
    await Promise.all(strings.map((content) => this.sendContentToChannel({ content, channelId })));
  }

  public async sendEmbedsToChannel(embeds: EmbedBuilder[], channelId: string, threadId?: string) {
    await this.sendContentToChannel({ content: embeds, channelId, threadId });
  }
}
