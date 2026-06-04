import type { Response } from 'express';
import { env } from '../env.js';

export function setAuthCookie(res: Response, token: string) {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(env.COOKIE_NAME, { path: '/' });
}
