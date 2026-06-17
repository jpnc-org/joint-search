import 'reflect-metadata';
import express from 'express';
import cookieParser from 'cookie-parser';
import { env } from './utils/env';
import { initializeDatabase } from './utils/database';
import { ensureBucket } from './utils/s3';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import searchRoutes from './routes/search';
import knowledgeBaseRoutes from './routes/knowledgeBases';
import kbFolderRoutes from './routes/kbFolders';
import kbFileRoutes from './routes/kbFiles';
import kbTagRoutes from './routes/kbTags';

async function main() {
  await initializeDatabase();
  await ensureBucket();

  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/conversations', authMiddleware, conversationRoutes);
  app.use('/api/search', authMiddleware, searchRoutes);
  app.use('/api/knowledge-bases', authMiddleware, knowledgeBaseRoutes);
  app.use('/api/knowledge-bases/:kbId/folders', authMiddleware, kbFolderRoutes);
  app.use('/api/knowledge-bases/:kbId/files', authMiddleware, kbFileRoutes);
  app.use('/api/knowledge-bases/:kbId/tags', authMiddleware, kbTagRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(errorHandler);

  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
