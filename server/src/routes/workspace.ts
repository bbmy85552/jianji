import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth, requireEmailVerified);

workspaceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await prisma.workspace.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { createdAt: 'asc' },
    });
    if (list.length === 0) {
      const created = await prisma.workspace.create({
        data: { name: `${req.user!.name} 的空间`, ownerId: req.user!.id },
      });
      res.json({ list: [created] });
      return;
    }
    res.json({ list });
  }),
);

workspaceRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1).max(40) }).parse(req.body);
    const created = await prisma.workspace.create({
      data: { name: body.name, ownerId: req.user!.id },
    });
    res.json({ workspace: created });
  }),
);
