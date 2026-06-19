import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return val;
}

export const env = {
  DATABASE_URL: `postgres://${required('POSTGRES_USER')}:${required('POSTGRES_PASSWORD')}@${required('POSTGRES_HOST')}:${required('POSTGRES_PORT')}/${required('POSTGRES_DB')}`,
  JWT_SECRET: required('JWT_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_EXPIRY: required('JWT_EXPIRY'),
  JWT_REFRESH_EXPIRY: required('JWT_REFRESH_EXPIRY'),
  S3_ENDPOINT: required('S3_ENDPOINT'),
  S3_ACCESS_KEY: required('MINIO_ROOT_USER'),
  S3_SECRET_KEY: required('MINIO_ROOT_PASSWORD'),
  S3_BUCKET: required('MINIO_BUCKET'),
  S3_REGION: required('S3_REGION'),
  MAX_FILE_SIZE: parseInt(required('MAX_FILE_SIZE'), 10),
  PORT: parseInt(required('PORT'), 10),
  NODE_ENV: required('NODE_ENV'),
  REDIS_HOST: required('REDIS_HOST'),
  REDIS_PORT: parseInt(required('REDIS_PORT'), 10),
  QDRANT_HOST: required('QDRANT_HOST'),
  QDRANT_PORT: parseInt(required('QDRANT_PORT'), 10),
  EMBEDDING_API_KEY: required('EMBEDDING_API_KEY'),
  EMBEDDING_BASE_URL: required('EMBEDDING_BASE_URL'),
  EMBEDDING_MODEL: required('EMBEDDING_MODEL'),
  EMBEDDING_DIMS: parseInt(required('EMBEDDING_DIMS'), 10),
  AGENTS_API_URL: required('AGENTS_API_URL'),
};
