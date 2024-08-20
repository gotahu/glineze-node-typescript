import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { logger } from '../utils/logger';

export class AutoRestartService {
  private serverProcess: ChildProcess | null = null;
  private isRestarting = false;

  constructor(private appPath: string) {
    this.watchAppFile();
  }

  public start() {
    this.startServer();
  }

  private startServer() {
    logger.info('Starting server...');
    this.serverProcess = spawn('node', [this.appPath], {
      stdio: 'inherit',
    });

    this.serverProcess.on('close', (code) => {
      logger.info(`Server process exited with code ${code}`);
      if (!this.isRestarting) {
        this.startServer();
      }
    });
  }

  private watchAppFile() {
    fs.watch(this.appPath, (eventType) => {
      if (eventType === 'change' && !this.isRestarting) {
        this.restartServer();
      }
    });
  }

  private async restartServer() {
    this.isRestarting = true;
    logger.info('Restarting server...');

    if (this.serverProcess) {
      this.serverProcess.kill();
      // サーバープロセスが完全に終了するのを待つ
      await new Promise<void>((resolve) => {
        this.serverProcess!.on('close', () => {
          resolve();
        });
      });
    }

    this.startServer();
    this.isRestarting = false;
  }
}
