import { Application } from './bootstrap/Application';
import { createApplication } from './bootstrap/createApplication';
import { logger } from './utils/logger';

type ApplicationFactory = () => Promise<Application>;

type ProcessLifecycle = Pick<NodeJS.Process, 'once' | 'on' | 'removeListener' | 'exitCode'>;

export async function main(factory: ApplicationFactory = createApplication): Promise<Application> {
  logger.info('glineze アプリケーションを起動します');
  const application = await factory();
  await application.start();
  logger.info('glineze アプリケーションが起動しました');
  return application;
}

export function installProcessHandlers(
  application: Application,
  runtimeProcess: ProcessLifecycle = process
): () => void {
  let stopping = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    logger.info(`${signal} を受信したため、アプリケーションを停止します`);
    try {
      await application.stop();
    } catch (error) {
      runtimeProcess.exitCode = 1;
      logger.error(`アプリケーションの停止に失敗しました: ${error}`);
    }
  };
  const handleSigint = () => void shutdown('SIGINT');
  const handleSigterm = () => void shutdown('SIGTERM');
  const handleUnhandledRejection = (reason: unknown, promise: Promise<unknown>) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  };

  runtimeProcess.once('SIGINT', handleSigint);
  runtimeProcess.once('SIGTERM', handleSigterm);
  runtimeProcess.on('unhandledRejection', handleUnhandledRejection);

  return () => {
    runtimeProcess.removeListener('SIGINT', handleSigint);
    runtimeProcess.removeListener('SIGTERM', handleSigterm);
    runtimeProcess.removeListener('unhandledRejection', handleUnhandledRejection);
  };
}

if (require.main === module) {
  main()
    .then((application) => {
      installProcessHandlers(application);
    })
    .catch((error) => {
      process.exitCode = 1;
      logger.error(`アプリの起動に失敗しました: ${error}`);
    });
}
