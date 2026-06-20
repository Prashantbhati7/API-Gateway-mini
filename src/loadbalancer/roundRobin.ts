const counters = new Map<string, number>();

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
