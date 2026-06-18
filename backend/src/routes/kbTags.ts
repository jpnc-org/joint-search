import { Router, Response } from 'express';
import { AppDataSource } from '../utils/database';
import { Tag } from '../entities';
import { AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
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

    const tags = await tagRepo().find({
      where: { userId: req.userId, knowledgeBaseId: kbId },
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
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const { name, color } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const tag = tagRepo().create({
      userId: req.userId!,
      knowledgeBaseId: kbId,
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

router.delete('/:tagId', async (req: AuthRequest, res: Response) => {
  try {
    const kbId = validateKbId(req, res);
    if (!kbId) return;

    const result = await tagRepo().delete({
      id: req.params.tagId,
      userId: req.userId,
      knowledgeBaseId: kbId,
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
