import { Router, Response } from 'express';
import { AppDataSource } from '../utils/database';
import { Conversation, Message } from '../entities';
import { AuthRequest } from '../middleware/auth';

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

    // Placeholder: forward to model service
    // For now, stream a mock reasoning + answer response
    const reasoningText =
      'The user is asking about ' + content.slice(0, 60) + '. Let me analyze this step by step. ' +
      'First, I need to consider the key aspects of this question. ' +
      'There are several factors at play here that I should examine carefully. ' +
      'Looking at the available information, I can identify the most relevant points. ' +
      'After careful consideration of all the evidence and context, I am ready to form a comprehensive answer.';

    const answerText =
      'Based on my analysis, here is what I found:\n\n' +
      'The topic you raised involves multiple dimensions that are worth exploring. ' +
      'At its core, the question touches on fundamental concepts that have been widely discussed in the field. ' +
      'The key insight is that there is no single definitive answer — rather, it depends on the specific context and constraints involved.\n\n' +
      'Here are the main points to consider:\n\n' +
      '**1. Context Matters** — The answer can vary significantly depending on the specific scenario and requirements. ' +
      'What works in one situation may not be optimal in another.\n\n' +
      '**2. Trade-offs** — There are inherent trade-offs between different approaches. ' +
      'Balancing these competing factors is essential for reaching a well-informed conclusion.\n\n' +
      '**3. Evidence-Based** — The best approach is to rely on empirical evidence and established principles ' +
      'rather than assumptions. This ensures a more reliable and reproducible outcome.\n\n' +
      'In summary, while there are several valid perspectives on this topic, ' +
      'the most practical approach would be to start with a clear understanding of your specific goals, ' +
      'then evaluate the available options against those criteria. ' +
      'This structured approach will help you arrive at the best possible decision.';

    const reasoningWords = reasoningText.split(' ');
    for (let i = 0; i < reasoningWords.length; i++) {
      const word = (i > 0 ? ' ' : '') + reasoningWords[i];
      res.write(`event: reasoning\ndata: ${JSON.stringify({ token: word })}\n\n`);
      await new Promise((r) => setTimeout(r, 30));
    }

    const answerWords = answerText.split(' ');
    for (let i = 0; i < answerWords.length; i++) {
      const word = (i > 0 ? ' ' : '') + answerWords[i];
      res.write(`event: token\ndata: ${JSON.stringify({ token: word })}\n\n`);
      await new Promise((r) => setTimeout(r, 30));
    }

    const assistantMessage = msgRepo().create({
      conversationId: conversation.id,
      role: 'assistant',
      reasoning: reasoningText,
      content: answerText,
    });
    await msgRepo().save(assistantMessage);

    res.write(
      `event: done\ndata: ${JSON.stringify({ messageId: assistantMessage.id })}\n\n`
    );
    res.end();
  } catch (err) {
    console.error('Send message error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: 'Internal server error' })}\n\n`
      );
      res.end();
    }
  }
});

export default router;
