import 'reflect-metadata';
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

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: env.NODE_ENV === 'development',
  logging: env.NODE_ENV === 'development',
  entities: [User, Conversation, Message, Folder, File, Tag, KnowledgeBase],
  migrations: ['src/migrations/*.ts'],
});

let initialized = false;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  await AppDataSource.initialize();
  initialized = true;
  console.log('Database connected');
}
