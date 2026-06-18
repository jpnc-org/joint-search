import { Router, Response } from 'express';
import { AppDataSource } from '../utils/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string | undefined;
    if (!q || !q.trim()) {
      res.json([]);
      return;
    }

    const results = await AppDataSource.query(
      `SELECT
        m.id AS "messageId",
        m.content,
        m.role,
        m.created_at AS "messageCreatedAt",
        c.id AS "conversationId",
        c.title AS "conversationTitle"
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = $1 AND m.content ILIKE $2
      ORDER BY m.created_at DESC
      LIMIT 50`,
      [req.userId, `%${q}%`]
    );

    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
