import type { RouteConfig } from '../types/gateway.js';

const routes: RouteConfig[] = [
  {
    prefix: '/orders',
    auth: true,
    targets: [
      { url: 'http://localhost:3001', healthy: true, failures: 0, lastFailureTime: null },
      { url: 'http://localhost:3002', healthy: true, failures: 0, lastFailureTime: null },
      { url: 'http://localhost:3003', healthy: true, failures: 0, lastFailureTime: null },
    ],
    ratelimit: {
      windowMs: 60 * 1000,
      max: 20,
      message: 'Too many requests to /orders, please try again later.',
    },
  },
  {
    prefix: '/auth',
    auth: false,
    targets: [
      { url: 'http://localhost:5001', healthy: true, failures: 0, lastFailureTime: null },
      { url: 'http://localhost:5002', healthy: true, failures: 0, lastFailureTime: null },
      { url: 'http://localhost:5003', healthy: true, failures: 0, lastFailureTime: null },
    ],
    ratelimit: {
      windowMs: 60 * 1000,
      max: 5, 
      message: 'Too many auth requests, please try again later.',
    },
  },
  {
    prefix: '/products',
    auth: false,
    targets: [
      { url: 'http://localhost:4001', healthy: true, failures: 0, lastFailureTime: null },
      { url: 'http://localhost:4002', healthy: true, failures: 0, lastFailureTime: null },
      { url: 'http://localhost:4003', healthy: true, failures: 0, lastFailureTime: null },
    ],
    ratelimit: {
      windowMs: 60 * 1000,
      max: 50,
      message: 'Too many requests to /products, please try again later.',
    },
  },
];

export default routes;
