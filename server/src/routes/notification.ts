import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { getUnreadCount } from '../lib/notify.js';

export const notificationRouter = Router();
notificationRouter.use(requireAuth, requireEmailVerified);

notificationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(20),
        unreadOnly: z.coerce.boolean().optional(),
      })
      .parse(req.query);
    const where = {
      userId: req.user!.id,
      ...(q.unreadOnly ? { readAt: null } : {}),
    };
    const [total, list] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    res.json({ list, total, page: q.page, pageSize: q.pageSize });
  }),
);

notificationRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await getUnreadCount(req.user!.id);
    res.json({ count });
  }),
);

notificationRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const item = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!item || item.userId !== req.user!.id) {
      throw new HttpError(404, '通知不存在', 'NOT_FOUND');
    }
    if (!item.readAt) {
      await prisma.notification.update({
        where: { id: item.id },
        data: { readAt: new Date() },
      });
    }
    res.json({ ok: true });
  }),
);

notificationRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

notificationRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!item || item.userId !== req.user!.id) {
      throw new HttpError(404, '通知不存在', 'NOT_FOUND');
    }
    await prisma.notification.delete({ where: { id: item.id } });
    res.json({ ok: true });
  }),
);
