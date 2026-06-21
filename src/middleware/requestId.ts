import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const requestIdMiddleware = (req: Request,_res: Response,next: NextFunction): void => {
  req.requestId = req.headers['x-request-id']?.toString() ?? crypto.randomUUID();
  next();
};

export default requestIdMiddleware;
