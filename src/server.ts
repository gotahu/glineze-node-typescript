import { fork, ChildProcess } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import path from 'path';
import { isDevelopment } from './utils/environment';
import { config } from './config/config';
import { logger } from './utils/logger';
import { WebhookService } from './services/webhookService';

class AppServer {
  private appProcess: ChildProcess;
  private isRestarting = false;
  private app: express.Application;
  private server: import('http').Server | null = null;
  private webhookService: WebhookService;

  constructor() {
    this.app = express();
    this.app.use(express.urlencoded({ extended: true }));
    this.webhookService = new WebhookService();
    this.setupWebhook();
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

    // プロキシの設定を適用
    this.app.use('/app', appProxy);
  }

  private setupWebhook() {
    this.app.post('/webhook', async (req, res) => {
      if (isDevelopment()) {
        console.log(req);
        if (req.body && req.body.token && req.body.token === config.webhook.restartToken) {
          logger.info('Received restart token');
          res.status(200).send('Success');
          await this.restartChildProcesses();
          return;
        }
        logger.info('Received webhook event, but ignored in development mode');
        res.status(200).send('Success');
        return;
      }

      const signature = req.headers['x-hub-signature-256'] as string;
      if (!this.webhookService.verifySignature(JSON.stringify(req.body), signature)) {
        logger.error('Invalid webhook signature');
        res.status(403).send('Invalid signature');
        return;
      }

      try {
        console.log(req.body.ref);
        const result = await this.webhookService.handlePushEvent(req.body.ref);

        if (result) {
          res.status(200).send('Success');
          await this.restartChildProcesses();
          return;
        }
      } catch (error) {
        logger.error('Error in handlePushEvent: ' + error);
        res.status(500).send('Error');
      }
    });
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

  private async restartChildProcesses() {
    // リスタート中は再度リスタートしない
    if (this.isRestarting) {
      return;
    }

    this.isRestarting = true;
    logger.info('Restarting child processes...');

    await this.stopChildProcess(this.appProcess);

    this.startChildProcesses();
    this.isRestarting = false;
  }

  private async stopChildProcess(process: ChildProcess) {
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
