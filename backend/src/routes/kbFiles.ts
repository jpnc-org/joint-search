import { Router, Response } from 'express';
import { IsNull } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AppDataSource } from '../utils/database';
import { File, Tag } from '../entities';
import { AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToS3, deleteFromS3 } from '../utils/s3';
import { enqueueEmbed, enqueueDelete } from '../utils/queue';

const router = Router({ mergeParams: true });
const fileRepo = () => AppDataSource.getRepository(File);
const tagRepo = () => AppDataSource.getRepository(Tag);

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

    const files = await fileRepo().find({
      where: { userId: req.userId, knowledgeBaseId: kbId, folderId: IsNull() },
      relations: ['tags'],
      order: { createdAt: 'DESC' },
    });
    res.json(files);
  } catch (err) {
    console.error('List root files error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
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
      folderId: req.body.folderId || null,
    });
    await fileRepo().save(file);
    await enqueueEmbed(file.id);
    res.status(201).json(file);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:fileId', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const file = await fileRepo().findOne({
      where: { id: req.params.fileId, userId: req.userId, knowledgeBaseId: kbId },
    });
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    await deleteFromS3(file.s3Key);
    await fileRepo().remove(file);
    await enqueueDelete(file.id);
    res.status(204).send();
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:fileId/tags', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const file = await fileRepo().findOne({
      where: { id: req.params.fileId, userId: req.userId, knowledgeBaseId: kbId },
      relations: ['tags'],
    });
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const tag = await tagRepo().findOne({
      where: { id: req.body.tagId, userId: req.userId, knowledgeBaseId: kbId },
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

router.delete('/:fileId/tags/:tagId', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const file = await fileRepo().findOne({
      where: { id: req.params.fileId, userId: req.userId, knowledgeBaseId: kbId },
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
