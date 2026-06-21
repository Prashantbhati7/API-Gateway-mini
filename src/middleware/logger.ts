import type { Request, Response, NextFunction } from 'express';

const loggerMiddleware = (req: Request,res: Response,next: NextFunction): void => {
  const start = Date.now();
  req.startTime = start;
  console.log(`[${req.requestId}] ─────────────────────────────────────`);
  console.log(`[${req.requestId}] Timestamp :`, new Date(start).toISOString());
  console.log(`[${req.requestId}] Method    :`, req.method);
  console.log(`[${req.requestId}] URL       :`, req.originalUrl);

  res.on('finish', () => {
    console.log(`[${req.requestId}] Status    :`, res.statusCode);
    console.log(`[${req.requestId}] Latency   :`, Date.now() - start, 'ms');
  });
  next();
};
export default loggerMiddleware;
