import { Router, Response } from 'express';
import { IsNull } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AppDataSource } from '../utils/database';
import { Folder, File } from '../entities';
import { AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToS3 } from '../utils/s3';

const router = Router({ mergeParams: true });
const folderRepo = () => AppDataSource.getRepository(Folder);
const fileRepo = () => AppDataSource.getRepository(File);

function validateKbId(req: AuthRequest, res: Response): string | null {
  const kbId = req.params.kbId;
  if (!kbId) {
    res.status(400).json({ error: 'Knowledge base ID required' });
    return null;
  }
  return kbId;
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const folders = await folderRepo().find({
      where: { userId: req.userId, knowledgeBaseId: kbId, parentId: IsNull() },
      order: { name: 'ASC' },
    });
    res.json(folders);
  } catch (err) {
    console.error('List root folders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:folderId', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const folder = await folderRepo().findOne({
      where: { id: req.params.folderId, userId: req.userId, knowledgeBaseId: kbId },
    });
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    const path: { id: string; name: string }[] = [];
    let current: Folder | null = folder;
    while (current) {
      path.unshift({ id: current.id, name: current.name });
      if (current.parentId) {
        current = await folderRepo().findOne({ where: { id: current.parentId } });
      } else {
        current = null;
      }
    }

    res.json({ ...folder, path });
  } catch (err) {
    console.error('Get folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:folderId/children', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const children = await folderRepo().find({
      where: { userId: req.userId, knowledgeBaseId: kbId, parentId: req.params.folderId },
      order: { name: 'ASC' },
    });
    res.json(children);
  } catch (err) {
    console.error('List child folders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:folderId/files', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const files = await fileRepo().find({
      where: { userId: req.userId, knowledgeBaseId: kbId, folderId: req.params.folderId },
      relations: ['tags'],
      order: { createdAt: 'DESC' },
    });
    res.json(files);
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const { name, parentId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    if (parentId) {
      const parent = await folderRepo().findOne({
        where: { id: parentId, userId: req.userId, knowledgeBaseId: kbId },
      });
      if (!parent) {
        res.status(404).json({ error: 'Parent folder not found' });
        return;
      }
    }

    const folder = folderRepo().create({
      userId: req.userId!,
      knowledgeBaseId: kbId,
      name,
      parentId: parentId || null,
    });
    await folderRepo().save(folder);
    res.status(201).json(folder);
  } catch (err) {
    console.error('Create folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:folderId/files/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const folder = await folderRepo().findOne({
      where: { id: req.params.folderId, userId: req.userId, knowledgeBaseId: kbId },
    });
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    const ext = req.file.originalname.split('.').pop() || '';
    const s3Key = `uploads/${req.userId}/${uuid()}.${ext}`;
    await uploadToS3(s3Key, req.file.buffer, req.file.mimetype);

    const file = fileRepo().create({
      userId: req.userId!,
      knowledgeBaseId: kbId,
      name: req.body.name || req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      s3Key,
      folderId: req.params.folderId,
    });
    await fileRepo().save(file);
    res.status(201).json(file);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:folderId', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const result = await folderRepo().delete({
      id: req.params.folderId,
      userId: req.userId,
      knowledgeBaseId: kbId,
    });
    if (result.affected === 0) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
