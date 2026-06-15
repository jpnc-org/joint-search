import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './utils/env';
import { initializeDatabase } from './utils/database';
import { ensureBucket } from './utils/s3';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import fileRoutes from './routes/files';
import folderRoutes from './routes/folders';
import tagRoutes from './routes/tags';
import knowledgeBaseRoutes from './routes/knowledgeBases';

async function main() {
  await initializeDatabase();
  await ensureBucket();

  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Public routes
  app.use('/api/auth', authRoutes);

  // Protected routes
  app.use('/api/conversations', authMiddleware, conversationRoutes);
  app.use('/api/files', authMiddleware, fileRoutes);
  app.use('/api/folders', authMiddleware, folderRoutes);
  app.use('/api/tags', authMiddleware, tagRoutes);
  app.use('/api/knowledge-bases', authMiddleware, knowledgeBaseRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(errorHandler);

  app.listen(env.PORT, () => {
    console.log(`Backend running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
