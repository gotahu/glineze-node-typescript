import { HealthRegistry, healthRegistry } from '../../shared/health/HealthRegistry';
import { logger } from '../../utils/logger';

export type JobRunResult = 'succeeded' | 'failed' | 'skipped';

export class ScheduledJob {
  private running = false;

  constructor(
    public readonly name: string,
    private readonly operation: () => Promise<void>,
    private readonly health: HealthRegistry = healthRegistry,
    private readonly now: () => number = Date.now
  ) {}

  public async run(): Promise<JobRunResult> {
    if (this.running) {
      this.health.skipped(this.healthId);
      logger.info(`Scheduled job ${this.name} skipped because a previous run is still active`);
      return 'skipped';
    }

    this.running = true;
    const startedAt = this.now();
    this.health.started(this.healthId, new Date(startedAt));
    logger.info(`Scheduled job ${this.name} started`);

    try {
      await this.operation();
      const durationMs = this.now() - startedAt;
      this.health.succeeded(this.healthId, durationMs, new Date(this.now()));
      logger.info(`Scheduled job ${this.name} completed in ${durationMs}ms`);
      return 'succeeded';
    } catch (error) {
      const durationMs = this.now() - startedAt;
      this.health.failed(this.healthId, error, durationMs, new Date(this.now()));
      logger.error(`Scheduled job ${this.name} failed: ${error}`);
      return 'failed';
    } finally {
      this.running = false;
    }
  }

  private get healthId(): string {
    return `job:${this.name}`;
  }
}
