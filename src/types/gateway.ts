

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}


export interface RouteConfig {
  prefix: string;
  auth: boolean;
  target: string[];
  ratelimit?: RateLimitConfig;
}

export interface JwtUser {
  id: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}
