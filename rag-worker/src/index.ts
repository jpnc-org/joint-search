import 'reflect-metadata';
import { Worker, Queue } from 'bullmq';
import { env } from './env';
import { ensureCollection } from './qdrant';
import { getOrphanedFileIds, updateRagStatus, waitForMigration } from './db';
import { processEmbedFile } from './processors/embedFile';
import { processDeleteFile } from './processors/deleteFile';

const QUEUE_NAME = 'rag-queue';
const connection = { host: env.REDIS_HOST, port: env.REDIS_PORT };

async function main() {
  await ensureCollection();
  console.log('Qdrant collection ready');

  await waitForMigration();
  console.log('Database schema ready');

  const queue = new Queue(QUEUE_NAME, { connection });

  const orphanIds = await getOrphanedFileIds();
  if (orphanIds.length > 0) {
    console.log(`Re-enqueuing ${orphanIds.length} orphaned file(s)`);
    for (const fileId of orphanIds) {
      await queue.add('embed', { fileId }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      });
    }
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { fileId } = job.data;

      if (job.name === 'embed') {
        console.log(`[embed] Processing file: ${fileId}`);
        await processEmbedFile(fileId);
        console.log(`[embed] Finished file: ${fileId}`);
      } else if (job.name === 'delete') {
        console.log(`[delete] Removing points for file: ${fileId}`);
        await processDeleteFile(fileId);
        console.log(`[delete] Finished file: ${fileId}`);
      }
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { fileId } = job.data;
    console.error(`[worker] Job ${job.name} failed for ${fileId}:`, err.message);

    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      await updateRagStatus(fileId, 'failed');
      console.error(`[worker] All retries exhausted for ${fileId}, marked as failed`);
    }
  });

  worker.on('error', (err) => {
    console.error('[worker] Worker error:', err);
  });

  console.log('RAG worker started, waiting for jobs...');
}

main().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
