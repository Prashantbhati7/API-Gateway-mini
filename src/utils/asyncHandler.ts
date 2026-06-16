import type { Request, Response, NextFunction, RequestHandler } from 'express';

const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
