export type HealthState = 'idle' | 'running' | 'operational' | 'degraded';

export interface HealthRecord {
  id: string;
  state: HealthState;
  attempts: number;
  skipped: number;
  lastStartedAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastDurationMs?: number;
  lastError?: string;
}

export class HealthRegistry {
  private readonly records = new Map<string, HealthRecord>();

  public started(id: string, startedAt = new Date()): void {
    const current = this.getOrCreate(id);
    this.records.set(id, {
      ...current,
      state: 'running',
      attempts: current.attempts + 1,
      lastStartedAt: startedAt.toISOString(),
    });
  }

  public succeeded(id: string, durationMs: number, completedAt = new Date()): void {
    const current = this.getOrCreate(id);
    this.records.set(id, {
      ...current,
      state: 'operational',
      lastSuccessAt: completedAt.toISOString(),
      lastDurationMs: durationMs,
      lastError: undefined,
    });
  }

  public failed(id: string, error: unknown, durationMs: number, completedAt = new Date()): void {
    const current = this.getOrCreate(id);
    this.records.set(id, {
      ...current,
      state: 'degraded',
      lastFailureAt: completedAt.toISOString(),
      lastDurationMs: durationMs,
      lastError: error instanceof Error ? error.message : String(error),
    });
  }

  public skipped(id: string): void {
    const current = this.getOrCreate(id);
    this.records.set(id, { ...current, skipped: current.skipped + 1 });
  }

  public get(id: string): HealthRecord | undefined {
    const record = this.records.get(id);
    return record ? { ...record } : undefined;
  }

  public getAll(): HealthRecord[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  public clear(): void {
    this.records.clear();
  }

  private getOrCreate(id: string): HealthRecord {
    return this.records.get(id) ?? { id, state: 'idle', attempts: 0, skipped: 0 };
  }
}

export const healthRegistry = new HealthRegistry();
