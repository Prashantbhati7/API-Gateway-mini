import type { RouteConfig } from '../types/gateway.js';

const routes: RouteConfig[] = [
  {
    prefix: '/orders',
    auth: true,
    targets: ['http://localhost:3001','http://localhost:3002','http://localhost:3003'],
    ratelimit: {
      windowMs: 60 * 1000,
      max: 20,
      message: 'Too many requests to /orders, please try again later.',
    },
  },
  {
    prefix: '/auth',
    auth: false,
    targets: ['http://localhost:5001','http://localhost:5002','http://localhost:5003'],
    ratelimit: {
      windowMs: 60 * 1000,
      max: 5, 
      message: 'Too many auth requests, please try again later.',
    },
  },
  {
    prefix: '/products',
    auth: false,
    targets: ['http://localhost:4001','http://localhost:4002','http://localhost:4003'],
    ratelimit: {
      windowMs: 60 * 1000,
      max: 50,
      message: 'Too many requests to /products, please try again later.',
    },
  },
];

export default routes;
