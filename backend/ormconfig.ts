import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  User,
  Conversation,
  Message,
  Folder,
  File,
  Tag,
  KnowledgeBase,
} from './src/entities';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  entities: [User, Conversation, Message, Folder, File, Tag, KnowledgeBase],
  migrations: ['src/migrations/*.ts'],
});
