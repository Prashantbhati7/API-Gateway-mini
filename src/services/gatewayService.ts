import { Router } from 'express';
import routes from '../config/routes.js';
import loggerMiddleware from '../middleware/logger.js';
import requestIdMiddleware from '../middleware/requestId.js';
import authMiddleware from '../middleware/auth.js';
import rateLimiter from '../middleware/rateLimiter.js';
import proxyHandler from '../proxy/proxyHandler.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

import '../types/gateway.js';

import { incrementMetric, incrementRouteMetric } from '../utils/metrics.js';

const gatewayRouter = Router();

gatewayRouter.use((req, res, next) => {
  incrementMetric('totalRequests');
  next();
});

gatewayRouter.use(requestIdMiddleware);
gatewayRouter.use(loggerMiddleware);

gatewayRouter.use(
  asyncHandler(async (req, res, next) => {
    const config = routes.find((r) => req.path.startsWith(r.prefix));

    if (!config) {
      throw new ApiError(404, `Route not found: ${req.path}`);
    }

    req.routeConfig = config;
    incrementRouteMetric(config.prefix, 'requests');
    next();
  }),
);

gatewayRouter.use(rateLimiter);

gatewayRouter.use((req, res, next) => {
  if (req.routeConfig?.auth) {
    return authMiddleware(req, res, next);
  }
  next();
});
gatewayRouter.use(asyncHandler(proxyHandler));

export default gatewayRouter;
