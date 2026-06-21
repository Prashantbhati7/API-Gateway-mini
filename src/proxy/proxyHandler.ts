import type { Request, Response, NextFunction } from 'express';
import { roundRobin } from '../loadbalancer/roundRobin.js';
import { getHealth, recordSuccess, recordFailure } from '../loadbalancer/healthManager.js';
import { ApiError } from '../utils/ApiError.js';
import { incrementMetric, incrementRouteMetric } from '../utils/metrics.js';

import { PROXY_TIMEOUT_MS } from '../config/other_Configs.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']); // safe to retry

const proxyHandler = async (req: Request,res: Response,next: NextFunction,): Promise<void> => {
  const route = req.routeConfig;

  if (!route) {
    return next(new ApiError(500, 'Proxy handler called without routeConfig'));
  }

  const availableTargets = route.targets.filter((url) => {
    const state = getHealth(url).state;
    return state === 'CLOSED' || state === 'HALF_OPEN';
  });

  if (availableTargets.length === 0) {
    incrementMetric('failedRequests');
    incrementRouteMetric(route.prefix, 'failures');
    return next(new ApiError(503, 'Service Unavailable: All upstream targets are OPEN (down)'));
  }

  const isSafeToRetry = SAFE_METHODS.has(req.method);
  const attempts = isSafeToRetry ? availableTargets.length : 1;

  const forwardedHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      forwardedHeaders[key] = value.join(', ');
    } else if (value !== undefined) {
      forwardedHeaders[key] = value;
    }
  }

  delete forwardedHeaders['host'];
  delete forwardedHeaders['connection'];
  delete forwardedHeaders['content-length'];
  delete forwardedHeaders['transfer-encoding'];
  delete forwardedHeaders['keep-alive'];
  delete forwardedHeaders['upgrade'];
  delete forwardedHeaders['te'];
  delete forwardedHeaders['trailer'];

  delete forwardedHeaders['x-user'];
  forwardedHeaders['x-user'] = req.user ? JSON.stringify(req.user) : '';

  if (req.requestId) {
    forwardedHeaders['x-request-id'] = req.requestId;
  }

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const requestBody: BodyInit | null = hasBody ? JSON.stringify(req.body ?? {}) : null;

  if (hasBody) {
    forwardedHeaders['content-type'] =
      forwardedHeaders['content-type'] ?? 'application/json';
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      incrementMetric('retries');
      incrementRouteMetric(route.prefix, 'retries');
    }
    // Re-filter currently available in case one failed during retry loop
    const currentlyAvailable = availableTargets.filter((url) => {
      const state = getHealth(url).state;
      return state === 'CLOSED' || state === 'HALF_OPEN';
    });
    if (currentlyAvailable.length === 0) {
      break;
    }

    const targetBaseUrl = roundRobin(currentlyAvailable, route.prefix);
    const targetUrl = targetBaseUrl + req.originalUrl;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, PROXY_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: forwardedHeaders,
        body: requestBody,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status >= 500) {
          recordFailure(targetBaseUrl);
          lastError = new ApiError(response.status, response.statusText || 'Unknown Proxy Error');
          continue;
        }
        
        recordSuccess(targetBaseUrl);
        let errorMessage = `Error from upstream (${response.status})`;
        try {
          const errorData = (await response.json()) as { error?: string; message?: string };
          errorMessage = errorData.error ?? errorData.message ?? errorMessage;
        } catch {
          console.log("");
        }
        
        incrementMetric('successfulRequests');
        incrementRouteMetric(route.prefix, 'successes');
        return next(new ApiError(response.status, errorMessage));
      }

      recordSuccess(targetBaseUrl);
      incrementMetric('successfulRequests');
      incrementRouteMetric(route.prefix, 'successes');
      const data: unknown = await response.json();
      res.status(response.status).json(data);
      return;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        recordFailure(targetBaseUrl);
        incrementMetric('timeouts');
        incrementRouteMetric(route.prefix, 'timeouts');
        lastError = new ApiError(504, 'Gateway Timeout: Upstream did not respond in time');
      } else if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === 'ECONNREFUSED'
      ) {
        recordFailure(targetBaseUrl);
        lastError = new ApiError(502, `Bad Gateway: Cannot reach upstream ${targetBaseUrl}`);
      } else {
        recordFailure(targetBaseUrl);
        lastError = new ApiError(500, error instanceof Error ? error.message : 'Unknown proxy error');
      }

      if (!isSafeToRetry) {
        incrementMetric('failedRequests');
        incrementRouteMetric(route.prefix, 'failures');
        return next(lastError);
      }

      console.warn(`[Proxy] Target ${targetBaseUrl} failed, retrying next...`);
    }
  }

  if (lastError) {
    incrementMetric('failedRequests');
    incrementRouteMetric(route.prefix, 'failures');
    return next(lastError);
  }

  incrementMetric('failedRequests');
  incrementRouteMetric(route.prefix, 'failures');
  return next(new ApiError(503, 'Service Unavailable: All available targets failed during retry'));
};

export default proxyHandler;
