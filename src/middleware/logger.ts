import type { Request, Response, NextFunction } from 'express';

const loggerMiddleware = (req: Request,res: Response,next: NextFunction): void => {
  const start = Date.now();
  req.startTime = start;
  console.log('─────────────────────────────────────');
  console.log('Timestamp :', new Date(start).toISOString());
  console.log('Method    :', req.method);
  console.log('URL       :', req.originalUrl);

  res.on('finish', () => {
    console.log('Status    :', res.statusCode);
    console.log('Latency   :', Date.now() - start, 'ms');
  });
  next();
};
export default loggerMiddleware;
