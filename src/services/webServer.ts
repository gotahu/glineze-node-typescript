import bodyParser from 'body-parser';
import express, { Application } from 'express';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class WebServer {
  public app: Application;

  constructor() {
    this.app = express();
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());
  }

  public start(): void {
    this.app.listen(config.server.port, () => {
      logger.info('webserver(express) is online on port ' + config.server.port);
    });
  }
}
