import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../utils/database';
import { User } from '../entities';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    const existing = await userRepo().findOne({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = userRepo().create({ email, passwordHash, name });
    await userRepo().save(user);

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await userRepo().findOne({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepo().findOne({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const payload = verifyRefreshToken(token);
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
    });

    res.json({ accessToken: newAccessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('refreshToken');
  res.json({ ok: true });
});

export default router;
