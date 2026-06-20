import type { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

import { incrementMetric } from '../utils/metrics.js';

const rateLimiter = async (req: Request,res: Response,next: NextFunction,): Promise<void> => {
  const routeConfig = req.routeConfig;
  if (!routeConfig?.ratelimit) {
    return next();
  }
  const { max, windowMs, message } = routeConfig.ratelimit;
  const now = Date.now();
  const windowStart = now - windowMs;

  const key = `rate_limit:${req.ip ?? 'unknown'}:${req.path}`;
  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    const results = await pipeline.exec();

    const count = (results?.[1]?.[1] as number) ?? 0;

    if (count >= max) {
      incrementMetric('rateLimitedRequests');
      res.status(429).json({success: false,error: message,retryAfter: Math.ceil(windowMs / 1000)});
      return;
    }
    const member = `${now}-${Math.random()}`;
    await redis.zadd(key, now, member);
    await redis.pexpire(key, windowMs);
    next();
  } catch (error) {
    console.error('[RateLimiter] Redis error:', error);
    next();
  }
};

export default rateLimiter;
