import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

export const presenceRouter = Router();
presenceRouter.use(requireAuth, requireEmailVerified);

const ACTIVE_WINDOW_MS = 30_000;

presenceRouter.post(
  '/heartbeat',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        resourceType: z.enum(['doc', 'table']),
        resourceId: z.string(),
      })
      .parse(req.body);
    await prisma.resourcePresence.upsert({
      where: {
        resourceType_resourceId_userId: {
          resourceType: body.resourceType,
          resourceId: body.resourceId,
          userId: req.user!.id,
        },
      },
      update: { lastSeenAt: new Date() },
      create: {
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        userId: req.user!.id,
      },
    });
    const active = await prisma.resourcePresence.findMany({
      where: {
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        lastSeenAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 20,
    });
    res.json({
      participants: active.map((p) => ({ ...p.user, lastSeenAt: p.lastSeenAt })),
    });
  }),
);
