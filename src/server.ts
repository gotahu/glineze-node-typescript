import { fork, ChildProcess } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import path from 'path';
import { isDevelopment } from './utils/environment';
import { config } from './config/config';
import { logger } from './utils/logger';
import { WebhookService } from './services/webhookService';

export class AppServer {
  private appProcess: ChildProcess;
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

  private setupProxy() {
    const appProxy = createProxyMiddleware({
      target: `http://localhost:${config.app.port}/`,
      changeOrigin: true,
      on: {
        error: this.handleProxyError,
      },
    });

    const webhookProxy = createProxyMiddleware({
      target: `http://localhost:${config.webhook.port}/`,
      changeOrigin: true,
      on: {
        error: this.handleProxyError,
      },
    });

    const oshiglaProxy = createProxyMiddleware({
      target: `http://localhost:${config.oshigla.port}/`,
      changeOrigin: true,
      on: {
        error: this.handleProxyError,
      },
    });

    // プロキシの設定を適用
    this.app.use('/app', appProxy);
    this.app.use('/webhook', webhookProxy);
    this.app.use('/oshigla', oshiglaProxy);
  }

  private handleProxyError(err: Error, req: express.Request, res: express.Response) {
    logger.error(`Proxy error: ${err}`);
    res.writeHead(500, {
      'Content-Type': 'text/plain',
    });
    res.end('Something went wrong. Please try again later.');
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

  start() {
    this.startChildProcesses();
    this.server = this.app.listen(config.server.port, () => {
      logger.info(`Main server is running on port ${config.server.port}`);
    });
  }

  private startChildProcesses() {
    this.startAppProcess();
  }

  private startAppProcess() {
    const appPath = isDevelopment()
      ? path.join(__dirname, 'app.ts')
      : path.join(__dirname, 'app.js');

    logger.info(`Starting ${appPath}...`);

    this.appProcess = this.forkProcess(appPath, config.app.port);
  }

  private forkProcess(scriptPath: string, port: number): ChildProcess {
    const options = {
      env: { ...process.env, PORT: port.toString() },
    };

    if (isDevelopment()) {
      options['execArgv'] = ['-r', 'ts-node/register'];
    }

    const childProcess = fork(scriptPath, [], options);

    childProcess.on('error', (err) => {
      logger.error(`Error in child process (${scriptPath}): ${err}`);
    });

    childProcess.on('exit', (code) => {
      logger.info(`Child process (${scriptPath}) exited with code ${code}`);
      if (!this.isRestarting && code !== 0) {
        logger.info(`Restarting child process (${scriptPath})...`);
        this.forkProcess(scriptPath, port);
      }
    });

    return childProcess;
  }

  public async restartChildProcesses() {
    // リスタート中は再度リスタートしない
    if (this.isRestarting) {
      logger.info('Already restarting child processes');
      return;
    }

    this.isRestarting = true;
    logger.info('Restarting child processes...');

    // App プロセスのみ再起動
    await this.stopChildProcess(this.appProcess);

    this.startChildProcesses();
    this.isRestarting = false;
  }

  private async stopChildProcess(process: ChildProcess) {
    logger.info(`Stopping child process...`);
    if (process) {
      console.log(process);
      process.kill();
      await new Promise<void>((resolve) => {
        process.on('exit', () => {
          resolve();
        });
      });
    }
  }
}

const appServer = new AppServer();
appServer.start();
