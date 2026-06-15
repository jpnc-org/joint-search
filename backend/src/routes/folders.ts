import { Router, Response } from 'express';
import { AppDataSource } from '../utils/database';
import { Folder, Tag } from '../entities';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const folderRepo = () => AppDataSource.getRepository(Folder);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const where: any = { userId: req.userId };
    if (req.query.parentId) {
      where.parentId = req.query.parentId;
    } else if (!req.query.parentId && req.query.root === 'true') {
      where.parentId = null;
    }

    const folders = await folderRepo().find({
      where,
      relations: ['tags'],
      order: { name: 'ASC' },
    });
    res.json(folders);
  } catch (err) {
    console.error('List folders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tree', async (req: AuthRequest, res: Response) => {
  try {
    const folders = await folderRepo().find({
      where: { userId: req.userId },
      relations: ['tags', 'files'],
      order: { name: 'ASC' },
    });
    res.json(folders);
  } catch (err) {
    console.error('Get folder tree error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    if (parentId) {
      const parent = await folderRepo().findOne({
        where: { id: parentId, userId: req.userId },
      });
      if (!parent) {
        res.status(404).json({ error: 'Parent folder not found' });
        return;
      }
    }

    const folder = folderRepo().create({
      userId: req.userId!,
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

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const folder = await folderRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    if (req.body.name !== undefined) folder.name = req.body.name;
    if (req.body.parentId !== undefined) folder.parentId = req.body.parentId;

    await folderRepo().save(folder);
    res.json(folder);
  } catch (err) {
    console.error('Update folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await folderRepo().delete({
      id: req.params.id,
      userId: req.userId,
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

router.post('/:id/tags', async (req: AuthRequest, res: Response) => {
  try {
    const folder = await folderRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
      relations: ['tags'],
    });
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
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

    if (!folder.tags.some((t) => t.id === tag.id)) {
      folder.tags.push(tag);
      await folderRepo().save(folder);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Add tag to folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/tags/:tagId', async (req: AuthRequest, res: Response) => {
  try {
    const folder = await folderRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
      relations: ['tags'],
    });
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    folder.tags = folder.tags.filter((t) => t.id !== req.params.tagId);
    await folderRepo().save(folder);
    res.status(204).send();
  } catch (err) {
    console.error('Remove tag from folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
