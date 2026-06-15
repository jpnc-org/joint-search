import { Router, Response } from 'express';
import { AppDataSource } from '../utils/database';
import { Tag } from '../entities';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const tagRepo = () => AppDataSource.getRepository(Tag);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tags = await tagRepo().find({
      where: { userId: req.userId },
      order: { name: 'ASC' },
    });
    res.json(tags);
  } catch (err) {
    console.error('List tags error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const tag = tagRepo().create({
      userId: req.userId!,
      name,
      color: color || '#6366f1',
    });
    await tagRepo().save(tag);
    res.status(201).json(tag);
  } catch (err) {
    console.error('Create tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tag = await tagRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    if (req.body.name !== undefined) tag.name = req.body.name;
    if (req.body.color !== undefined) tag.color = req.body.color;

    await tagRepo().save(tag);
    res.json(tag);
  } catch (err) {
    console.error('Update tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await tagRepo().delete({
      id: req.params.id,
      userId: req.userId,
    });
    if (result.affected === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
