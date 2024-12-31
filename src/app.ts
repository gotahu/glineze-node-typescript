import { config } from './config/config';
import { CronService } from './services/cron/CronService';
import { DiscordService } from './services/discord/discordService';
import { LINENotifyService } from './services/lineNotifyService';
import { NotionService } from './services/notion/notionService';
import { SesameService } from './services/sesame/sesameService';
import { WebServerService } from './services/webapi/webServerService';
import { Services } from './types/types';
import { logger } from './utils/logger';

// メイン処理
const main = async () => {
  console.log('glineze アプリケーションを起動します');

  // サービスの初期化
  await initializeServices();
};

// 主要なサービスを束ねる変数
let services: Services;

const initializeServices = async () => {
  try {
    // config の初期化
    await config.initializeConfig();
    // NotionService
    const notionService = new NotionService();

    // LINENotifyService
    const lineNotifyService = new LINENotifyService(notionService.lineDiscordPairService);

    const sesameService = new SesameService();

    // DiscordService
    const discordService = new DiscordService({
      notion: notionService,
      lineNotify: lineNotifyService,
      sesame: sesameService,
    });

    // DiscordService（Client を起動する）
    await discordService.start();

    // サービスを束ねる
    services = {
      notion: notionService,
      lineNotify: lineNotifyService,
      discord: discordService,
      sesame: sesameService,
    };

    // CronService
    const cronService = new CronService(services);
    cronService.start();

    // WebService
    const WebService = new WebServerService(services);

    try {
      logger.info(
        process.env.NODE_ENV === 'development'
          ? `開発環境が起動しました`
          : `本番環境（dockerコンテナ）が起動しました`,
        {
          debug: true,
        }
      );
    } catch (error) {
      // LINE Notify にメッセージを送信できなかった場合
      console.log(`LINE Notify にメッセージを送信できませんでした: ${error}`);
    }
  } catch (error) {
    logger.error(`アプリの起動に失敗しました: ${error}`);
    process.exit(1);
  }
};

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

main().then(() => {
  console.log('glineze アプリケーションが起動しました');
});
