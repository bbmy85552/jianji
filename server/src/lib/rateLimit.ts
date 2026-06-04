import { prisma } from '../prisma.js';

export interface WindowQuery {
  scope: string;
  key: string;
  windowSeconds: number;
}

export async function countInWindow({ scope, key, windowSeconds }: WindowQuery) {
  const since = new Date(Date.now() - windowSeconds * 1000);
  return prisma.rateLimitEvent.count({
    where: { scope, key, createdAt: { gte: since } },
  });
}

export async function lastInWindow({ scope, key }: { scope: string; key: string }) {
  return prisma.rateLimitEvent.findFirst({
    where: { scope, key },
    orderBy: { createdAt: 'desc' },
  });
}

export async function recordEvent(scope: string, key: string) {
  await prisma.rateLimitEvent.create({ data: { scope, key } });
}

export async function cleanupOldEvents(scope: string, key: string, keepSeconds: number) {
  const cutoff = new Date(Date.now() - keepSeconds * 1000);
  await prisma.rateLimitEvent.deleteMany({
    where: { scope, key, createdAt: { lt: cutoff } },
  });
}
