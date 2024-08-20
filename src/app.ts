import { GASEvent } from './types/types';
import { logger } from './utils/logger';
import { DiscordService } from './services/discord/discordService';
import { WebServer } from './services/webServer';
import { NotionService } from './services/notionService';
import { LINENotifyService } from './services/lineNotifyService';
import { announcePractice, remindPracticeToBashotori } from './notion/practice';
import path from 'path';
import { AutoRestartService } from './services/autoRestartService';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Starting in production mode');
    const autoRestartService = new AutoRestartService(path.join(__dirname, 'app.js'));
    autoRestartService.start();
  } else {
    console.log('Starting in development mode');
    startServer();
  }
}

function startServer() {
  const webServer = new WebServer();
  const notionService = new NotionService();
  const lineNotifyService = new LINENotifyService();
  const discordService = new DiscordService(notionService, lineNotifyService);

  // 各サービスの起動
  webServer.start();
  discordService.start();
  // API
  webServer.app.post('/', async (req, res) => {
    try {
      logger.info(JSON.stringify(req.body));

      if (!req.body || !req.body.events) {
        logger.error('No post data or events array');
        res.end();
        return;
      }

      const events: GASEvent[] = req.body.events;

      for (const event of events) {
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

      res.end();
    } catch (error) {
      console.error(error);
      res.status(500).end();
    }
  });
}

main().catch((error) => {
  console.error(error);
  logger.error(`Fatal error in main execution: ${error}`);
});
