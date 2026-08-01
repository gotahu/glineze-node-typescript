import { logger } from '../utils/logger';

export interface ApplicationComponent {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class Application {
  private readonly startedComponents: ApplicationComponent[] = [];
  private stopped = false;

  constructor(
    private readonly components: readonly ApplicationComponent[],
    private readonly cleanup: () => void = () => {}
  ) {}

  public async start(): Promise<void> {
    if (this.startedComponents.length > 0) return;
    this.stopped = false;

    try {
      for (const component of this.components) {
        await component.start();
        this.startedComponents.push(component);
      }
    } catch (error) {
      try {
        await this.stopStartedComponents();
      } catch (rollbackError) {
        this.cleanupOnce();
        throw new AggregateError(
          [error, rollbackError],
          'Application startup failed and rollback was incomplete',
          { cause: rollbackError }
        );
      }
      this.cleanupOnce();
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.stopped) return;
    try {
      await this.stopStartedComponents();
    } finally {
      this.cleanupOnce();
    }
  }

  private async stopStartedComponents(): Promise<void> {
    const errors: unknown[] = [];
    for (const component of this.startedComponents.splice(0).reverse()) {
      try {
        await component.stop();
      } catch (error) {
        errors.push(error);
        logger.error(`Application component stop failed: ${error}`);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Failed to stop one or more application components');
    }
  }

  private cleanupOnce(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.cleanup();
  }
}
