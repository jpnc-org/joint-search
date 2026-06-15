import { Router, Response } from 'express';
import { AppDataSource } from '../utils/database';
import { KnowledgeBase, File } from '../entities';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const kbRepo = () => AppDataSource.getRepository(KnowledgeBase);
const fileRepo = () => AppDataSource.getRepository(File);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const kbs = await kbRepo().find({
      where: { userId: req.userId },
      order: { createdAt: 'DESC' },
    });
    res.json(kbs);
  } catch (err) {
    console.error('List KBs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const kb = kbRepo().create({
      userId: req.userId!,
      name,
      description: description || null,
    });
    await kbRepo().save(kb);
    res.status(201).json(kb);
  } catch (err) {
    console.error('Create KB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const kb = await kbRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
      relations: ['files'],
    });
    if (!kb) {
      res.status(404).json({ error: 'Knowledge base not found' });
      return;
    }
    res.json(kb);
  } catch (err) {
    console.error('Get KB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const kb = await kbRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!kb) {
      res.status(404).json({ error: 'Knowledge base not found' });
      return;
    }
    if (req.body.name !== undefined) kb.name = req.body.name;
    if (req.body.description !== undefined) kb.description = req.body.description;
    await kbRepo().save(kb);
    res.json(kb);
  } catch (err) {
    console.error('Update KB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await kbRepo().delete({
      id: req.params.id,
      userId: req.userId,
    });
    if (result.affected === 0) {
      res.status(404).json({ error: 'Knowledge base not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete KB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/files', async (req: AuthRequest, res: Response) => {
  try {
    const kb = await kbRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
      relations: ['files'],
    });
    if (!kb) {
      res.status(404).json({ error: 'Knowledge base not found' });
      return;
    }

    const { fileIds } = req.body;
    if (!Array.isArray(fileIds)) {
      res.status(400).json({ error: 'fileIds array is required' });
      return;
    }

    const files = await fileRepo().findByIds(fileIds);
    for (const file of files) {
      if (file.userId !== req.userId) continue;
      if (!kb.files.some((f) => f.id === file.id)) {
        kb.files.push(file);
      }
    }
    await kbRepo().save(kb);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Add files to KB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/files/:fileId', async (req: AuthRequest, res: Response) => {
  try {
    const kb = await kbRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
      relations: ['files'],
    });
    if (!kb) {
      res.status(404).json({ error: 'Knowledge base not found' });
      return;
    }

    kb.files = kb.files.filter((f) => f.id !== req.params.fileId);
    await kbRepo().save(kb);
    res.status(204).send();
  } catch (err) {
    console.error('Remove file from KB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
