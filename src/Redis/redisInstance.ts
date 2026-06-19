import { Redis } from 'ioredis';
const RedisClient = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

export default RedisClient;