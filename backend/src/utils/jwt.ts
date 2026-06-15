import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from './env';

export interface JwtPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRY as any };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function generateRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRY as any };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
