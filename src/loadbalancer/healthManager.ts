import type { RouteConfig, HealthState } from '../types/gateway.js';

import { FAILURE_THRESHOLD, HEALTH_POLL_MS } from '../config/other_Configs.js';

const targetHealth = new Map<string, HealthState>();

let pollInterval: NodeJS.Timeout | null = null;

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

export const getHealth = (url: string): HealthState => {
  return targetHealth.get(url) || { healthy: true, failures: 0, lastFailureTime: null };
};

export const recordSuccess = (url: string): void => {
  const state = targetHealth.get(url);
  if (!state) return 
  state.failures = 0;
  state.healthy = true;
};

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

export const getUnhealthyCount = (): number => {
  let count = 0;
  for (const state of targetHealth.values()) {
    if (!state.healthy) count++;
  }
  return count;
};
export const startHealthPolling = (routes: RouteConfig[]): void => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  console.log(`[HealthManager] Started background recovery polling (every ${HEALTH_POLL_MS}ms)`);

  pollInterval = setInterval(async () => {
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
