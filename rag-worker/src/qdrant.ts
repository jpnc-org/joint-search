import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from './env';

export const qdrant = new QdrantClient({
  url: `http://${env.QDRANT_HOST}:${env.QDRANT_PORT}`,
});

const COLLECTION = 'file_chunks';

export async function ensureCollection(): Promise<void> {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION);
  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: env.EMBEDDING_DIMS, distance: 'Cosine' },
    });
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: 'file_id',
      field_schema: 'keyword',
    });
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: 'knowledge_base_id',
      field_schema: 'keyword',
    });
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: 'user_id',
      field_schema: 'keyword',
    });
    console.log(`Created Qdrant collection: ${COLLECTION}`);
  }
}

export async function deleteFilePoints(fileId: string): Promise<void> {
  await qdrant.delete(COLLECTION, {
    filter: { must: [{ key: 'file_id', match: { value: fileId } }] },
  });
}

export async function upsertChunks(
  fileId: string,
  knowledgeBaseId: string,
  userId: string,
  fileName: string,
  chunks: string[],
  embeddings: number[][],
): Promise<void> {
  const points = chunks.map((content, i) => ({
    id: cryptoRandomUUID(),
    vector: embeddings[i],
    payload: {
      file_id: fileId,
      knowledge_base_id: knowledgeBaseId,
      user_id: userId,
      file_name: fileName,
      chunk_index: i,
      content,
    },
  }));

  await qdrant.upsert(COLLECTION, { points });
}

function cryptoRandomUUID(): string {
  return crypto.randomUUID();
}

export { COLLECTION };
