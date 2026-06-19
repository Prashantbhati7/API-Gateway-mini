export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

export interface HealthState {
  healthy:boolean;
  failures:number;
  lastFailureTime: number | null;
}

export interface RouteConfig {
  prefix: string;
  auth: boolean;
  targets: string[];
  ratelimit?: RateLimitConfig;
}

export interface JwtUser {
  id: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}
