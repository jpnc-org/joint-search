import OpenAI from 'openai';
import { env } from './env';

const client = new OpenAI({
  apiKey: env.EMBEDDING_API_KEY,
  baseURL: env.EMBEDDING_BASE_URL,
});

export async function embedQuery(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: env.EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}
