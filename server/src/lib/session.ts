import crypto from 'node:crypto';
import { prisma } from '../prisma.js';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟节流

const inMemoryTouchTimes = new Map<string, number>();

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface SessionMeta {
  userAgent?: string;
  ipAddr?: string;
  expiresAt?: Date;
}

export async function createSession(userId: string, token: string, meta: SessionMeta) {
  return prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      userAgent: meta.userAgent || null,
      ipAddr: meta.ipAddr || null,
      expiresAt: meta.expiresAt || null,
    },
  });
}

export async function findActiveSessionByToken(token: string) {
  const hash = hashSessionToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash: hash } });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function touchSession(sessionId: string) {
  const last = inMemoryTouchTimes.get(sessionId) || 0;
  if (Date.now() - last < TOUCH_INTERVAL_MS) return;
  inMemoryTouchTimes.set(sessionId, Date.now());
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    // session 可能被并发删除,忽略
  }
}

export async function revokeSession(sessionId: string, userId: string) {
  return prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllOtherSessions(userId: string, exceptSessionId: string) {
  return prisma.session.updateMany({
    where: { userId, revokedAt: null, NOT: { id: exceptSessionId } },
    data: { revokedAt: new Date() },
  });
}

export async function revokeSessionByToken(token: string) {
  const hash = hashSessionToken(token);
  return prisma.session.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function listSessionsForUser(userId: string) {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
    take: 50,
    select: {
      id: true,
      userAgent: true,
      ipAddr: true,
      lastSeenAt: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
}
