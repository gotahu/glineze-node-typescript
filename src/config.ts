import { Client } from '@notionhq/client';
import { NotionConfigRepository } from './adapters/notion/NotionConfigRepository';
import { env } from './env';
import { ConfigRepository } from './shared/config/ConfigRepository';
import { ConfigStore } from './shared/config/ConfigStore';
import { ConfigKey, ConfigValueMap, RawConfigUpdate } from './shared/config/configTypes';
import { ConfigurationPersistenceError } from './shared/config/errors';
import { EXTERNAL_API_TIMEOUT_MS } from './shared/resilience/externalApiPolicy';
import { logger } from './utils/logger';

export class ConfigurationService {
  constructor(
    private readonly store: ConfigStore,
    private readonly configRepository: ConfigRepository
  ) {}

  public async initialize(): Promise<void> {
    logger.info('Config の初期化を開始します。');
    try {
      const values = await this.configRepository.loadAll();
      this.store.replace(values);
      logger.debug(`Loaded ${values.size} configuration keys`);
      logger.info('Config を Notion から読み込み、初期化が完了しました。');
    } catch (error) {
      logger.error(`Config の初期化に失敗しました: ${error}`);
      throw new ConfigurationPersistenceError('Failed to initialize configuration', {
        cause: error,
      });
    }
  }

  public get<K extends ConfigKey>(key: K): ConfigValueMap[K] {
    return this.store.get(key);
  }

  public getOptional<K extends ConfigKey>(key: K): ConfigValueMap[K] | undefined {
    return this.store.getOptional(key);
  }

  public getRaw(key: string): string {
    return this.store.getRaw(key);
  }

  public getAll(): ReadonlyMap<string, string> {
    return this.store.getAllRaw();
  }

  public async set(key: string, value: string): Promise<void> {
    await this.updateMany([{ key, value }]);
  }

  public async updateMany(updates: readonly RawConfigUpdate[]): Promise<void> {
    this.store.validateUpdates(updates);
    const previousValues = this.store.getAllRaw();
    await this.configRepository.updateMany(updates, previousValues);
    this.store.apply(updates);
    logger.info(`${updates.length} 件の Config を更新しました。`);
  }

  public replaceRuntimeValues(values: ReadonlyMap<string, string>): void {
    this.store.replace(values);
  }
}

const configStore = new ConfigStore();
const configRepository = new NotionConfigRepository(
  new Client({
    auth: env.NOTION_TOKEN,
    timeoutMs: EXTERNAL_API_TIMEOUT_MS,
    retry: { maxRetries: 2, initialRetryDelayMs: 250, maxRetryDelayMs: 2_000 },
  }),
  env.NOTION_CONFIGURATION_DATABASEID
);

export const config = Object.assign(new ConfigurationService(configStore, configRepository), {
  discord: {
    botToken: env.DISCORD_BOT_TOKEN,
    relayWebhook: env.DISCORD_RELAY_WEBHOOK,
  },
  notion: {
    token: env.NOTION_TOKEN,
    configurationDatabaseId: env.NOTION_CONFIGURATION_DATABASEID,
  },
  app: {
    port: env.PORT,
  },
  repository: {
    path: env.REPOSITORY_PATH,
    branch: env.BRANCH,
  },
});
