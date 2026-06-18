import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return val;
}

export const env = {
  REDIS_HOST: required('REDIS_HOST'),
  REDIS_PORT: parseInt(required('REDIS_PORT'), 10),
  QDRANT_HOST: required('QDRANT_HOST'),
  QDRANT_PORT: parseInt(required('QDRANT_PORT'), 10),
  DOCLING_SERVE_URL: required('DOCLING_SERVE_URL'),
  EMBEDDING_API_KEY: required('EMBEDDING_API_KEY'),
  EMBEDDING_BASE_URL: required('EMBEDDING_BASE_URL'),
  EMBEDDING_MODEL: required('EMBEDDING_MODEL'),
  EMBEDDING_DIMS: parseInt(required('EMBEDDING_DIMS'), 10),
  S3_ENDPOINT: required('S3_ENDPOINT'),
  S3_ACCESS_KEY: required('MINIO_ROOT_USER'),
  S3_SECRET_KEY: required('MINIO_ROOT_PASSWORD'),
  S3_BUCKET: required('MINIO_BUCKET'),
  S3_REGION: required('S3_REGION'),
  POSTGRES_USER: required('POSTGRES_USER'),
  POSTGRES_PASSWORD: required('POSTGRES_PASSWORD'),
  POSTGRES_HOST: required('POSTGRES_HOST'),
  POSTGRES_PORT: parseInt(required('POSTGRES_PORT'), 10),
  POSTGRES_DB: required('POSTGRES_DB'),
};
