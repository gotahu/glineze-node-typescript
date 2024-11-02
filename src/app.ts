import express from 'express';
import { logger } from './utils/logger';
import { DiscordService } from './services/discord/discordService';
import { NotionService } from './services/notion/notionService';
import { LINENotifyService } from './services/lineNotifyService';
import { remindPractice, remindPracticeToBashotori } from './services/notion/practiceFunctions';
import { GASEvent } from './types/types';
import { config } from './config/config';
import { fetchKondate } from './services/notion/kondate';
import { updateBotProfile, updateChannelTopic } from './services/discord/countdown';
import { isDevelopment } from './utils/environment';

const app = express();
app.use(express.json());

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

async function main() {
  logger.info(`アプリを "${process.env.NODE_ENV}" モードで起動します。`);

  try {
    const services = await initializeServices();
    setupAPIEndpoints(services);
    startServer();
    logger.info('アプリが正常に起動しました。');
  } catch (error) {
    logger.error(`アプリの起動に失敗しました: ${error}` + '\n再起動を試みます。');
    process.exit(1);
  }
}

async function initializeServices() {
  // config の初期化
  await config.initializeConfig();

  // NotionService
  const notionService = NotionService.getInstance();
  await notionService.initialize(); // NotionService の初期化を非同期的に行う

  // LINENotifyPairService
  const pairService = notionService.lineDiscordPairService;

  // LINENotifyService
  const lineNotifyService = new LINENotifyService(pairService);

  // DiscordService
  const discordService = DiscordService.getInstance(notionService, lineNotifyService);
  await discordService.start();

  try {
    const startMessage = isDevelopment ? '開発環境が起動しました' : '本番環境が起動しました';
    logger.info(startMessage, true);
  } catch (error) {
    logger.error(`LINE Notify にメッセージを送信できませんでした: ${error}`);
  }

  return { notionService, lineNotifyService, discordService };
}

function setupAPIEndpoints(services: {
  notionService: NotionService;
  lineNotifyService: LINENotifyService;
  discordService: DiscordService;
}) {
  const { notionService, discordService } = services;

  app.post('/', async (req, res) => {
    try {
      console.log(req);

      if (!req.body || !req.body.events) {
        logger.error('Invalid requiest: missing body or events array');
        res.status(400).send('Invalid request: missing body or events array');
        return;
      }

      const events: GASEvent[] = req.body.events;

      for (const event of events) {
        await handleEvent(event, notionService, discordService);
      }

      res.status(200).end();
    } catch (error) {
      logger.error(`Error in API endpoint: ${error}`);
      res.status(500).end();
    }
  });
}

async function handleEvent(
  event: GASEvent,
  notionService: NotionService,
  discordService: DiscordService
) {
  try {
    switch (event.type) {
      case 'wake':
        logger.info('GAS: 定期起動監視スクリプト受信');
        await updateChannelTopic(discordService);
        updateBotProfile(discordService);
        break;
      case 'noonNotify':
        logger.info('GAS: noonNotify');
        await remindPractice(notionService.practiceService, discordService, 1);
        break;
      case 'AKanRemind':
        logger.info('GAS: AKanRemind');
        await remindPracticeToBashotori(notionService, discordService);
        break;
      case 'message':
        if (event.groupid && event.name && event.message) {
          logger.info('LINE: line message to discord channel');
          const message = `${event.name}：\n${event.message}`;
          await discordService.sendLINEMessageToDiscord(event.groupid, message);
        } else {
          logger.error('LINE: Invalid message event: missing groupid, name, or message');
        }
        break;
      case 'kondate':
        await fetchKondate(notionService, discordService);
        break;
      default:
        logger.error(`Unknown event type: ${event.type}`);
    }
  } catch (error) {
    logger.error(`Error in handling event type ${event.type}: ${error}`);
  }
}

function startServer() {
  const port = config.app.port;
  app.listen(port, () => {
    logger.info(`App is running on port ${port}`);
  });
}

main().catch((error) => {
  logger.error(`Fatal error in main execution: ${error}`);
  process.exit(1);
});
