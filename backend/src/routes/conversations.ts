import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { AppDataSource } from '../utils/database';
import { Conversation, Message } from '../entities';
import { AuthRequest } from '../middleware/auth';
import { env } from '../utils/env';
import { postResearch } from '../utils/agentsClient';

const router = Router();
const convRepo = () => AppDataSource.getRepository(Conversation);
const msgRepo = () => AppDataSource.getRepository(Message);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string | undefined;
    const qb = convRepo().createQueryBuilder('conv')
      .where('conv.userId = :userId', { userId: req.userId })
      .orderBy('conv.updatedAt', 'DESC');
    if (q) {
      qb.andWhere(
        `(conv.title ILIKE :q OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = conv.id AND m.content ILIKE :q))`,
        { q: `%${q}%` }
      );
    }
    const conversations = await qb.getMany();
    res.json(conversations);
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const conversation = convRepo().create({
      userId: req.userId!,
      title: title || 'New Conversation',
      capabilities: {
        code_interpreter: false,
        rlm: false,
        rag: false,
        web_search: false,
      },
    });
    await convRepo().save(conversation);
    res.status(201).json(conversation);
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await convRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conversation);
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await convRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    if (req.body.title !== undefined) conversation.title = req.body.title;
    if (req.body.capabilities !== undefined) {
      conversation.capabilities = {
        ...conversation.capabilities,
        ...req.body.capabilities,
      };
    }

    await convRepo().save(conversation);
    res.json(conversation);
  } catch (err) {
    console.error('Update conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await convRepo().delete({
      id: req.params.id,
      userId: req.userId,
    });
    if (result.affected === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await convRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const messages = await msgRepo().find({
      where: { conversationId: req.params.id },
      order: { createdAt: 'ASC' },
    });
    res.json(messages);
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await convRepo().findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { content, ragTargets } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const userMessage = msgRepo().create({
      conversationId: conversation.id,
      role: 'user',
      content,
      metadata: ragTargets ? { ragTargets } : null,
    });
    await msgRepo().save(userMessage);

    // SSE stream response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendSSE = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const requestId = uuid();

    try {
      sendSSE('reasoning', { token: 'Coordinating research agents…' });

      const research = await postResearch(env.AGENTS_API_URL, {
        request_id: requestId,
        task: content,
      });

      const answerText = research.answer ?? '';
      const reasoningText = `Researched via ${research.source ?? 'agents'} (status: ${research.status ?? 'unknown'}).`;

      sendSSE('reasoning', { token: reasoningText });

      const words = answerText.split(/(\s+)/);
      for (const word of words) {
        if (word) {
          sendSSE('token', { token: word });
          await new Promise((r) => setTimeout(r, 15));
        }
      }

      const assistantMessage = msgRepo().create({
        conversationId: conversation.id,
        role: 'assistant',
        reasoning: reasoningText,
        content: answerText,
        metadata: {
          research: {
            requestId: research.request_id,
            status: research.status,
            source: research.source,
          },
        },
      });
      await msgRepo().save(assistantMessage);

      sendSSE('done', { messageId: assistantMessage.id });
    } catch (err) {
      console.error('Research request failed:', err);
      const message =
        err instanceof Error ? err.message : 'Research request failed.';
      sendSSE('error', { error: message });
    } finally {
      res.end();
    }
  } catch (err) {
    console.error('Send message error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.end();
    }
  }
});

export default router;
