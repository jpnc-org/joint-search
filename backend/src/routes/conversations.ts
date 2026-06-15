import { Router, Response } from 'express';
import { AppDataSource } from '../utils/database';
import { Conversation, Message } from '../entities';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const convRepo = () => AppDataSource.getRepository(Conversation);
const msgRepo = () => AppDataSource.getRepository(Message);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await convRepo().find({
      where: { userId: req.userId },
      order: { updatedAt: 'DESC' },
    });
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

    const { content, fileMentions } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const userMessage = msgRepo().create({
      conversationId: conversation.id,
      role: 'user',
      content,
      metadata: fileMentions ? { fileMentions } : null,
    });
    await msgRepo().save(userMessage);

    // SSE stream response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Placeholder: forward to model service
    // For now, echo back a placeholder response
    const placeholderResponse =
      'This is a placeholder response. The model integration will be connected separately.';
    const words = placeholderResponse.split(' ');

    for (let i = 0; i < words.length; i++) {
      const word = (i > 0 ? ' ' : '') + words[i];
      res.write(`event: token\ndata: ${JSON.stringify({ token: word })}\n\n`);
      await new Promise((r) => setTimeout(r, 50));
    }

    const assistantMessage = msgRepo().create({
      conversationId: conversation.id,
      role: 'assistant',
      content: placeholderResponse,
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
