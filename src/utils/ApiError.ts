export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly success: false = false;

  constructor(
    statusCode: number = 500,
    message: string = 'Internal Server Error',
  ) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}
