import IORedis from 'ioredis';
import { env } from './env';

export const redis = new IORedis(env.REDIS_PORT, env.REDIS_HOST, {
  maxRetriesPerRequest: null,
});
