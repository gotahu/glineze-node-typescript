import { GASEvent } from './types/types';
import { logger } from './utils/logger';
import { DiscordService } from './services/discord/discordService';
import { WebServer } from './services/webServer';
import { NotionService } from './services/notionService';
import { LINENotifyService } from './services/lineNotifyService';
import { announcePractice, remindPracticeToBashotori } from './notion/practice';
import path from 'path';
import { AutoRestartService } from './services/autoRestartService';
import { Request, Response } from 'express';

async function main() {
  logger.info(`Starting application in ${process.env.NODE_ENV} mode`);
  logger.info(`AUTO_RESTART is set to: ${process.env.AUTO_RESTART}`);

  if (process.env.NODE_ENV === 'production' && process.env.AUTO_RESTART !== 'false') {
    const autoRestartService = new AutoRestartService(path.join(__dirname, 'app.js'));
    autoRestartService.start();
  } else {
    await startServer();
  }
}

async function startServer() {
  try {
    const services = await initializeServices();
    setupAPIEndpoints(services);
    logger.info('Server started successfully');
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

async function initializeServices() {
  const webServer = new WebServer();
  const notionService = new NotionService();
  const lineNotifyService = new LINENotifyService();
  const discordService = new DiscordService(notionService, lineNotifyService);

  await webServer.start();
  await discordService.start();

  return { webServer, notionService, lineNotifyService, discordService };
}

function setupAPIEndpoints(services: {
  webServer: WebServer;
  notionService: NotionService;
  lineNotifyService: LINENotifyService;
  discordService: DiscordService;
}) {
  const { webServer, notionService, discordService } = services;

  webServer.app.post('/', async (req: Request, res: Response) => {
    try {
      logger.info(JSON.stringify(req.body));

      if (!req.body || !req.body.events) {
        logger.error('No post data or events array');
        res.end();
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
        await discordService.sendStringsToChannel([message], '1273731421663395973');
      }
      break;
    case 'join':
    case 'leave':
      logger.info(`LINE: ${event.type}`);
      logger.info(JSON.stringify(event));
      break;
    default:
      logger.error(`Unknown event type: ${event.type}`);
  }
}

main().catch((error) => {
  logger.error(`Fatal error in main execution: ${error}`);
  process.exit(1);
});
