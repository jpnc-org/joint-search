import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from './env';

export const qdrant = new QdrantClient({
  url: `http://${env.QDRANT_HOST}:${env.QDRANT_PORT}`,
});

const COLLECTION = 'file_chunks';

export async function ensureQdrantCollection(): Promise<void> {
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

export { COLLECTION };
