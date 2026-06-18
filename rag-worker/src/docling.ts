import { env } from './env';

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);

export async function extractText(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (TEXT_MIME_TYPES.has(mimeType)) {
    return fileBuffer.toString('utf-8');
  }

  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, 'document');
  formData.append(
    'options',
    JSON.stringify({ to_formats: ['markdown'] }),
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const response = await fetch(
      `${env.DOCLING_SERVE_URL}/v1alpha/convert/source`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Docling ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    const markdown = data.document?.md_content;
    if (!markdown) {
      throw new Error('Docling returned no markdown content');
    }
    return markdown;
  } finally {
    clearTimeout(timeout);
  }
}
