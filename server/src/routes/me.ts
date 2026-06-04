import { Router } from 'express';
import fs from 'node:fs';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../lib/hash.js';
import { consumeVerificationCode, requestVerificationCode } from '../lib/verifyCode.js';
import { normalizeFilename, resolveUploadPath, storedRelative, uploadAvatar } from '../lib/upload.js';

export const meRouter = Router();

meRouter.use(requireAuth);

function clientIp(req: any) {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || 'unknown') as string;
}

meRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(40).optional(),
        avatarUrl: z
          .string()
          .trim()
          .max(500)
          .nullable()
          .optional()
          .refine(
            (v) =>
              v === undefined ||
              v === null ||
              v === '' ||
              /^https?:\/\//i.test(v) ||
              v.startsWith('/api/'),
            '头像地址必须是 http(s) 链接或上传的相对地址',
          ),
      })
      .parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: body.name,
        avatarUrl:
          body.avatarUrl === undefined ? undefined : body.avatarUrl === '' ? null : body.avatarUrl,
      },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, emailVerifiedAt: true, lastLoginAt: true },
    });
    res.json({ user });
  }),
);

meRouter.post(
  '/password',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(64),
      })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(404, '用户不存在', 'USER_NOT_FOUND');
    const ok = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!ok) throw new HttpError(400, '当前密码不正确', 'INVALID_CURRENT_PASSWORD');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });
    res.json({ ok: true });
  }),
);

meRouter.post(
  '/email-code',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        purpose: z.enum(['bind_email', 'change_email']),
      })
      .parse(req.body);
    const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!me) throw new HttpError(404, '用户不存在', 'USER_NOT_FOUND');

    const targetEmail = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (existing && existing.id !== req.user!.id) {
      throw new HttpError(409, '该邮箱已被使用', 'EMAIL_TAKEN');
    }

    const result = await requestVerificationCode({
      email: targetEmail,
      purpose: body.purpose,
      ip: clientIp(req),
    });
    res.json(result);
  }),
);

meRouter.get(
  '/avatars',
  asyncHandler(async (req, res) => {
    const list = await prisma.userAvatar.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    res.json({ list });
  }),
);

meRouter.post(
  '/avatar/upload',
  uploadAvatar.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, '没有收到图片', 'NO_FILE');
    const stored = storedRelative(req.file.path);
    const att = await prisma.attachment.create({
      data: {
        ownerId: req.user!.id,
        category: 'avatar',
        originalName: normalizeFilename(req.file.originalname),
        storedName: stored,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
    const url = `/api/attachments/${att.id}/raw`;
    const record = await prisma.userAvatar.create({
      data: { userId: req.user!.id, url },
    });
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: url },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, emailVerifiedAt: true, lastLoginAt: true },
    });
    res.json({ avatar: record, user });
  }),
);

meRouter.post(
  '/avatar/select',
  asyncHandler(async (req, res) => {
    const body = z.object({ url: z.string().min(1).max(500).nullable() }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: body.url },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, emailVerifiedAt: true, lastLoginAt: true },
    });
    if (body.url) {
      const existing = await prisma.userAvatar.findFirst({
        where: { userId: req.user!.id, url: body.url },
      });
      if (!existing) {
        await prisma.userAvatar.create({ data: { userId: req.user!.id, url: body.url } });
      }
    }
    res.json({ user });
  }),
);

meRouter.delete(
  '/avatars/:id',
  asyncHandler(async (req, res) => {
    const record = await prisma.userAvatar.findUnique({ where: { id: req.params.id } });
    if (!record || record.userId !== req.user!.id) {
      throw new HttpError(404, '头像不存在', 'NOT_FOUND');
    }
    await prisma.userAvatar.delete({ where: { id: record.id } });
    // 如果是某条 attachment 的 URL，并属于该用户，可一并清理
    const match = record.url.match(/^\/api\/attachments\/([^/]+)\/raw$/);
    if (match) {
      const att = await prisma.attachment.findUnique({ where: { id: match[1] } });
      if (att && att.ownerId === req.user!.id && att.category === 'avatar') {
        await prisma.attachment.delete({ where: { id: att.id } });
        try {
          const abs = resolveUploadPath(att.storedName);
          if (abs && fs.existsSync(abs)) fs.unlinkSync(abs);
        } catch {
          /* ignore */
        }
      }
    }
    res.json({ ok: true });
  }),
);

meRouter.post(
  '/email',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/),
        purpose: z.enum(['bind_email', 'change_email']),
      })
      .parse(req.body);
    const normalized = body.email.toLowerCase();
    await consumeVerificationCode({
      email: normalized,
      purpose: body.purpose,
      code: body.code,
    });
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing && existing.id !== req.user!.id) {
      throw new HttpError(409, '该邮箱已被使用', 'EMAIL_TAKEN');
    }
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { email: normalized, emailVerifiedAt: new Date() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
      },
    });
    res.json({ user });
  }),
);
