const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 <= CHUNK_SIZE) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current) {
        chunks.push(...addOverlap(current));
      }
      if (trimmed.length > CHUNK_SIZE) {
        for (let i = 0; i < trimmed.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          chunks.push(trimmed.slice(i, i + CHUNK_SIZE));
        }
        current = '';
      } else {
        current = trimmed;
      }
    }
  }

  if (current) {
    chunks.push(...addOverlap(current));
  }

  return chunks;
}

function addOverlap(text: string): string[] {
  return [text];
}
