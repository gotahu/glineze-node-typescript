import { ConfigKey, ConfigValueMap, RawConfigUpdate } from './configTypes';
import { InvalidConfigurationError, MissingConfigurationError } from './errors';

export class ConfigStore {
  private values = new Map<string, string>();

  public replace(values: ReadonlyMap<string, string>): void {
    this.values = new Map(values);
  }

  public get<K extends ConfigKey>(key: K): ConfigValueMap[K] {
    const rawValue = this.getRaw(key);
    return this.parse(key, rawValue);
  }

  public getOptional<K extends ConfigKey>(key: K): ConfigValueMap[K] | undefined {
    const rawValue = this.values.get(key);
    if (!rawValue) return undefined;
    return this.parse(key, rawValue);
  }

  public getRaw(key: string): string {
    const value = this.values.get(key);
    if (!value) {
      throw new MissingConfigurationError(
        `Config に key: ${key} が存在しません。設定内容とスペルを確認し、必要に応じて Discord で /reload を実行してください。`
      );
    }
    return value;
  }

  public getAllRaw(): ReadonlyMap<string, string> {
    return new Map(this.values);
  }

  public validateUpdates(updates: readonly RawConfigUpdate[]): void {
    for (const { key, value } of updates) {
      if (!value) throw new InvalidConfigurationError(`Config ${key} に空の値は設定できません。`);
      if (key === 'countdown_notify_days') this.parse(key, value);
    }
  }

  public apply(updates: readonly RawConfigUpdate[]): void {
    for (const { key, value } of updates) this.values.set(key, value);
  }

  private parse<K extends ConfigKey>(key: K, rawValue: string): ConfigValueMap[K] {
    if (key === 'countdown_notify_days') {
      const values = rawValue.split(',').map((value) => Number(value.trim()));
      if (values.length === 0 || values.some((value) => !Number.isInteger(value) || value < 0)) {
        throw new InvalidConfigurationError(
          'countdown_notify_days は0以上の整数をカンマ区切りで設定してください。'
        );
      }
      return values as ConfigValueMap[K];
    }
    return rawValue as ConfigValueMap[K];
  }
}
