import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { env } from './env';

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export async function downloadFromS3(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key })
  );
  const bytes = await response.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
