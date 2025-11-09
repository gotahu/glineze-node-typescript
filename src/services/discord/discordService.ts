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
      .on(Events.MessageUpdate, this.messageHandler.handleMessageUpdate.bind(this.messageHandler))
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

  private handleReady() {
    if (this.client.user) {
      logger.info(`Discord bot が ${this.client.user.tag} として起動しました`);
    } else {
      logger.error('Discord bot を起動できませんでした');
    }
  }

  public async start() {
    const LOGIN_TIMEOUT_MS = 15000; // 30秒のタイムアウト
    console.log('Discord BOT のログインを試みます。');

    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

    if (!DISCORD_BOT_TOKEN) {
      const errorMsg = 'DISCORD_BOT_TOKEN が設定されていません。プログラムを終了します。';
      console.error(errorMsg);
      logger.error(errorMsg);
      process.exit(0);
    }

    // トークンの形式チェック（Discord トークンは通常 "数字.文字列.文字列" の形式）
    const tokenParts = DISCORD_BOT_TOKEN.split('.');
    if (tokenParts.length !== 3) {
      const errorMsg = `DISCORD_BOT_TOKEN の形式が正しくありません。トークンは3つの部分に分割される必要がありますが、${tokenParts.length}つの部分しかありません。`;
      console.error(errorMsg);
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`トークンの形式チェック: OK (長さ: ${DISCORD_BOT_TOKEN.length}文字)`);
    logger.info(`Discord ログイン開始: トークン長 ${DISCORD_BOT_TOKEN.length}文字`);

    try {
      // ログイン前の状態を確認
      console.log(
        `ログイン前の状態: ready=${this.client.isReady()}, ws.status=${this.client.ws.status}`
      );
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
      console.log(
        `ログイン後の状態: ready=${this.client.isReady()}, ws.status=${this.client.ws.status}`
      );
      logger.info(
        `ログイン後の状態: ready=${this.client.isReady()}, ws.status=${this.client.ws.status}`
      );

      if (this.client.user) {
        console.log(
          `Discord BOT のログインが成功しました: ${this.client.user.tag} (ID: ${this.client.user.id})`
        );
        logger.info(
          `Discord BOT のログインが成功しました: ${this.client.user.tag} (ID: ${this.client.user.id})`
        );
      } else {
        const warningMsg = 'ログインは成功しましたが、client.user が設定されていません。';
        console.warn(warningMsg);
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
