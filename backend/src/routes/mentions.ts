import { Router, Response } from 'express';
import { IsNull, Like } from 'typeorm';
import { AppDataSource } from '../utils/database';
import { KnowledgeBase, Tag, File, Folder } from '../entities';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const kbRepo = () => AppDataSource.getRepository(KnowledgeBase);
const tagRepo = () => AppDataSource.getRepository(Tag);
const fileRepo = () => AppDataSource.getRepository(File);
const folderRepo = () => AppDataSource.getRepository(Folder);

interface MentionItem {
  id: string;
  type: 'knowledge-base' | 'tag' | 'file';
  name: string;
  path: string;
  kbId: string;
  kbName: string;
}

async function buildFolderPath(folderId: string): Promise<string> {
  const segments: string[] = [];
  let current: Folder | null = await folderRepo().findOne({ where: { id: folderId } });
  while (current) {
    segments.unshift(current.name);
    if (current.parentId) {
      current = await folderRepo().findOne({ where: { id: current.parentId } });
    } else {
      current = null;
    }
  }
  return segments.join('/');
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim().toLowerCase();
    const results: MentionItem[] = [];

    const kbs = await kbRepo().find({
      where: { userId: req.userId },
      order: { name: 'ASC' },
    });

    for (const kb of kbs) {
      if (q && !kb.name.toLowerCase().includes(q)) continue;

      results.push({
        id: kb.id,
        type: 'knowledge-base',
        name: kb.name,
        path: kb.name,
        kbId: kb.id,
        kbName: kb.name,
      });

      const tags = await tagRepo().find({
        where: { userId: req.userId, knowledgeBaseId: kb.id },
        order: { name: 'ASC' },
      });
      for (const tag of tags) {
        if (q && !tag.name.toLowerCase().includes(q)) continue;
        results.push({
          id: tag.id,
          type: 'tag',
          name: tag.name,
          path: `${kb.name}/${tag.name}`,
          kbId: kb.id,
          kbName: kb.name,
        });
      }

      const files = await fileRepo().find({
        where: { userId: req.userId, knowledgeBaseId: kb.id },
        order: { name: 'ASC' },
      });
      for (const file of files) {
        if (q && !file.name.toLowerCase().includes(q)) continue;
        const folderPath = file.folderId ? await buildFolderPath(file.folderId) : '';
        const filePath = folderPath ? `${folderPath}/${file.name}` : file.name;
        results.push({
          id: file.id,
          type: 'file',
          name: file.name,
          path: `${kb.name}/${filePath}`,
          kbId: kb.id,
          kbName: kb.name,
        });
      }
    }

    res.json(results.slice(0, 50));
  } catch (err) {
    console.error('Mentions search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
