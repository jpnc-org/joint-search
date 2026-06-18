import { getFile, updateRagStatus } from '../db';
import { downloadFromS3 } from '../s3';
import { extractText } from '../docling';
import { chunkText } from '../chunking';
import { embedTexts } from '../embeddings';
import { deleteFilePoints, upsertChunks } from '../qdrant';

export async function processEmbedFile(fileId: string): Promise<void> {
  await updateRagStatus(fileId, 'processing');

  const file = await getFile(fileId);
  if (!file) {
    throw new Error(`File not found: ${fileId}`);
  }

  const fileBuffer = await downloadFromS3(file.s3_key);

  const text = await extractText(fileBuffer, file.mime_type, file.original_name);

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await deleteFilePoints(fileId);
    await updateRagStatus(fileId, 'finished');
    return;
  }

  await deleteFilePoints(fileId);

  const embeddings = await embedTexts(chunks);

  await upsertChunks(
    file.id,
    file.knowledge_base_id,
    file.user_id,
    file.name,
    chunks,
    embeddings,
  );

  await updateRagStatus(fileId, 'finished');
}
