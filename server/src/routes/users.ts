import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireEmailVerified);

usersRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = z
      .object({ q: z.string().trim().min(1).max(60), limit: z.coerce.number().min(1).max(20).default(8) })
      .parse(req.query);
    const list = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ email: { contains: q.q } }, { name: { contains: q.q } }],
      },
      take: q.limit,
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    res.json({ list });
  }),
);
