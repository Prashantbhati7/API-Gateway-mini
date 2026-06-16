export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

export interface ServiceInstance {
  url: string;
  healthy: boolean;
  failures: number;
  lastFailureTime: number | null;
}

export interface RouteConfig {
  prefix: string;
  auth: boolean;
  targets: ServiceInstance[];
  ratelimit?: RateLimitConfig;
}

export interface JwtUser {
  id: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}
