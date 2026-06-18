import { deleteFilePoints } from '../qdrant';

export async function processDeleteFile(fileId: string): Promise<void> {
  await deleteFilePoints(fileId);
}
