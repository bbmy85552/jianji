import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

export const fontRouter = Router();
fontRouter.use(requireAuth, requireEmailVerified);

export const BUILTIN_FONTS = [
  {
    family: 'Hanken Grotesk',
    license: 'SIL Open Font License 1.1',
    licenseUrl: 'https://github.com/marcologous/hanken-grotesk/blob/master/OFL.txt',
    usage: '正文与界面默认无衬线字体',
  },
  {
    family: 'Source Serif 4',
    license: 'SIL Open Font License 1.1',
    licenseUrl: 'https://github.com/adobe-fonts/source-serif/blob/release/LICENSE.md',
    usage: '标题与展示型衬线字体',
  },
];

fontRouter.get(
  '/builtin',
  asyncHandler(async (_req, res) => {
    res.json({ list: BUILTIN_FONTS });
  }),
);

fontRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await prisma.userFont.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ list });
  }),
);

fontRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        family: z.string().trim().min(1).max(60),
        source: z.string().trim().min(1).max(500),
        licenseAck: z.literal(true, { errorMap: () => ({ message: '需确认字体授权后才能导入' }) }),
      })
      .parse(req.body);
    const font = await prisma.userFont.create({
      data: {
        userId: req.user!.id,
        family: body.family,
        source: body.source,
        licenseAck: true,
      },
    });
    res.json({ font });
  }),
);

fontRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const font = await prisma.userFont.findUnique({ where: { id: req.params.id } });
    if (!font || font.userId !== req.user!.id)
      throw new HttpError(404, '字体不存在', 'NOT_FOUND');
    await prisma.userFont.delete({ where: { id: font.id } });
    res.json({ ok: true });
  }),
);
