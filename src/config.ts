import { env } from './env';
import { ConfigRepository, createNotionValueProperty } from './config/repository';
import { ConfigService } from './config/service';
import { ConfigStore } from './config/store';

export const configService = new ConfigService(
  new ConfigRepository(env.NOTION_TOKEN, env.NOTION_CONFIGURATION_DATABASEID),
  new ConfigStore()
);

/** 既存利用箇所を段階移行するための互換 API。 */
export const config = {
  discord: {
    botToken: env.DISCORD_BOT_TOKEN,
    relayWebhook: env.DISCORD_RELAY_WEBHOOK,
  },
  notion: {
    token: env.NOTION_TOKEN,
    configurationDatabaseId: env.NOTION_CONFIGURATION_DATABASEID,
  },
  app: { port: env.PORT },
  repository: { path: env.REPOSITORY_PATH, branch: env.BRANCH },
  notionConfigs: configService.store.values,
  configurationPages: configService.repository.pages,
  initializeConfig: () => configService.initialize(),
  getConfig: (key: string) => configService.get(key),
  getAllConfigs: () => configService.getAll(),
  setConfig: (key: string, value: string) => configService.update(key, value),
  createNotionValueProperty,
};

export * from './config/definitions';
export * from './config/repository';
export * from './config/service';
export * from './config/store';
