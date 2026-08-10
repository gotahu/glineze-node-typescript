import { logger } from '../utils/logger';
import {
  CONFIG_DEFINITIONS,
  ConfigEffect,
  ConfigKey,
  isConfigKey,
  normalizeConfigValue,
} from './definitions';
import { ConfigRepository } from './repository';
import { ConfigStore } from './store';

export type ConfigEffectHandlers = Partial<Record<ConfigEffect, () => unknown | Promise<unknown>>>;

export class ConfigService {
  private effectHandlers: ConfigEffectHandlers = {};
  private lastReloadAt?: Date;
  private lastReloadError?: string;

  constructor(
    public readonly repository: ConfigRepository,
    public readonly store: ConfigStore
  ) {}

  public setEffectHandlers(handlers: ConfigEffectHandlers): void {
    this.effectHandlers = handlers;
  }

  public getReloadStatus(): { at?: Date; error?: string } {
    return { at: this.lastReloadAt, error: this.lastReloadError };
  }

  public async initialize(): Promise<void> {
    logger.info('Config の初期化を開始します。');
    try {
      const snapshot = await this.repository.load();
      this.store.replace(snapshot.values);
      this.lastReloadAt = new Date();
      this.lastReloadError = undefined;
      logger.info(`Config を Notion から ${snapshot.values.size} 件読み込みました。`);
    } catch (error) {
      this.lastReloadAt = new Date();
      this.lastReloadError = 'Notion から設定を再読込できませんでした。';
      logger.error('Config の初期化に失敗しました。');
      throw new Error('Failed to initialize configuration', { cause: error });
    }
  }

  public get(key: string): string {
    return this.store.get(key);
  }

  public getAll(): ReadonlyMap<string, string> {
    return this.store.getAll();
  }

  public async update(key: string, value: string): Promise<void> {
    await this.updateMany({ [key]: value });
  }

  public async updateMany(input: Readonly<Record<string, string>>): Promise<void> {
    const normalized = new Map<string, string>();
    for (const [key, value] of Object.entries(input)) {
      normalized.set(key, normalizeConfigValue(key, value));
    }

    const effects = new Set<ConfigEffect>();
    let updatedCount = 0;
    try {
      for (const [key, value] of normalized) {
        if (key === 'sesame_enabled' && !this.repository.pages.has(key)) {
          await this.repository.create(key, value);
        } else {
          await this.repository.update(key, value);
        }
        updatedCount++;
        if (isConfigKey(key)) {
          const definition = CONFIG_DEFINITIONS[key];
          const effect = 'effect' in definition ? definition.effect : undefined;
          if (effect) effects.add(effect);
        }
      }
    } catch (error) {
      if (updatedCount === 0) throw error;
      logger.error('Config の更新に失敗したため、Notion から再読込します。');
      await this.initialize();
      throw new ConfigPartialUpdateError([...normalized.keys()], { cause: error });
    }

    for (const [key, value] of normalized) this.store.values.set(key, value);
    logger.info(`Config を更新しました: ${[...normalized.keys()].join(', ')}`);
    const scheduledEffects = [...effects];
    const effectResults = await Promise.allSettled(
      scheduledEffects.map(async (effect) => {
        await this.effectHandlers[effect]?.();
        return effect;
      })
    );
    const failedEffects = effectResults.flatMap((result, index) =>
      result.status === 'rejected' ? [scheduledEffects[index]] : []
    );
    if (failedEffects.length > 0) {
      throw new ConfigEffectError(failedEffects);
    }
  }

  public getDefinitions(
    category?: string
  ): Array<[ConfigKey, (typeof CONFIG_DEFINITIONS)[ConfigKey]]> {
    return (
      Object.entries(CONFIG_DEFINITIONS) as Array<
        [ConfigKey, (typeof CONFIG_DEFINITIONS)[ConfigKey]]
      >
    ).filter(([, definition]) => !category || definition.category === category);
  }
}

export class ConfigPartialUpdateError extends Error {
  constructor(
    public readonly attemptedKeys: string[],
    options?: ErrorOptions
  ) {
    super('設定の一部が更新された可能性があります。Notion から再読込しました。', options);
    this.name = 'ConfigPartialUpdateError';
  }
}

export class ConfigEffectError extends Error {
  constructor(public readonly failedEffects: ConfigEffect[]) {
    super('設定は保存されましたが、関連サービスへの反映に失敗しました。');
    this.name = 'ConfigEffectError';
  }
}
