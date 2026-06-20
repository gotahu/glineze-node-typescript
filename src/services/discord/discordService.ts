import { env } from '../../env';
import { ActivityType, ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import { Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { NotionService } from '../notion/notionService';
import { SesameService } from '../sesame/sesameService';
import { handleReactionAdd } from './discordInteraction';
import { updateBotProfile } from './functions/CountdownFunctions';
import { MessageHandler } from './messageHandler';
import { SesameDiscordService } from './sesameDiscordService';
import { handleThreadMembersUpdate } from './threadMember';

interface MessageContent {
  content: string | EmbedBuilder[];
  channelId: string;
  threadId?: string;
}

interface RawMessageCreateData {
  id?: string;
  guild_id?: string;
  channel_id?: string;
  content?: string;
  author?: {
    id?: string;
    bot?: boolean;
  };
}

const DAILY_STATS_RETENTION_DAYS = 14;
const POPULAR_EMOJI_LIMIT = 100;

// discordService.ts
export class DiscordService {
  public readonly client: Client;

  private readonly messageHandler: MessageHandler;
  public readonly sesameDiscordService: SesameDiscordService;

  private readonly services: Services;

  public stats = {
    dailyMessages: new Map<string, number>(),
    dailyReactions: new Map<string, number>(),
    popularEmojis: new Map<string, number>(),
  };

  constructor(_services: { notion: NotionService; sesame: SesameService }) {
    logger.info('DiscordService の初期化を開始します。');

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

    logger.info('DiscordService の初期化が終了しました。');
  }

  private initializeEventListeners() {
    this.client
      .on(Events.ClientReady, this.handleReady.bind(this))
      .on(Events.Raw, (packet) => {
        if (packet.t !== 'MESSAGE_CREATE') return;

        const data = packet.d as RawMessageCreateData;
        if (data.guild_id) return;

        this.primeDMChannelFromRawMessage(data);

        logger.info(
          `raw DM MESSAGE_CREATE: id=${data.id}, channel=${data.channel_id}, author=${data.author?.id}, authorBot=${data.author?.bot ?? false}, contentLength=${data.content?.length ?? 0}`
        );
      })
      .on(Events.MessageCreate, this.messageHandler.handleMessageCreate.bind(this.messageHandler))
      .on(Events.MessageReactionAdd, (reaction, user) =>
        handleReactionAdd(reaction, user, this.services)
      )
      .on(Events.ThreadMembersUpdate, handleThreadMembersUpdate)
      .on(Events.MessageUpdate, (oldMsg, newMsg) => this.messageHandler.handleMessageUpdate(oldMsg, newMsg))
      .on('error', (error) => {
        logger.error(`Discord Client エラー: ${error.message}`, { error });
        console.error('Discord Client エラーの詳細:', error);
      })
      .on('warn', (warning) => {
        void logger.info(`Discord Client 警告: ${warning}`);
        console.warn('Discord Client 警告:', warning);
      })
      .on('disconnect', () => {
        void logger.info('Discord Client が切断されました');
        console.warn('Discord Client が切断されました');
      })
      .on('reconnecting', () => {
        void logger.info('Discord Client が再接続中です');
        console.log('Discord Client が再接続中です');
      });
  }

  private primeDMChannelFromRawMessage(data: RawMessageCreateData) {
    if (data.guild_id || !data.channel_id || !data.author?.id) return;
    if (this.client.channels.cache.has(data.channel_id)) return;

    const channelManager = this.client.channels as unknown as {
      _add(data: { id: string; type: ChannelType.DM; recipients: NonNullable<RawMessageCreateData['author']>[] }): unknown;
    };

    channelManager._add({
      id: data.channel_id,
      type: ChannelType.DM,
      recipients: [data.author],
    });
  }

  private handleReady() {
    if (this.client.user) {
      logger.info(`Discord bot が ${this.client.user.tag} として起動しました`);
      updateBotProfile(this);
    } else {
      logger.error('Discord bot を起動できませんでした');
    }
  }

  public async start(): Promise<void> {
    const LOGIN_TIMEOUT_MS = 15000; // 30秒のタイムアウト
    logger.info('Discord BOT のログインを試みます。');

    const DISCORD_BOT_TOKEN = env.DISCORD_BOT_TOKEN;

    if (!DISCORD_BOT_TOKEN) {
      const errorMsg = 'DISCORD_BOT_TOKEN が設定されていません。プログラムを終了します。';
      logger.error(errorMsg);
      process.exit(0);
    }

    // トークンの形式チェック（Discord トークンは通常 "数字.文字列.文字列" の形式）
    const tokenParts = DISCORD_BOT_TOKEN.split('.');
    if (tokenParts.length !== 3) {
      const errorMsg = `DISCORD_BOT_TOKEN の形式が正しくありません。トークンは3つの部分に分割される必要がありますが、${tokenParts.length}つの部分しかありません。`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    logger.info(`Discord ログイン開始: トークン長 ${DISCORD_BOT_TOKEN.length}文字`);

    try {
      // ログイン前の状態を確認
      logger.info(
        `ログイン前の状態: ready=${this.client.isReady()}, ws.status=${this.client.ws.status}`
      );

      // タイムアウト付きでログインを試行
      const loginPromise = this.client.login(DISCORD_BOT_TOKEN);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Discord ログインがタイムアウトしました（${LOGIN_TIMEOUT_MS}ms）。ネットワーク接続やDiscord APIの状態を確認してください。`
            )
          );
        }, LOGIN_TIMEOUT_MS);
      });

      await Promise.race([loginPromise, timeoutPromise]);

      // ログイン後の状態を確認
      logger.info(
        `ログイン後の状態: ready=${this.client.isReady()}, ws.status=${this.client.ws.status}`
      );

      if (this.client.user) {
        logger.info(
          `Discord BOT のログインが成功しました: ${this.client.user.tag} (ID: ${this.client.user.id})`
        );
      } else {
        const warningMsg = 'ログインは成功しましたが、client.user が設定されていません。';
        void logger.info(warningMsg);
      }
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError',
        clientReady: this.client.isReady(),
        wsStatus: this.client.ws.status,
        tokenLength: DISCORD_BOT_TOKEN.length,
        tokenPrefix: DISCORD_BOT_TOKEN.substring(0, 10) + '...',
      };

      const errorMsg = `Discord BOT のログインに失敗しました: ${errorDetails.message}`;
      console.error(errorMsg);
      console.error('エラー詳細:', JSON.stringify(errorDetails, null, 2));
      logger.error(errorMsg, { error: errorDetails });

      // より詳細なエラーメッセージを提供
      if (error instanceof Error) {
        if (error.message.includes('Invalid token')) {
          console.error(
            '原因: トークンが無効です。Discord Developer Portalでトークンを再生成してください。'
          );
        } else if (error.message.includes('タイムアウト')) {
          console.error(
            '原因: ネットワーク接続の問題、またはDiscord APIへの接続が遅延しています。'
          );
          console.error(
            '対処法: ネットワーク接続を確認し、ファイアウォール設定を確認してください。'
          );
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          console.error('原因: Discord APIサーバーに接続できません。');
          console.error('対処法: ネットワーク接続とDNS設定を確認してください。');
        }
      }

      throw error;
    }
  }

  public async sendContentToChannel({ content, channelId }: MessageContent) {
    try {
      let channel = this.client.channels.cache.get(channelId);

      if (!channel) {
        channel = (await this.client.channels.fetch(channelId)) ?? undefined;
      }

      if (!channel?.isSendable()) {
        throw new Error('Channel is not a TextChannel or is not sendable');
      }

      if (Array.isArray(content) && content[0] instanceof EmbedBuilder) {
        await channel.send({ embeds: content });
      } else if (typeof content === 'string') {
        await channel.send(content);
      }

      logger.info(`Content sent to ${channel.isThread() ? 'thread' : 'channel'}`);
    } catch (error) {
      console.error(`Error sending content: ${error}`);
      throw error;
    }
  }

  public async sendStringsToChannel(strings: string[], channelId: string) {
    await Promise.all(strings.map((content) => this.sendContentToChannel({ content, channelId })));
  }

  public async sendEmbedsToChannel(embeds: EmbedBuilder[], channelId: string, threadId?: string) {
    await this.sendContentToChannel({ content: embeds, channelId, threadId });
  }

  public incrementMessageCount() {
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    const current = this.stats.dailyMessages.get(today) || 0;
    this.stats.dailyMessages.set(today, current + 1);
    this.pruneDailyStats(this.stats.dailyMessages);
  }

  public incrementReactionCount() {
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    const current = this.stats.dailyReactions.get(today) || 0;
    this.stats.dailyReactions.set(today, current + 1);
    this.pruneDailyStats(this.stats.dailyReactions);
  }

  public recordEmojiUsage(emojiName: string) {
    const current = this.stats.popularEmojis.get(emojiName) || 0;
    this.stats.popularEmojis.set(emojiName, current + 1);

    if (this.stats.popularEmojis.size > POPULAR_EMOJI_LIMIT) {
      const leastUsed = [...this.stats.popularEmojis.entries()].sort(
        (left, right) => left[1] - right[1]
      )[0];
      if (leastUsed) {
        this.stats.popularEmojis.delete(leastUsed[0]);
      }
    }
  }

  private pruneDailyStats(stats: Map<string, number>) {
    if (stats.size <= DAILY_STATS_RETENTION_DAYS) return;

    const oldestKeys = [...stats.keys()]
      .sort()
      .slice(0, stats.size - DAILY_STATS_RETENTION_DAYS);
    for (const key of oldestKeys) {
      stats.delete(key);
    }
  }
}
