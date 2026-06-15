import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { AppDataSource } from '../utils/database';
import { File, Tag } from '../entities';
import { AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToS3, deleteFromS3 } from '../utils/s3';

const router = Router();
const fileRepo = () => AppDataSource.getRepository(File);

router.post(
  '/upload',
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const ext = req.file.originalname.split('.').pop() || '';
      const s3Key = `uploads/${req.userId}/${uuid()}.${ext}`;

      await uploadToS3(s3Key, req.file.buffer, req.file.mimetype);

      const file = fileRepo().create({
        userId: req.userId!,
        name: req.body.name || req.file.originalname,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        s3Key,
        folderId: req.body.folderId || null,
      });
      await fileRepo().save(file);

      res.status(201).json(file);
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const where: any = { userId: req.userId };
    if (req.query.folderId) where.folderId = req.query.folderId;

    const files = await fileRepo().find({
      where,
      relations: ['tags'],
      order: { createdAt: 'DESC' },
    });
    res.json(files);
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const file = await fileRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
      relations: ['tags'],
    });
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.json(file);
  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const file = await fileRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    if (req.body.name !== undefined) file.name = req.body.name;
    if (req.body.folderId !== undefined) file.folderId = req.body.folderId;

    await fileRepo().save(file);
    res.json(file);
  } catch (err) {
    console.error('Update file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const file = await fileRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    await deleteFromS3(file.s3Key);
    await fileRepo().remove(file);
    res.status(204).send();
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/tags', async (req: AuthRequest, res: Response) => {
  try {
    const file = await fileRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
      relations: ['tags'],
    });
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const tagRepo = AppDataSource.getRepository(Tag);
    const tag = await tagRepo.findOne({
      where: { id: req.body.tagId, userId: req.userId },
    });
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    if (!file.tags.some((t) => t.id === tag.id)) {
      file.tags.push(tag);
      await fileRepo().save(file);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Add tag to file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/tags/:tagId', async (req: AuthRequest, res: Response) => {
  try {
    const file = await fileRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
      relations: ['tags'],
    });
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    file.tags = file.tags.filter((t) => t.id !== req.params.tagId);
    await fileRepo().save(file);
    res.status(204).send();
  } catch (err) {
    console.error('Remove tag from file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
