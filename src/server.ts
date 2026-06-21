import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { ApiError } from './utils/ApiError.js';
import gatewayRouter from './services/gatewayService.js';
import { getHealthSnapshot, initializeHealth, startHealthPolling } from './loadbalancer/healthManager.js';
dotenv.config();

const app = express();
const PORT = process.env['PORT'] ? Number(process.env['PORT']) : 3000;

app.use(express.json());


import routes from './config/routes.js';
import { getHealth } from './loadbalancer/healthManager.js';


initializeHealth(routes);
startHealthPolling(routes);

app.get('/gateway/health', (_req: Request, res: Response) => {
  const snapshot = getHealthSnapshot(routes);
  
  let isDegraded = false;
  for (const route of routes) {
    if (route.targets.some(url => getHealth(url).state !== 'CLOSED')) {
      isDegraded = true;
      break;
    }
  }

  res.json({
    status: isDegraded ? 'degraded' : 'ok',
    routes: snapshot,
  });
});

import { getMetricsSnapshot } from './utils/metrics.js';
import { getUnhealthyCount } from './loadbalancer/healthManager.js';

app.get('/gateway/metrics', (_req: Request, res: Response) => {
  const Services =  Object.entries(getHealthSnapshot(routes));
  //console.log(Services);
  Services.forEach(service=>{
    console.log(service[1])
  })
  res.json({
    ...getMetricsSnapshot(),
    unhealthyTargetsCount: getUnhealthyCount(),
  });
});

app.use('/', gatewayRouter);




app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({success: false,error: err.message});
    return;
  }

  console.error(' Unhandled error:', err);
  res.status(500).json({success: false,error: 'Internal Server Error'});
});

app.listen(PORT, () => {
  console.log(`GATEWAY is running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/gateway/health`);
});

