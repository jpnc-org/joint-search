import { Queue } from 'bullmq';
import { env } from './env';

const queue = new Queue('rag-queue', {
  connection: { host: env.REDIS_HOST, port: env.REDIS_PORT },
});

export async function enqueueEmbed(fileId: string): Promise<void> {
  await queue.add('embed', { fileId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

export async function enqueueDelete(fileId: string): Promise<void> {
  await queue.add('delete', { fileId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}
