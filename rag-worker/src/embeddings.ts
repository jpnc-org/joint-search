import OpenAI from 'openai';
import { env } from './env';

const client = new OpenAI({
  apiKey: env.EMBEDDING_API_KEY,
  baseURL: env.EMBEDDING_BASE_URL,
});

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 64;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: batch,
    });
    for (const item of response.data) {
      allEmbeddings.push(item.embedding);
    }
  }

  return allEmbeddings;
}
