import { fork, ChildProcess } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import path from 'path';
import { isDevelopment } from './utils/environment';
import { config } from './config/config';
import { logger } from './utils/logger';
import { WebhookService } from './services/webhookService';

export class AppServer {
  private appProcess: ChildProcess | null = null;
  private isRestarting = false;
  private app: express.Express;
  private server: import('http').Server;
  private webhookService: WebhookService;

  constructor() {
    this.app = express();
    this.webhookService = new WebhookService(this);
    this.setupProxy();
    this.setupProcessHandlers();
  }

  start() {
    this.startChildProcesses();
    this.server = this.app.listen(config.server.port, () => {
      logger.info(`Main server is running on port ${config.server.port}`);
    });
  }

  private setupProxy() {
    // プロキシエラー処理を共通化
    const proxyErrorHandler = (err: Error, req: express.Request, res: express.Response) => {
      logger.error(`Proxy error: ${err.message}`);
      res.status(500).send('Something went wrong. Please try again later.');
    };

    // プロキシ設定の配列
    const proxies = [
      { path: '/app', target: `http://localhost:${config.app.port}/` },
      { path: '/webhook', target: `http://localhost:${config.webhook.port}/` },
      { path: '/oshigla', target: `http://localhost:${config.oshigla.port}/` },
    ];

    // 各プロキシを設定
    proxies.forEach(({ path, target }) => {
      this.app.use(
        path,
        createProxyMiddleware({
          target,
          changeOrigin: true,
          on: {
            error: proxyErrorHandler,
          },
        })
      );
    });
  }

  private setupProcessHandlers() {
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('exit', () => this.gracefulShutdown());
  }

  private async gracefulShutdown() {
    logger.info('Graceful shutdown initiated');
    this.isRestarting = true;
    await this.stopChildProcess(this.appProcess);
    if (this.server) {
      this.server.close(() => {
        logger.info('Main server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }

  private startChildProcesses() {
    this.startAppProcess();
  }

  private startAppProcess() {
    const appPath = isDevelopment()
      ? path.join(__dirname, 'app.ts')
      : path.join(__dirname, 'app.js');

    logger.info(`Starting child process: ${appPath}`);

    this.appProcess = this.forkProcess(appPath, config.app.port, (code) => {
      logger.info(`Child process (${appPath}) exited with code ${code}`);
      if (!this.isRestarting && code !== 0) {
        logger.info(`Restarting child process (${appPath})...`);
        this.startAppProcess();
      }
    });
  }

  private forkProcess(
    scriptPath: string,
    port: number,
    onExit: (code: number | null) => void
  ): ChildProcess {
    const options: any = {
      env: { ...process.env, PORT: port.toString() },
    };

    if (isDevelopment()) {
      options.execArgv = ['-r', 'ts-node/register'];
    }

    const childProcess = fork(scriptPath, [], options);

    childProcess.on('error', (err) => {
      logger.error(`Error in child process (${scriptPath}): ${err.message}`);
    });

    childProcess.on('exit', onExit);

    return childProcess;
  }

  public async restartChildProcesses() {
    if (this.isRestarting) {
      logger.info('Already restarting child processes');
      return;
    }

    this.isRestarting = true;
    logger.info('Restarting child processes...', true);

    await this.stopChildProcess(this.appProcess);
    this.startChildProcesses();

    this.isRestarting = false;
  }

  private async stopChildProcess(childProcess: ChildProcess | null) {
    if (childProcess && !childProcess.killed) {
      logger.info('Stopping child process...');
      childProcess.kill();

      await new Promise<void>((resolve) => {
        childProcess.on('exit', () => {
          logger.info('Child process stopped');
          resolve();
        });
      });
    }
  }
}

const appServer = new AppServer();
appServer.start();
