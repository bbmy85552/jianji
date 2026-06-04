import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sid?: string;
}

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
