import { fork, ChildProcess } from 'child_process';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import express from 'express';
import { watch } from 'fs';
import path from 'path';
import { WebServer } from './services/webServer';
import { isDevelopment } from './utils/environment';
import { config } from './config/config';
import { logger } from './utils/logger';

class AppServer {
  private childProcess: ChildProcess | null = null;
  private isRestarting = false;
  private webServer: WebServer;
  private app: express.Application;

  constructor() {
    this.webServer = new WebServer();
    this.app = express();
    if (isDevelopment()) {
      this.watchAppFile();
    }
    this.setupProxy();
  }

  private setupProxy() {
    this.app.use(
      '/',
      createProxyMiddleware({
        target: `http://localhost:${config.app.port}`,
        changeOrigin: true,
        onProxyReq: fixRequestBody,
        onError: (err, req, res) => {
          logger.error(`Proxy error: ${err}`);
          res.writeHead(500, {
            'Content-Type': 'text/plain',
          });
          res.end('Something went wrong. Please try again later.');
        },
      } as any)
    );
  }

  start() {
    this.webServer.start();
    this.startChildProcess();
    this.app.listen(config.server.port, () => {
      logger.info(`Main server is running on port ${config.server.port}`);
    });
  }

  private startChildProcess() {
    const appPath = isDevelopment()
      ? path.join(__dirname, 'app.ts')
      : path.join(__dirname, 'app.js');

    logger.info(`Starting ${appPath}...`);

    if (isDevelopment()) {
      this.childProcess = fork(appPath, [], {
        execArgv: ['-r', 'ts-node/register'],
        env: { ...process.env, PORT: config.app.port.toString() },
      });
    } else {
      this.childProcess = fork(appPath, [], {
        env: { ...process.env, PORT: config.app.port.toString() },
      });
    }

    this.childProcess.on('exit', (code) => {
      logger.info(`Child process exited with code ${code}`);
      if (!this.isRestarting) {
        this.startChildProcess();
      }
    });
  }

  private watchAppFile() {
    const appPath = path.join(__dirname, 'app.ts');
    watch(appPath, (eventType) => {
      if (eventType === 'change' && !this.isRestarting) {
        this.restartChildProcess();
      }
    });
  }

  private async restartChildProcess() {
    this.isRestarting = true;
    logger.info('Restarting app...');

    if (this.childProcess) {
      this.childProcess.kill();
      await new Promise<void>((resolve) => {
        this.childProcess!.on('exit', () => {
          resolve();
        });
      });
    }

    this.startChildProcess();
    this.isRestarting = false;
  }
}

const appServer = new AppServer();
appServer.start();
