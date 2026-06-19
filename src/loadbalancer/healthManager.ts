import type { ServiceInstance, RouteConfig } from '../types/gateway.js';

import { FAILURE_THRESHOLD ,HEALTH_POLL_MS} from '../config/other_Configs.js';



let pollInterval: NodeJS.Timeout | null = null;


export const recordSuccess = (instance: ServiceInstance): void => {
  instance.failures = 0;
};

export const recordFailure = (instance: ServiceInstance): void => {
  instance.failures++;
  instance.lastFailureTime = Date.now();

  if (instance.failures >= FAILURE_THRESHOLD && instance.healthy) {
    console.warn(`[HealthManager] Target marked UNHEALTHY: ${instance.url} (Failed ${instance.failures} times)`);
    instance.healthy = false;
  }
};

export const getHealthSnapshot = (routes: RouteConfig[]): Record<string, unknown> => {
  const snapshot: Record<string, unknown> = {};
  for (const route of routes) {
    snapshot[route.prefix] = route.targets.map(t => ({
      url: t.url,
      healthy: t.healthy,
      failures: t.failures,
      lastFailureTime: t.lastFailureTime,
    }));
  }
  return snapshot;
};


export const startHealthPolling = (routes: RouteConfig[]): void => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  console.log(`[HealthManager] Started background recovery polling (every ${HEALTH_POLL_MS}ms)`);

  pollInterval = setInterval(async () => {
    for (const route of routes) {
      for (const instance of route.targets) {
        if (!instance.healthy) {
          try {
            const pingUrl = `${instance.url}/health`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);

            const res = await fetch(pingUrl, {
              method: 'GET',
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (res.ok) {
              console.info(`[HealthManager] Target RECOVERED: ${instance.url}`);
              instance.healthy = true;
              instance.failures = 0;
            }
          } catch (err) {
          }
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
