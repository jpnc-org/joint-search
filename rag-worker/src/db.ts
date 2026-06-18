import { env } from './env';
import { Pool } from 'pg';

export const db = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
});

interface FileRow {
  id: string;
  user_id: string;
  knowledge_base_id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size: number;
  s3_key: string;
  folder_id: string | null;
  rag_status: string;
}

export async function getFile(fileId: string): Promise<FileRow | null> {
  const result = await db.query('SELECT * FROM files WHERE id = $1', [fileId]);
  return result.rows[0] || null;
}

export async function updateRagStatus(fileId: string, status: string): Promise<void> {
  await db.query('UPDATE files SET rag_status = $1 WHERE id = $2', [status, fileId]);
}

export async function getOrphanedFileIds(): Promise<string[]> {
  const result = await db.query(
    "SELECT id FROM files WHERE rag_status IN ('pending', 'processing', 'failed')"
  );
  return result.rows.map((r: FileRow) => r.id);
}

export async function waitForMigration(timeoutMs: number = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await db.query('SELECT rag_status FROM files LIMIT 0');
      return;
    } catch {
      console.log('Waiting for rag_status migration to complete...');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.warn('Timed out waiting for migration, proceeding anyway');
}
