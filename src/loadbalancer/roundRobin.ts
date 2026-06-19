const counters = new Map<string, number>();

/**
 * Returns the next target URL in the rotation.
 * The caller must pass ONLY healthy target URLs to this function.
 * 
 * @param healthyTargets Array of target URLs (strings) that are currently healthy
 * @param prefix The route prefix (used as the counter key)
 */
export const roundRobin = (healthyTargets: string[], prefix: string): string => {
  const total = healthyTargets.length;

  if (total === 0) {
    throw new Error(`[RoundRobin] No targets available for routing`);
  }

  const current = counters.get(prefix) ?? 0;
  const targetIndex = current % total;

  if (current >= Number.MAX_SAFE_INTEGER) {
    counters.set(prefix, 0);
  } else {
    counters.set(prefix, current + 1);
  }

  return healthyTargets[targetIndex] as string;
};
