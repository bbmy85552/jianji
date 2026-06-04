import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { expandCalendarEvents, normalizeRepeatRule } from '../lib/calendarRepeat.js';

export const calendarRouter = Router();
calendarRouter.use(requireAuth, requireEmailVerified);

const eventInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  startAt: z.string(),
  endAt: z.string(),
  allDay: z.boolean().optional(),
  location: z.string().max(120).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  reminderMinutes: z.number().int().min(0).max(60 * 24 * 14).nullable().optional(),
  relatedTodoId: z.string().nullable().optional(),
  repeatRule: z.enum(['none', 'daily', 'weekly', 'monthly']).nullable().optional(),
});

function parseDate(s: string, label: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${label} 时间格式无效`, 'INVALID');
  return d;
}

calendarRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query);
    const from = q.from ? parseDate(q.from, 'from') : undefined;
    const to = q.to ? parseDate(q.to, 'to') : undefined;
    const list = await prisma.calendarEvent.findMany({
      where: {
        userId: req.user!.id,
        ...(to ? { startAt: { lte: to } } : {}),
      },
      orderBy: { startAt: 'asc' },
      take: 1000,
    });
    res.json({ list: expandCalendarEvents(list, from, to).slice(0, 500) });
  }),
);

calendarRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = eventInput.parse(req.body);
    const startAt = parseDate(body.startAt, '开始');
    const endAt = parseDate(body.endAt, '结束');
    if (endAt < startAt) throw new HttpError(400, '结束时间不能早于开始时间', 'INVALID');
    const event = await prisma.calendarEvent.create({
      data: {
        userId: req.user!.id,
        title: body.title,
        description: body.description ?? null,
        startAt,
        endAt,
        allDay: body.allDay ?? false,
        location: body.location ?? null,
        color: body.color ?? null,
        reminderMinutes: body.reminderMinutes ?? null,
        relatedTodoId: body.relatedTodoId ?? null,
        repeatRule: normalizeRepeatRule(body.repeatRule) ?? null,
      },
    });
    res.json({ event });
  }),
);

calendarRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const target = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!target || target.userId !== req.user!.id) {
      throw new HttpError(404, '日程不存在', 'NOT_FOUND');
    }
    const body = eventInput.partial().parse(req.body);
    const data: Record<string, unknown> = { ...body };
    if (body.startAt) data.startAt = parseDate(body.startAt, '开始');
    if (body.endAt) data.endAt = parseDate(body.endAt, '结束');
    if (body.repeatRule !== undefined) data.repeatRule = normalizeRepeatRule(body.repeatRule) ?? null;
    const nextStart = (data.startAt as Date | undefined) ?? target.startAt;
    const nextEnd = (data.endAt as Date | undefined) ?? target.endAt;
    if (nextEnd < nextStart) {
      throw new HttpError(400, '结束时间不能早于开始时间', 'INVALID');
    }
    const event = await prisma.calendarEvent.update({
      where: { id: target.id },
      data,
    });
    res.json({ event });
  }),
);

calendarRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const target = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!target || target.userId !== req.user!.id) {
      throw new HttpError(404, '日程不存在', 'NOT_FOUND');
    }
    await prisma.calendarEvent.delete({ where: { id: target.id } });
    res.json({ ok: true });
  }),
);
