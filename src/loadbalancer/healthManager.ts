import type { RouteConfig, HealthState } from '../types/gateway.js';

// If other_Configs.ts has the constants, we import them.
// Let's assume it has FAILURE_THRESHOLD and HEALTH_POLL_MS.
import { FAILURE_THRESHOLD, HEALTH_POLL_MS } from '../config/other_Configs.js';

const targetHealth = new Map<string, HealthState>();

let pollInterval: NodeJS.Timeout | null = null;

/**
 * Initializes the health state for all targets defined in the routes.
 * Should be called once at startup.
 */
export const initializeHealth = (routes: RouteConfig[]): void => {
  for (const route of routes) {
    for (const url of route.targets) {
      if (!targetHealth.has(url)) {
        targetHealth.set(url, {
          healthy: true,
          failures: 0,
          lastFailureTime: null,
        });
      }
    }
  }
};

/**
 * Gets the current health state for a given URL.
 * Defaults to healthy if not found (fail open).
 */
export const getHealth = (url: string): HealthState => {
  return targetHealth.get(url) || { healthy: true, failures: 0, lastFailureTime: null };
};

/**
 * Record a successful proxy request for a target.
 * Resets the failure counter to 0.
 */
export const recordSuccess = (url: string): void => {
  const state = targetHealth.get(url);
  if (state) {
    state.failures = 0;
  }
};

/**
 * Record a failed proxy request for a target (e.g. timeout, ECONNREFUSED).
 * Increments the failure counter. If it hits the threshold,
 * marks the instance as unhealthy and records the failure time.
 */
export const recordFailure = (url: string): void => {
  const state = targetHealth.get(url);
  if (!state) return;

  state.failures++;
  state.lastFailureTime = Date.now();

  if (state.failures >= FAILURE_THRESHOLD && state.healthy) {
    console.warn(`[HealthManager] Target marked UNHEALTHY: ${url} (Failed ${state.failures} times)`);
    state.healthy = false;
  }
};

/**
 * Returns a JSON-serializable snapshot of all routes and their instances' health.
 * Used for the /gateway/health admin endpoint.
 */
export const getHealthSnapshot = (routes: RouteConfig[]): Record<string, unknown> => {
  const snapshot: Record<string, unknown> = {};
  for (const route of routes) {
    snapshot[route.prefix] = route.targets.map((url) => ({
      url,
      ...getHealth(url),
    }));
  }
  return snapshot;
};

/**
 * Starts the background health polling interval.
 * Every HEALTH_POLL_MS, it will issue a GET request to the /health endpoint
 * of any instance currently marked unhealthy in the Map.
 * If successful, the instance is restored to healthy status.
 */
export const startHealthPolling = (routes: RouteConfig[]): void => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  console.log(`[HealthManager] Started background recovery polling (every ${HEALTH_POLL_MS}ms)`);

  pollInterval = setInterval(async () => {
    // Iterate over the map instead of routes, as the map has the current health state
    for (const [url, state] of targetHealth.entries()) {
      if (!state.healthy) {
        try {
          const pingUrl = `${url}/health`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);

          const res = await fetch(pingUrl, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok) {
            console.info(`[HealthManager] Target RECOVERED: ${url}`);
            state.healthy = true;
            state.failures = 0;
          }
        } catch (err) {
          // Still unhealthy
        }
      }
    }
  }, HEALTH_POLL_MS);
};

export const stopHealthPolling = (): void => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[HealthManager] Stopped background recovery polling');
  }
};
