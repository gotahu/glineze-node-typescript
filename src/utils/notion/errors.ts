export class NotFoundPropertyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundPropertyError';
  }
}
