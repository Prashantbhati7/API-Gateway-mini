export const counters = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retries: 0,
  timeouts: 0,
  rateLimitedRequests: 0,
};

export const incrementMetric = (key: keyof typeof counters): void => {
  counters[key]++;
};

export const getMetricsSnapshot = (): typeof counters => {
  return { ...counters };
};
