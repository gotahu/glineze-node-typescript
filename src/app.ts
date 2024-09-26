import express from 'express';
import { logger } from './utils/logger';
import { DiscordService } from './services/discord/discordService';
import { NotionService } from './services/notion/notionService';
import { LINENotifyService } from './services/lineNotifyService';
import { announcePractice, remindPracticeToBashotori } from './services/notion/practice';
import { GASEvent } from './types/types';
import { config } from './config/config';
import { fetchKondate } from './services/notion/kondate';
import { updateBotProfile, updateChannelTopic } from './services/discord/countdown';

const app = express();
app.use(express.json());

async function main() {
  logger.info(`Starting application in ${process.env.NODE_ENV} mode`);

  try {
    const services = await initializeServices();
    setupAPIEndpoints(services);
    startServer();
    logger.info('App started successfully');
  } catch (error) {
    logger.error(`Failed to start app: ${error}`);
    process.exit(1);
  }
}

async function initializeServices() {
  const notionService = new NotionService();
  const lineNotifyService = new LINENotifyService();
  const discordService = new DiscordService(notionService, lineNotifyService);

  discordService.start();

  const token = config.lineNotify.voidToken;
  lineNotifyService.postTextToLINENotify(token, 'Discord アプリが起動しました');

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
        logger.error('No post data or events array');
        res.status(500).end();
        return;
      }

      const events: GASEvent[] = req.body.events;

      for (const event of events) {
        await handleEvent(event, notionService, discordService);
      }

      res.end();
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
  switch (event.type) {
    case 'wake':
      logger.info('GAS: 定期起動監視スクリプト受信');
      updateChannelTopic(discordService, notionService).catch((error) => {
        logger.error(`Error in updating channel topic: ${error}`);
      });
      updateBotProfile(discordService, notionService);
      break;
    case 'noonNotify':
      logger.info('GAS: noonNotify');
      await announcePractice(notionService, discordService, 1).catch((error) => {
        logger.error(`Error in noonNotify: ${error}`);
      });
      break;
    case 'AKanRemind':
      logger.info('GAS: AKanRemind');
      await remindPracticeToBashotori(notionService, discordService).catch((error) => {
        logger.error(`Error in AKanRemind: ${error}`);
      });
      break;
    case 'message':
      if (event.groupid && event.name && event.message) {
        logger.info('LINE: line message to discord channel');
        const message = `${event.name}：\n${event.message}`;
        await discordService.sendLINEMessageToDiscord(event.groupid, message);
      }
      break;
    case 'kondate':
      await fetchKondate(notionService, discordService);
      break;
    default:
      logger.error(`Unknown event type: ${event.type}`);
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
