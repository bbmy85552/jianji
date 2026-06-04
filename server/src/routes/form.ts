import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../lib/asyncHandler.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { createNotification } from '../lib/notify.js';

export const formRouter = Router();
export const publicFormRouter = Router();

async function ensureTableOwnerOrEditor(userId: string, tableId: string) {
  const table = await prisma.tableBase.findUnique({
    where: { id: tableId },
    include: { workspace: true, permissions: true },
  });
  if (!table) throw new HttpError(404, '数据表不存在', 'NOT_FOUND');
  const isOwner = table.workspace.ownerId === userId || table.createdById === userId;
  const perm = table.permissions.find((p) => p.userId === userId);
  if (!isOwner && perm?.role !== 'EDITOR') {
    throw new HttpError(403, '需要表格所有者或编辑权限', 'FORBIDDEN');
  }
  return { table, isOwner };
}

formRouter.use(requireAuth, requireEmailVerified);

formRouter.get(
  '/by-table/:tableId',
  asyncHandler(async (req, res) => {
    await ensureTableOwnerOrEditor(req.user!.id, req.params.tableId);
    const list = await prisma.tableFormView.findMany({
      where: { tableId: req.params.tableId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ list });
  }),
);

formRouter.post(
  '/by-table/:tableId',
  asyncHandler(async (req, res) => {
    await ensureTableOwnerOrEditor(req.user!.id, req.params.tableId);
    const body = z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().max(2000).nullable().optional(),
        fields: z
          .array(
            z.object({
              name: z.string(),
              label: z.string().optional(),
              required: z.boolean().optional(),
            }),
          )
          .min(1),
        requireLogin: z.boolean().optional(),
      })
      .parse(req.body);
    const view = await prisma.tableFormView.create({
      data: {
        tableId: req.params.tableId,
        token: crypto.randomBytes(12).toString('base64url'),
        title: body.title,
        description: body.description ?? null,
        fieldsJson: JSON.stringify(body.fields),
        requireLogin: body.requireLogin ?? false,
        createdById: req.user!.id,
      },
    });
    res.json({ form: view });
  }),
);

formRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const view = await prisma.tableFormView.findUnique({ where: { id: req.params.id } });
    if (!view) throw new HttpError(404, '表单不存在', 'NOT_FOUND');
    await ensureTableOwnerOrEditor(req.user!.id, view.tableId);
    await prisma.tableFormView.delete({ where: { id: view.id } });
    res.json({ ok: true });
  }),
);

formRouter.patch(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const view = await prisma.tableFormView.findUnique({ where: { id: req.params.id } });
    if (!view) throw new HttpError(404, '表单不存在', 'NOT_FOUND');
    await ensureTableOwnerOrEditor(req.user!.id, view.tableId);
    const updated = await prisma.tableFormView.update({
      where: { id: view.id },
      data: { closedAt: view.closedAt ? null : new Date() },
    });
    res.json({ form: updated });
  }),
);

// 公开访问 + 提交
publicFormRouter.get(
  '/:token',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const view = await prisma.tableFormView.findUnique({ where: { token: req.params.token } });
    if (!view) throw new HttpError(404, '表单不存在', 'NOT_FOUND');
    if (view.closedAt) throw new HttpError(410, '该表单已停止收集', 'CLOSED');
    if (view.requireLogin && !req.user) {
      throw new HttpError(401, '该表单需要登录后提交', 'LOGIN_REQUIRED');
    }
    const table = await prisma.tableBase.findUnique({
      where: { id: view.tableId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!table) throw new HttpError(404, '关联数据表不存在', 'NOT_FOUND');
    let fieldList: { name: string; label?: string; required?: boolean }[];
    try {
      fieldList = JSON.parse(view.fieldsJson) as typeof fieldList;
    } catch {
      fieldList = [];
    }
    const fields = fieldList
      .map((entry) => {
        const f = table.fields.find((tf) => tf.name === entry.name);
        if (!f) return null;
        let options: Record<string, unknown> = {};
        try {
          options = JSON.parse(f.options || '{}');
        } catch {
          /* ignore */
        }
        return {
          name: f.name,
          type: f.type,
          options,
          label: entry.label || f.name,
          required: entry.required ?? false,
        };
      })
      .filter(Boolean);
    res.json({
      form: {
        id: view.id,
        title: view.title,
        description: view.description,
        requireLogin: view.requireLogin,
        fields,
      },
    });
  }),
);

publicFormRouter.post(
  '/:token/submit',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const view = await prisma.tableFormView.findUnique({ where: { token: req.params.token } });
    if (!view) throw new HttpError(404, '表单不存在', 'NOT_FOUND');
    if (view.closedAt) throw new HttpError(410, '该表单已停止收集', 'CLOSED');
    if (view.requireLogin && !req.user) {
      throw new HttpError(401, '该表单需要登录后提交', 'LOGIN_REQUIRED');
    }
    const body = z.object({ data: z.record(z.unknown()) }).parse(req.body);
    const table = await prisma.tableBase.findUnique({
      where: { id: view.tableId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!table) throw new HttpError(404, '关联数据表不存在', 'NOT_FOUND');
    let fieldList: { name: string; required?: boolean }[];
    try {
      fieldList = JSON.parse(view.fieldsJson) as typeof fieldList;
    } catch {
      fieldList = [];
    }
    const allowed = new Set(fieldList.map((f) => f.name));
    const payload: Record<string, unknown> = {};
    for (const f of table.fields) {
      if (!allowed.has(f.name)) continue;
      const entry = fieldList.find((x) => x.name === f.name);
      const v = body.data[f.name];
      if ((v === undefined || v === null || v === '') && entry?.required) {
        throw new HttpError(400, `字段「${f.name}」必填`, 'INVALID');
      }
      if (v !== undefined) payload[f.name] = v;
    }
    const last = await prisma.tableRecord.findFirst({
      where: { tableId: table.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    await prisma.tableRecord.create({
      data: {
        tableId: table.id,
        dataJson: JSON.stringify(payload),
        order: (last?.order ?? 0) + 1,
      },
    });
    await prisma.tableFormView.update({
      where: { id: view.id },
      data: { submissions: { increment: 1 } },
    });
    // 通知所有者
    void createNotification({
      userId: view.createdById,
      category: 'form_submission',
      title: `表单「${view.title}」收到新提交`,
      body: '点击查看最新提交内容',
      link: `/app/tables/${table.id}`,
      meta: { tableId: table.id, formId: view.id },
    }).catch(() => undefined);
    res.json({ ok: true });
  }),
);
