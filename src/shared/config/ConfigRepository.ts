import { RawConfigUpdate } from './configTypes';

export interface ConfigRepository {
  loadAll(): Promise<ReadonlyMap<string, string>>;
  updateMany(
    updates: readonly RawConfigUpdate[],
    previousValues: ReadonlyMap<string, string>
  ): Promise<void>;
}
