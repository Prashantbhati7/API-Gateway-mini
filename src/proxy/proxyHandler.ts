import type { Request, Response, NextFunction } from 'express';
import { roundRobin } from '../loadbalancer/roundRobin.js';
import { recordSuccess, recordFailure } from '../loadbalancer/healthManager.js';
import { ApiError } from '../utils/ApiError.js';
import type { ServiceInstance } from '../types/gateway.js';

import { PROXY_TIMEOUT_MS } from '../config/other_Configs.js';



const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);       // safe to retry 


const proxyHandler = async (req: Request,res: Response,next: NextFunction): Promise<void> => {
  const route = req.routeConfig;
  if (!route) {
    return next(new ApiError(500, 'Proxy handler called without routeConfig'));
  }
  const healthyTargets = route.targets.filter((t) => t.healthy);

  if (healthyTargets.length === 0) {
    return next(new ApiError(503, 'Service Unavailable: All upstream targets are down'));
  }

  const isSafeToRetry = SAFE_METHODS.has(req.method);

  const attempts = isSafeToRetry ? healthyTargets.length : 1;

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

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const requestBody: BodyInit | null = hasBody ? JSON.stringify(req.body ?? {}) : null;

  if (hasBody) {
    forwardedHeaders['content-type'] = forwardedHeaders['content-type'] ?? 'application/json';
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const currentlyHealthy = healthyTargets.filter(t => t.healthy);
    if (currentlyHealthy.length === 0) {
        break;
    }
    const instance = roundRobin(currentlyHealthy, route.prefix);
    const targetUrl = instance.url + req.originalUrl;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, PROXY_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {method: req.method,headers: forwardedHeaders,
        body: requestBody,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        recordSuccess(instance);
        let errorMessage = `Error from upstream (${response.status})`;
        try {
          const errorData = (await response.json()) as { error?: string; message?: string };
          errorMessage = errorData.error ?? errorData.message ?? errorMessage;
        } catch {
            console.log("")
        }
        
        return next(new ApiError(response.status, errorMessage));
      }

      recordSuccess(instance);
      const data: unknown = await response.json();
      res.status(response.status).json(data);
      return; 

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        recordFailure(instance);
        lastError = new ApiError(504, 'Gateway Timeout: Upstream did not respond in time');
      } else if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === 'ECONNREFUSED'
      ) {
        recordFailure(instance);
        lastError = new ApiError(502, `Bad Gateway: Cannot reach upstream ${instance.url}`);
      } else {
        recordFailure(instance);
        lastError = new ApiError(500, error instanceof Error ? error.message : 'Unknown proxy error');
      }

      if (!isSafeToRetry) {
        return next(lastError);
      }
      
      console.warn(`[Proxy] Target ${instance.url} failed, retrying next...`);
    }
  }
  if (lastError) {
    return next(lastError);
  }

  return next(new ApiError(503, 'Service Unavailable: All healthy targets failed during retry'));
};

export default proxyHandler;
