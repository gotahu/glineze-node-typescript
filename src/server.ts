import { fork, ChildProcess } from 'child_process';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import express from 'express';
import { watch } from 'fs';
import path from 'path';
import { isDevelopment } from './utils/environment';
import { config } from './config/config';
import { logger } from './utils/logger';

class AppServer {
  private appProcess: ChildProcess | null = null;
  private webhookProcess: ChildProcess | null = null;
  private isRestarting = false;
  private app: express.Application;
  private server: import('http').Server | null = null;

  constructor() {
    this.app = express();
    if (isDevelopment()) {
      this.watchAppFile();
    }
    this.setupProxy();
    this.setupProcessHandlers();
  }

  private setupProxy() {
    this.app.use(
      '/webhook',
      createProxyMiddleware({
        target: `http://localhost:${config.webhook.port}`,
        changeOrigin: true,
        onProxyReq: fixRequestBody,
        onError: this.handleProxyError,
      } as any)
    );

    this.app.use(
      '/',
      createProxyMiddleware({
        target: `http://localhost:${config.app.port}`,
        changeOrigin: true,
        onProxyReq: fixRequestBody,
        onError: this.handleProxyError,
      } as any)
    );
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
    await this.stopChildProcess(this.webhookProcess);
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
    this.startWebhookProcess();
  }

  private startAppProcess() {
    const appPath = isDevelopment()
      ? path.join(__dirname, 'app.ts')
      : path.join(__dirname, 'app.js');

    logger.info(`Starting ${appPath}...`);

    this.appProcess = this.forkProcess(appPath, config.app.port);
  }

  private startWebhookProcess() {
    const webhookPath = isDevelopment()
      ? path.join(__dirname, 'services', 'webServer.ts')
      : path.join(__dirname, 'src', 'services', 'webServer.js');

    logger.info(`Starting ${webhookPath}...`);

    this.webhookProcess = this.forkProcess(webhookPath, config.webhook.port);
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

  private watchAppFile() {
    const appPath = path.join(__dirname, 'app.ts');
    watch(appPath, (eventType) => {
      if (eventType === 'change' && !this.isRestarting) {
        this.restartChildProcesses();
      }
    });
  }

  private async restartChildProcesses() {
    this.isRestarting = true;
    logger.info('Restarting child processes...');

    await this.stopChildProcess(this.appProcess);
    await this.stopChildProcess(this.webhookProcess);

    this.startChildProcesses();
    this.isRestarting = false;
  }

  private async stopChildProcess(process: ChildProcess | null) {
    if (process) {
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
