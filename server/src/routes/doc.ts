import { Router } from 'express';
import fs from 'node:fs';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { uploadDocImport } from '../lib/upload.js';
import { importByExtension } from '../lib/textImport.js';
import { computeAccess, loadDocWithAccess } from '../lib/docAccess.js';
import { htmlToDocx, htmlToFullPage, htmlToMarkdown } from '../lib/export.js';
import { contentDispositionAttachment } from '../lib/filename.js';

export const docRouter = Router();
docRouter.use(requireAuth, requireEmailVerified);

async function findTargetWorkspace(userId: string, kind: 'PRIVATE' | 'PUBLIC') {
  if (kind === 'PUBLIC') {
    const ws = await prisma.workspace.findFirst({ where: { kind: 'PUBLIC' } });
    if (!ws) throw new HttpError(500, '公共知识库尚未初始化', 'PUBLIC_WS_MISSING');
    return ws;
  }
  const ws = await prisma.workspace.findFirst({
    where: { ownerId: userId, kind: 'PRIVATE' },
    orderBy: { createdAt: 'asc' },
  });
  if (!ws) throw new HttpError(404, '没有可用的私人工作区', 'NO_WORKSPACE');
  return ws;
}

docRouter.get(
  '/tree',
  asyncHandler(async (req, res) => {
    const ownWorkspaces = await prisma.workspace.findMany({
      where: { ownerId: req.user!.id, kind: 'PRIVATE' },
      orderBy: { createdAt: 'asc' },
    });
    const publicWs = await prisma.workspace.findFirst({ where: { kind: 'PUBLIC' } });
    const wsIds = ownWorkspaces.map((w) => w.id);

    const favoritesRel = await prisma.documentFavorite.findMany({
      where: { userId: req.user!.id },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            parentId: true,
            workspaceId: true,
            updatedAt: true,
            createdById: true,
            workspace: { select: { id: true, name: true, kind: true, ownerId: true } },
            createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const favorites = favoritesRel.filter((f) => f.document).map((f) => ({
      ...f.document!,
      favoritedAt: f.createdAt,
    }));
    const favoriteIds = new Set(favorites.map((f) => f.id));

    const mineDocs = await prisma.document.findMany({
      where: { workspaceId: { in: wsIds }, isArchived: false },
      select: { id: true, title: true, parentId: true, workspaceId: true, updatedAt: true, createdById: true },
      orderBy: { updatedAt: 'desc' },
    });
    const publicDocs = publicWs
      ? await prisma.document.findMany({
          where: { workspaceId: publicWs.id, isArchived: false },
          select: {
            id: true,
            title: true,
            parentId: true,
            workspaceId: true,
            updatedAt: true,
            createdById: true,
            createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];
    const sharedDocs = await prisma.document.findMany({
      where: {
        isArchived: false,
        permissions: { some: { userId: req.user!.id } },
        workspace: { ownerId: { not: req.user!.id }, kind: 'PRIVATE' },
      },
      select: {
        id: true,
        title: true,
        parentId: true,
        workspaceId: true,
        updatedAt: true,
        createdById: true,
        workspace: { select: { id: true, name: true, ownerId: true } },
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const annotateFav = <T extends { id: string }>(arr: T[]) =>
      arr.map((d) => ({ ...d, isFavorite: favoriteIds.has(d.id) }));

    res.json({
      workspaces: ownWorkspaces,
      publicWorkspace: publicWs,
      mine: annotateFav(mineDocs),
      public: annotateFav(publicDocs),
      shared: annotateFav(sharedDocs),
      favorites,
    });
  }),
);

docRouter.post(
  '/:id/favorite',
  asyncHandler(async (req, res) => {
    const { doc } = await loadDocWithAccess(req.user!, req.params.id);
    await prisma.documentFavorite.upsert({
      where: { userId_documentId: { userId: req.user!.id, documentId: doc.id } },
      update: {},
      create: { userId: req.user!.id, documentId: doc.id },
    });
    res.json({ ok: true });
  }),
);

docRouter.delete(
  '/:id/favorite',
  asyncHandler(async (req, res) => {
    await prisma.documentFavorite
      .delete({
        where: { userId_documentId: { userId: req.user!.id, documentId: req.params.id } },
      })
      .catch(() => undefined);
    res.json({ ok: true });
  }),
);

docRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        workspaceId: z.string().optional(),
        workspaceKind: z.enum(['PRIVATE', 'PUBLIC']).optional(),
        parentId: z.string().nullable().optional(),
        title: z.string().trim().min(1).max(120).default('未命名文档'),
        contentJson: z.string().max(2_000_000).optional(),
      })
      .parse(req.body);
    let ws;
    if (body.workspaceId) {
      ws = await prisma.workspace.findUnique({ where: { id: body.workspaceId } });
      if (!ws) throw new HttpError(404, '工作区不存在', 'NOT_FOUND');
      if (ws.kind === 'PRIVATE' && ws.ownerId !== req.user!.id) {
        throw new HttpError(403, '无权在此工作区创建文档', 'FORBIDDEN');
      }
    } else {
      ws = await findTargetWorkspace(req.user!.id, body.workspaceKind ?? 'PRIVATE');
    }
    const doc = await prisma.document.create({
      data: {
        workspaceId: ws.id,
        parentId: body.parentId ?? null,
        title: body.title,
        contentJson: body.contentJson ?? '',
        createdById: req.user!.id,
      },
    });
    res.json({ doc });
  }),
);

docRouter.post(
  '/import',
  uploadDocImport.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, '没有收到文件', 'NO_FILE');
    const workspaceId = (req.body?.workspaceId as string | undefined)?.trim();
    const workspaceKind = (req.body?.workspaceKind as string | undefined) as
      | 'PRIVATE'
      | 'PUBLIC'
      | undefined;
    let ws;
    if (workspaceId) {
      ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws) throw new HttpError(404, '工作区不存在', 'NOT_FOUND');
      if (ws.kind === 'PRIVATE' && ws.ownerId !== req.user!.id) {
        throw new HttpError(403, '无权限', 'FORBIDDEN');
      }
    } else {
      ws = await findTargetWorkspace(req.user!.id, workspaceKind ?? 'PRIVATE');
    }
    let html = '';
    try {
      html = await importByExtension(req.file.path, req.file.originalname);
    } catch (err) {
      throw new HttpError(400, (err as Error).message || '解析失败', 'IMPORT_FAILED');
    } finally {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    const title =
      req.file.originalname.replace(/\.(docx|md|markdown|txt)$/i, '').slice(0, 120) || '未命名文档';
    const doc = await prisma.document.create({
      data: {
        workspaceId: ws.id,
        title,
        contentJson: html,
        createdById: req.user!.id,
      },
    });
    res.json({ doc });
  }),
);

docRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { doc, access } = await loadDocWithAccess(req.user!, req.params.id);
    res.json({ doc, role: access.role, access });
  }),
);

docRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { doc, access } = await loadDocWithAccess(req.user!, req.params.id);
    if (!access.canWrite) throw new HttpError(403, '只读权限', 'READONLY');
    const body = z
      .object({
        title: z.string().trim().min(1).max(120).optional(),
        contentJson: z.string().max(2_000_000).optional(),
        parentId: z.string().nullable().optional(),
        isArchived: z.boolean().optional(),
      })
      .parse(req.body);
    if (body.parentId !== undefined && body.parentId !== null) {
      if (body.parentId === doc.id) {
        throw new HttpError(400, '不能将文档移动到自身', 'INVALID_PARENT');
      }
      const parent = await prisma.document.findUnique({
        where: { id: body.parentId },
        select: { id: true, workspaceId: true },
      });
      if (!parent) throw new HttpError(404, '父文档不存在', 'PARENT_NOT_FOUND');
      if (parent.workspaceId !== doc.workspaceId) {
        throw new HttpError(400, '不能跨工作区移动', 'CROSS_WORKSPACE');
      }
      // 循环检测：父链中不能出现自身
      let cursor: { id: string; parentId: string | null } | null = await prisma.document.findUnique(
        {
          where: { id: body.parentId },
          select: { id: true, parentId: true },
        },
      );
      const visited = new Set<string>();
      while (cursor) {
        if (cursor.id === doc.id) {
          throw new HttpError(400, '不能移动到自身的子孙下', 'CYCLIC_PARENT');
        }
        if (visited.has(cursor.id)) break;
        visited.add(cursor.id);
        if (!cursor.parentId) break;
        cursor = await prisma.document.findUnique({
          where: { id: cursor.parentId },
          select: { id: true, parentId: true },
        });
      }
    }
    const updated = await prisma.document.update({ where: { id: doc.id }, data: body });
    res.json({ doc: updated });
  }),
);

docRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { doc, access } = await loadDocWithAccess(req.user!, req.params.id);
    if (!access.canDelete) throw new HttpError(403, '没有删除权限', 'FORBIDDEN');
    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ ok: true });
  }),
);

docRouter.get(
  '/:id/export',
  asyncHandler(async (req, res) => {
    const { doc } = await loadDocWithAccess(req.user!, req.params.id);
    const format = (req.query.format as string) || 'md';
    const safeTitle = doc.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '文档';
    const html = doc.contentJson || '<p></p>';
    if (format === 'md') {
      const md = htmlToMarkdown(html);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', contentDispositionAttachment(`${safeTitle}.md`));
      res.send(md);
      return;
    }
    if (format === 'html') {
      const full = htmlToFullPage(html, doc.title);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', contentDispositionAttachment(`${safeTitle}.html`));
      res.send(full);
      return;
    }
    if (format === 'docx') {
      const buf = await htmlToDocx(html, doc.title);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader('Content-Disposition', contentDispositionAttachment(`${safeTitle}.docx`));
      res.send(buf);
      return;
    }
    throw new HttpError(400, '不支持的导出格式', 'INVALID_FORMAT');
  }),
);

docRouter.get(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const { doc } = await loadDocWithAccess(req.user!, req.params.id);
    const list = await prisma.documentVersion.findMany({
      where: { documentId: doc.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    res.json({ list });
  }),
);

docRouter.post(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const { doc, access } = await loadDocWithAccess(req.user!, req.params.id);
    if (!access.canWrite) throw new HttpError(403, '只读权限', 'READONLY');
    const body = z.object({ label: z.string().trim().max(40).optional() }).parse(req.body ?? {});
    const v = await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        title: doc.title,
        contentJson: doc.contentJson,
        label: body.label?.length ? body.label : null,
        authorId: req.user!.id,
      },
    });
    res.json({ version: v });
  }),
);

docRouter.post(
  '/:id/versions/:vid/restore',
  asyncHandler(async (req, res) => {
    const { doc, access } = await loadDocWithAccess(req.user!, req.params.id);
    if (!access.canWrite) throw new HttpError(403, '只读权限', 'READONLY');
    const version = await prisma.documentVersion.findUnique({ where: { id: req.params.vid } });
    if (!version || version.documentId !== doc.id) {
      throw new HttpError(404, '版本不存在', 'NOT_FOUND');
    }
    await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        title: doc.title,
        contentJson: doc.contentJson,
        label: '恢复前自动快照',
        authorId: req.user!.id,
      },
    });
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { title: version.title, contentJson: version.contentJson },
    });
    res.json({ doc: updated });
  }),
);

const commentAuthorSelect = { id: true, name: true, email: true, avatarUrl: true } as const;

docRouter.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { doc } = await loadDocWithAccess(req.user!, req.params.id);
    const list = await prisma.documentComment.findMany({
      where: { documentId: doc.id },
      orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'asc' }],
      include: { author: { select: commentAuthorSelect } },
      take: 500,
    });
    res.json({ list });
  }),
);

docRouter.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { doc } = await loadDocWithAccess(req.user!, req.params.id);
    const body = z
      .object({
        body: z.string().trim().min(1).max(4000),
        anchorId: z.string().trim().max(120).nullable().optional(),
        anchorText: z.string().trim().max(300).nullable().optional(),
        parentId: z.string().nullable().optional(),
      })
      .parse(req.body);
    if (body.parentId) {
      const parent = await prisma.documentComment.findUnique({ where: { id: body.parentId } });
      if (!parent || parent.documentId !== doc.id) {
        throw new HttpError(404, '父评论不存在', 'COMMENT_PARENT_NOT_FOUND');
      }
    }
    const comment = await prisma.documentComment.create({
      data: {
        documentId: doc.id,
        authorId: req.user!.id,
        body: body.body,
        anchorId: body.anchorId || null,
        anchorText: body.anchorText || null,
        parentId: body.parentId ?? null,
      },
      include: { author: { select: commentAuthorSelect } },
    });
    res.json({ comment });
  }),
);

docRouter.patch(
  '/:id/comments/:commentId',
  asyncHandler(async (req, res) => {
    const { access } = await loadDocWithAccess(req.user!, req.params.id);
    const target = await prisma.documentComment.findUnique({ where: { id: req.params.commentId } });
    if (!target || target.documentId !== req.params.id) {
      throw new HttpError(404, '评论不存在', 'COMMENT_NOT_FOUND');
    }
    const body = z
      .object({
        body: z.string().trim().min(1).max(4000).optional(),
        resolved: z.boolean().optional(),
      })
      .parse(req.body);
    const canEditBody = target.authorId === req.user!.id || access.canWrite;
    if (body.body !== undefined && !canEditBody) {
      throw new HttpError(403, '只能编辑自己的评论', 'FORBIDDEN');
    }
    if (body.resolved !== undefined && !access.canWrite && target.authorId !== req.user!.id) {
      throw new HttpError(403, '没有处理评论的权限', 'FORBIDDEN');
    }
    const comment = await prisma.documentComment.update({
      where: { id: target.id },
      data: {
        body: body.body,
        resolvedAt: body.resolved === undefined ? undefined : body.resolved ? new Date() : null,
      },
      include: { author: { select: commentAuthorSelect } },
    });
    res.json({ comment });
  }),
);

docRouter.delete(
  '/:id/comments/:commentId',
  asyncHandler(async (req, res) => {
    const { access } = await loadDocWithAccess(req.user!, req.params.id);
    const target = await prisma.documentComment.findUnique({ where: { id: req.params.commentId } });
    if (!target || target.documentId !== req.params.id) {
      throw new HttpError(404, '评论不存在', 'COMMENT_NOT_FOUND');
    }
    if (target.authorId !== req.user!.id && !access.canWrite) {
      throw new HttpError(403, '没有删除评论的权限', 'FORBIDDEN');
    }
    await prisma.documentComment.delete({ where: { id: target.id } });
    res.json({ ok: true });
  }),
);

docRouter.get(
  '/:id/collaborators',
  asyncHandler(async (req, res) => {
    const { doc } = await loadDocWithAccess(req.user!, req.params.id);
    const perms = await prisma.documentPermission.findMany({
      where: { documentId: doc.id },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const owner = await prisma.user.findUnique({
      where: { id: doc.createdById },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    res.json({ owner, collaborators: perms });
  }),
);

docRouter.post(
  '/:id/collaborators',
  asyncHandler(async (req, res) => {
    const { doc, access } = await loadDocWithAccess(req.user!, req.params.id);
    if (!access.canInvite) throw new HttpError(403, '只有所有者可邀请协作者', 'FORBIDDEN');
    const body = z
      .object({
        userId: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(['VIEWER', 'EDITOR']).default('VIEWER'),
      })
      .refine((v) => v.userId || v.email, '需要 userId 或 email')
      .parse(req.body);
    const user = body.userId
      ? await prisma.user.findUnique({ where: { id: body.userId } })
      : await prisma.user.findUnique({ where: { email: body.email!.toLowerCase() } });
    if (!user) throw new HttpError(404, '找不到该用户', 'USER_NOT_FOUND');
    if (user.id === doc.createdById) {
      throw new HttpError(400, '不能添加文档创建者本人', 'INVALID');
    }
    const perm = await prisma.documentPermission.upsert({
      where: { documentId_userId: { documentId: doc.id, userId: user.id } },
      update: { role: body.role },
      create: { documentId: doc.id, userId: user.id, role: body.role },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    res.json({ collaborator: perm });
  }),
);

docRouter.patch(
  '/:id/collaborators/:userId',
  asyncHandler(async (req, res) => {
    const { doc, access } = await loadDocWithAccess(req.user!, req.params.id);
    if (!access.canInvite) throw new HttpError(403, '只有所有者可调整协作者权限', 'FORBIDDEN');
    const body = z.object({ role: z.enum(['VIEWER', 'EDITOR']) }).parse(req.body);
    const perm = await prisma.documentPermission.update({
      where: { documentId_userId: { documentId: doc.id, userId: req.params.userId } },
      data: { role: body.role },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    res.json({ collaborator: perm });
  }),
);

docRouter.delete(
  '/:id/collaborators/:userId',
  asyncHandler(async (req, res) => {
    const { doc, access } = await loadDocWithAccess(req.user!, req.params.id);
    if (!access.canInvite) throw new HttpError(403, '只有所有者可移除协作者', 'FORBIDDEN');
    await prisma.documentPermission.delete({
      where: { documentId_userId: { documentId: doc.id, userId: req.params.userId } },
    });
    res.json({ ok: true });
  }),
);

// 兼容旧的 /docs 列表 API：返回我的私有 + 共享文档
docRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z
      .object({ q: z.string().trim().optional(), workspaceId: z.string().optional() })
      .parse(req.query);
    const myWs = await prisma.workspace.findMany({
      where: { ownerId: req.user!.id, kind: 'PRIVATE' },
      select: { id: true },
    });
    const wsIds = myWs.map((w) => w.id);
    const list = await prisma.document.findMany({
      where: {
        workspaceId: q.workspaceId ? q.workspaceId : { in: wsIds },
        isArchived: false,
        ...(q.q ? { title: { contains: q.q } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, title: true, updatedAt: true, workspaceId: true, parentId: true },
    });
    res.json({ list });
  }),
);

export { computeAccess };
