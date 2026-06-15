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
  CORS_ORIGIN: required('CORS_ORIGIN'),
  NODE_ENV: required('NODE_ENV'),
};
