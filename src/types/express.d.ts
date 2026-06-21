import type { RouteConfig, JwtUser } from './gateway.js';

declare module 'express-serve-static-core' {
  interface Request {
    routeConfig?: RouteConfig;
    user?: JwtUser;
    startTime?: number;
    requestId?: string;
  }
}
