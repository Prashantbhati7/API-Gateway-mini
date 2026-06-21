export const counters = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retries: 0,
  timeouts: 0,
  rateLimitedRequests: 0,
};

export interface RouteMetrics {
  requests: number;
  successes: number;
  failures: number;
  retries: number;
  timeouts: number;
  rateLimited: number;
}

const routeMetrics = new Map<string, RouteMetrics>();

export const incrementMetric = (key: keyof typeof counters): void => {
  counters[key]++;
};

export const incrementRouteMetric = (route: string, metric: keyof RouteMetrics): void => {
  if (!routeMetrics.has(route)) {
    routeMetrics.set(route, { requests: 0, successes: 0, failures: 0, retries: 0, timeouts: 0, rateLimited: 0 });
  }
  const rm = routeMetrics.get(route)!;
  rm[metric]++;
};

export const getMetricsSnapshot = () => {
  const routesSnapshot: Record<string, RouteMetrics> = {};
  for (const [route, metrics] of routeMetrics.entries()) {
    routesSnapshot[route] = { ...metrics };
  }
  return {
    global: { ...counters },
    routes: routesSnapshot,
  };
};
