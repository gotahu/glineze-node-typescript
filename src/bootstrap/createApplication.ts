import { config } from '../config';
import { env } from '../env';
import { CronService } from '../services/cron/CronService';
import { DiscordService } from '../services/discord/discordService';
import { NotionService } from '../services/notion/notionService';
import { SesameService } from '../features/sesame/SesameService';
import { WebServerService } from '../services/webapi/webServerService';
import { LogMessage } from '../types/logger';
import { logger } from '../utils/logger';
import { Application } from './Application';
import { ServiceContainer } from './ServiceContainer';

export async function createApplication(): Promise<Application> {
  await config.initialize();

  const notionService = new NotionService();
  const sesameService = env.SESAME_ENABLED ? new SesameService() : undefined;
  if (!sesameService) logger.info('Sesame integration is disabled');

  const discordService = new DiscordService({
    notion: notionService,
    sesame: sesameService,
  });
  const services: ServiceContainer = {
    notion: notionService,
    discord: discordService,
    sesame: sesameService,
  };
  const cronService = new CronService(services);
  const webServerService = new WebServerService(services);

  const discordLogHandler = async (logMessage: LogMessage) => {
    try {
      const formattedMessage = `[${logMessage.level}] [${logMessage.timestamp.toISOString()}] ${logMessage.message}`;
      await discordService.sendStringsToChannel([formattedMessage], logger.getLoggerChannelId());
    } catch (error) {
      // logger を使うと discordLog が再送出されるため、ここだけは直接 stderr へ出す。
      console.error('Failed to route log to DiscordService:', error);
    }
  };
  logger.on('discordLog', discordLogHandler);

  return new Application([discordService, cronService, webServerService], () => {
    logger.off('discordLog', discordLogHandler);
  });
}
