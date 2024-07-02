import express from 'express';
import bodyParser from 'body-parser';
import { config } from './config/config';
import { discordClient } from './discord/client';
import {
  notifyLatestPractices,
  sendLINEMessageToDiscord,
  remindAKanPractice,
} from './discord/message';
import { GASEvent } from './types/types';
import { logger } from './utils/logger';
import { handleError } from './utils/errorHandler';

const webServer = express();

webServer.use(bodyParser.urlencoded({ extended: true }));
webServer.use(bodyParser.json());

webServer.listen(config.server.port);
logger.info(`webserver(express) is online on port ${config.server.port}`);

webServer.post('/', async (req, res) => {
  try {
    logger.info(JSON.stringify(req.body));

    if (!req.body || !req.body.events) {
      logger.warn('No post data or events array');
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
          await notifyLatestPractices(discordClient);
          break;
        case 'AKanRemind':
          logger.info('GAS: AKanRemind');
          await remindAKanPractice(discordClient);
          break;
        case 'message':
          if (event.groupid && event.name && event.message) {
            logger.info('LINE: line message to discord channel');
            await sendLINEMessageToDiscord(discordClient, event.groupid, event.name, event.message);
          }
          break;
        case 'join':
        case 'leave':
          logger.info(`LINE: ${event.type}`);
          logger.info(JSON.stringify(event));
          break;
        default:
          logger.warn(`Unknown event type: ${event.type}`);
      }
    }

    res.end();
  } catch (error) {
    handleError(error);
    res.status(500).end();
  }
});
