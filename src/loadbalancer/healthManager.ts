import type { RouteConfig, HealthState } from '../types/gateway.js';

import { FAILURE_THRESHOLD, CIRCUIT_COOLDOWN_MS } from '../config/other_Configs.js';

const targetHealth = new Map<string, HealthState>();

let pollInterval: NodeJS.Timeout | null = null;

export const initializeHealth = (routes: RouteConfig[]): void => {
  for (const route of routes) {
    for (const url of route.targets) {
      if (!targetHealth.has(url)) {
        targetHealth.set(url, {
          state: 'CLOSED',
          failures: 0,
          lastFailureTime: null,
        });
      }
    }
  }
};

export const getHealth = (url: string): HealthState => {
  return targetHealth.get(url) || { state: 'CLOSED', failures: 0, lastFailureTime: null };
};

export const recordSuccess = (url: string): void => {
  const state = targetHealth.get(url);
  if (!state) return;
  if (state.state === 'HALF_OPEN' || state.state === 'OPEN') {
    console.info(`[CircuitBreaker] Target RECOVERED: ${url}. State is now CLOSED.`);
  }
  state.failures = 0;
  state.state = 'CLOSED';
};

export const recordFailure = (url: string): void => {
  const state = targetHealth.get(url);
  if (!state) return;

  state.failures++;
  state.lastFailureTime = Date.now();

  if (state.state === 'HALF_OPEN') {
    console.warn(`[CircuitBreaker] Target failed in HALF_OPEN state: ${url}. State reverting to OPEN.`);
    state.state = 'OPEN';
  } else if (state.state === 'CLOSED' && state.failures >= FAILURE_THRESHOLD) {
    console.warn(`[CircuitBreaker] Target threshold exceeded: ${url} (Failed ${state.failures} times). State is now OPEN.`);
    state.state = 'OPEN';
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
    if (state.state !== 'CLOSED') count++;
  }
  return count;
};

export const startHealthPolling = async (routes: RouteConfig[]): Promise<void> => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  console.log(`[CircuitBreaker] Started background cooldown manager (checking every ${CIRCUIT_COOLDOWN_MS}ms)`);

  pollInterval = setInterval(() => {
    const now = Date.now();
    for (const [url, state] of targetHealth.entries()) {
      if (state.state === 'OPEN' && state.lastFailureTime && (now - state.lastFailureTime >= CIRCUIT_COOLDOWN_MS)) {
        console.info(`[CircuitBreaker] Cooldown passed for ${url}. State is now HALF_OPEN.`);
        state.state = 'HALF_OPEN';
      }
    }
  }, CIRCUIT_COOLDOWN_MS);
};

export const stopHealthPolling = (): void => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[CircuitBreaker] Stopped background cooldown manager');
  }
};
