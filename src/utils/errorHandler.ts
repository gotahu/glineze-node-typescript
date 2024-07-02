import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleError(error: Error | AppError): void {
  if (error instanceof AppError) {
    logger.error(`${error.statusCode} - ${error.message}`);
  } else {
    logger.error(`500 - ${error.message}`);
  }
}
