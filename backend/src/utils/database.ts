import 'reflect-metadata';
import path from 'path';
import { DataSource } from 'typeorm';
import { env } from './env';
import {
  User,
  Conversation,
  Message,
  Folder,
  File,
  Tag,
  KnowledgeBase,
} from '../entities';

const isCompiled = __filename.endsWith('.js');
const migrationsPath = isCompiled
  ? path.join(__dirname, '..', 'migrations', '*{.js,.ts}')
  : path.join(__dirname, '..', 'migrations', '*.ts');

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: false,
  logging: env.NODE_ENV === 'development',
  entities: [User, Conversation, Message, Folder, File, Tag, KnowledgeBase],
  migrations: [migrationsPath],
});

let initialized = false;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  await AppDataSource.initialize();
  console.log('Database connected, running migrations...');
  await AppDataSource.runMigrations();
  console.log('Migrations complete');
  initialized = true;
}
