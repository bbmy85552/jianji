import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { decryptSecret, encryptSecret } from '../lib/crypto.js';
import { imapFetchRecent, imapListFolders, imapPing } from '../lib/mail/imap.js';
import { smtpSend, smtpVerify } from '../lib/mail/smtp.js';
import { MAIL_PROVIDERS, detectProvider } from '../lib/mail/providers.js';
import { normalizeFilename, uploadMailAttachments } from '../lib/upload.js';

export const mailRouter = Router();
mailRouter.use(requireAuth, requireEmailVerified);

mailRouter.get('/providers', (_req, res) => {
  res.json({
    list: MAIL_PROVIDERS.map((p) => ({
      key: p.key,
      label: p.label,
      domains: p.domains,
      hint: p.hint,
      helpUrl: p.helpUrl,
    })),
  });
});

mailRouter.post(
  '/detect',
  asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const provider = detectProvider(body.email);
    if (!provider) {
      res.json({ matched: false });
      return;
    }
    res.json({
      matched: true,
      provider: {
        key: provider.key,
        label: provider.label,
        imapHost: provider.imapHost,
        imapPort: provider.imapPort,
        imapSecure: provider.imapSecure,
        smtpHost: provider.smtpHost,
        smtpPort: provider.smtpPort,
        smtpSecure: provider.smtpSecure,
        hint: provider.hint,
        helpUrl: provider.helpUrl,
      },
    });
  }),
);

mailRouter.post(
  '/quick-bind',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(200),
        label: z.string().trim().max(40).optional(),
        fromName: z.string().trim().max(60).optional(),
        signature: z.string().max(2000).optional(),
        isDefault: z.boolean().optional(),
        skipTest: z.boolean().optional(),
      })
      .parse(req.body);
    const provider = detectProvider(body.email);
    if (!provider) {
      throw new HttpError(
        400,
        '尚未识别该邮箱的服务商，请使用「高级配置」手动填写 IMAP/SMTP。',
        'PROVIDER_UNKNOWN',
      );
    }
    const exists = await prisma.mailAccount.findFirst({
      where: { userId: req.user!.id, email: body.email.toLowerCase() },
    });
    if (exists) throw new HttpError(409, '该邮箱已绑定', 'EXISTS');

    // 优先快速验证 SMTP（连接更轻量，错误信息更明确）
    if (!body.skipTest) {
      try {
        await smtpVerify({
          host: provider.smtpHost,
          port: provider.smtpPort,
          secure: provider.smtpSecure,
          user: body.email,
          pass: body.password,
        });
      } catch (err) {
        const msg = (err as Error).message;
        throw new HttpError(
          400,
          `${msg}${provider.hint ? '\n建议：' + provider.hint : ''}`,
          'SMTP_FAILED',
        );
      }
    }

    if (body.isDefault) {
      await prisma.mailAccount.updateMany({
        where: { userId: req.user!.id },
        data: { isDefault: false },
      });
    }
    const account = await prisma.mailAccount.create({
      data: {
        userId: req.user!.id,
        label: body.label || provider.label,
        email: body.email.toLowerCase(),
        imapHost: provider.imapHost,
        imapPort: provider.imapPort,
        imapSecure: provider.imapSecure,
        smtpHost: provider.smtpHost,
        smtpPort: provider.smtpPort,
        smtpSecure: provider.smtpSecure,
        username: body.email,
        passwordEnc: encryptSecret(body.password),
        fromName: body.fromName ?? null,
        signature: body.signature ?? null,
        isDefault: body.isDefault ?? false,
      },
    });
    res.json({
      account: {
        id: account.id,
        label: account.label,
        email: account.email,
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        imapSecure: account.imapSecure,
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
        smtpSecure: account.smtpSecure,
        username: account.username,
        fromName: account.fromName,
        signature: account.signature,
        isDefault: account.isDefault,
        lastSyncedAt: account.lastSyncedAt,
        lastError: account.lastError,
      },
      provider: { key: provider.key, label: provider.label, hint: provider.hint },
    });
  }),
);

const accountInput = z.object({
  label: z.string().trim().min(1).max(40),
  email: z.string().email(),
  imapHost: z.string().trim().min(1).max(120),
  imapPort: z.number().int().min(1).max(65535),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().trim().min(1).max(120),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean().default(true),
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
  fromName: z.string().trim().max(60).nullable().optional(),
  signature: z.string().max(2000).nullable().optional(),
  isDefault: z.boolean().optional(),
});

function publicAccount(a: {
  id: string;
  label: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  fromName: string | null;
  signature: string | null;
  isDefault: boolean;
  lastSyncedAt: Date | null;
  lastError: string | null;
}) {
  return {
    id: a.id,
    label: a.label,
    email: a.email,
    imapHost: a.imapHost,
    imapPort: a.imapPort,
    imapSecure: a.imapSecure,
    smtpHost: a.smtpHost,
    smtpPort: a.smtpPort,
    smtpSecure: a.smtpSecure,
    username: a.username,
    fromName: a.fromName,
    signature: a.signature,
    isDefault: a.isDefault,
    lastSyncedAt: a.lastSyncedAt,
    lastError: a.lastError,
  };
}

async function loadAccount(userId: string, accountId: string) {
  const account = await prisma.mailAccount.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== userId) {
    throw new HttpError(404, '邮箱账户不存在', 'NOT_FOUND');
  }
  return account;
}

function firstString(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstString(value[0]);
  return undefined;
}

function parseAddressList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseAddressList(item));
  }
  const raw = firstString(value)?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    /* 兼容逗号分隔的表单字段 */
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

mailRouter.get(
  '/accounts',
  asyncHandler(async (req, res) => {
    const list = await prisma.mailAccount.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ list: list.map(publicAccount) });
  }),
);

mailRouter.post(
  '/accounts',
  asyncHandler(async (req, res) => {
    const body = accountInput.parse(req.body);
    const exists = await prisma.mailAccount.findFirst({
      where: { userId: req.user!.id, email: body.email.toLowerCase() },
    });
    if (exists) throw new HttpError(409, '该邮箱已绑定', 'EXISTS');
    if (body.isDefault) {
      await prisma.mailAccount.updateMany({
        where: { userId: req.user!.id },
        data: { isDefault: false },
      });
    }
    const account = await prisma.mailAccount.create({
      data: {
        userId: req.user!.id,
        label: body.label,
        email: body.email.toLowerCase(),
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapSecure: body.imapSecure,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpSecure: body.smtpSecure,
        username: body.username,
        passwordEnc: encryptSecret(body.password),
        fromName: body.fromName ?? null,
        signature: body.signature ?? null,
        isDefault: body.isDefault ?? false,
      },
    });
    res.json({ account: publicAccount(account) });
  }),
);

mailRouter.patch(
  '/accounts/:id',
  asyncHandler(async (req, res) => {
    const account = await loadAccount(req.user!.id, req.params.id);
    const body = accountInput
      .partial()
      .extend({ password: z.string().min(1).max(200).optional() })
      .parse(req.body);
    if (body.isDefault) {
      await prisma.mailAccount.updateMany({
        where: { userId: req.user!.id },
        data: { isDefault: false },
      });
    }
    const updated = await prisma.mailAccount.update({
      where: { id: account.id },
      data: {
        label: body.label,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapSecure: body.imapSecure,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpSecure: body.smtpSecure,
        username: body.username,
        passwordEnc: body.password ? encryptSecret(body.password) : undefined,
        fromName: body.fromName,
        signature: body.signature,
        isDefault: body.isDefault,
      },
    });
    res.json({ account: publicAccount(updated) });
  }),
);

mailRouter.delete(
  '/accounts/:id',
  asyncHandler(async (req, res) => {
    const account = await loadAccount(req.user!.id, req.params.id);
    await prisma.mailAccount.delete({ where: { id: account.id } });
    res.json({ ok: true });
  }),
);

mailRouter.post(
  '/accounts/:id/test',
  asyncHandler(async (req, res) => {
    const account = await loadAccount(req.user!.id, req.params.id);
    const pass = decryptSecret(account.passwordEnc);
    const result = { imap: { ok: false, error: '' }, smtp: { ok: false, error: '' } };
    try {
      await imapPing({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        user: account.username,
        pass,
      });
      result.imap.ok = true;
    } catch (err) {
      result.imap.error = (err as Error).message;
    }
    try {
      await smtpVerify({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        user: account.username,
        pass,
      });
      result.smtp.ok = true;
    } catch (err) {
      result.smtp.error = (err as Error).message;
    }
    const lastError = result.imap.ok && result.smtp.ok ? null : `IMAP:${result.imap.error || 'ok'} / SMTP:${result.smtp.error || 'ok'}`;
    await prisma.mailAccount.update({
      where: { id: account.id },
      data: { lastError },
    });
    res.json({ result });
  }),
);

mailRouter.get(
  '/accounts/:id/folders',
  asyncHandler(async (req, res) => {
    const account = await loadAccount(req.user!.id, req.params.id);
    const fresh = req.query.fresh === '1' || req.query.fresh === 'true';
    const cached = await prisma.mailMessage.findMany({
      where: { accountId: account.id },
      distinct: ['folder'],
      select: { folder: true },
      orderBy: { folder: 'asc' },
    });
    const names = new Set(['INBOX', ...cached.map((m) => m.folder)]);
    if (fresh) {
      const pass = decryptSecret(account.passwordEnc);
      try {
        const remote = await imapListFolders({
          host: account.imapHost,
          port: account.imapPort,
          secure: account.imapSecure,
          user: account.username,
          pass,
        });
        remote.forEach((f) => names.add(f));
      } catch (err) {
        throw new HttpError(502, `读取文件夹失败：${(err as Error).message}`, 'IMAP_FAILED');
      }
    }
    res.json({ list: Array.from(names).sort((a, b) => a.localeCompare(b)) });
  }),
);

mailRouter.post(
  '/accounts/:id/sync',
  asyncHandler(async (req, res) => {
    const account = await loadAccount(req.user!.id, req.params.id);
    const limit = z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit ?? 30);
    const folder = z.string().trim().min(1).max(120).default('INBOX').parse(req.query.folder ?? 'INBOX');
    const pass = decryptSecret(account.passwordEnc);
    try {
      const mails = await imapFetchRecent(
        {
          host: account.imapHost,
          port: account.imapPort,
          secure: account.imapSecure,
          user: account.username,
          pass,
        },
        { folder, limit },
      );
      for (const m of mails) {
        await prisma.mailMessage.upsert({
          where: {
            accountId_folder_uid: { accountId: account.id, folder, uid: m.uid },
          },
          update: {
            subject: m.subject ?? null,
            fromName: m.fromName ?? null,
            fromEmail: m.fromEmail ?? null,
            toJson: JSON.stringify(m.to),
            ccJson: JSON.stringify(m.cc),
            preview: m.preview ?? null,
            textBody: m.textBody ?? null,
            htmlBody: m.htmlBody ?? null,
            receivedAt: m.receivedAt,
          },
          create: {
            accountId: account.id,
            folder,
            uid: m.uid,
            messageId: m.messageId ?? null,
            subject: m.subject ?? null,
            fromName: m.fromName ?? null,
            fromEmail: m.fromEmail ?? null,
            toJson: JSON.stringify(m.to),
            ccJson: JSON.stringify(m.cc),
            preview: m.preview ?? null,
            textBody: m.textBody ?? null,
            htmlBody: m.htmlBody ?? null,
            receivedAt: m.receivedAt,
          },
        });
      }
      await prisma.mailAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date(), lastError: null },
      });
      res.json({ synced: mails.length });
    } catch (err) {
      const message = (err as Error).message;
      await prisma.mailAccount.update({
        where: { id: account.id },
        data: { lastError: message },
      });
      throw new HttpError(502, `同步失败：${message}`, 'IMAP_FAILED');
    }
  }),
);

mailRouter.get(
  '/accounts/:id/messages',
  asyncHandler(async (req, res) => {
    const account = await loadAccount(req.user!.id, req.params.id);
    const q = z
      .object({
        folder: z.string().default('INBOX'),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);
    const where = { accountId: account.id, folder: q.folder };
    const [total, list] = await Promise.all([
      prisma.mailMessage.count({ where }),
      prisma.mailMessage.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          uid: true,
          folder: true,
          subject: true,
          fromName: true,
          fromEmail: true,
          preview: true,
          receivedAt: true,
          isRead: true,
          isFlagged: true,
        },
      }),
    ]);
    res.json({ list, total, page: q.page, pageSize: q.pageSize });
  }),
);

mailRouter.get(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const message = await prisma.mailMessage.findUnique({
      where: { id: req.params.id },
      include: { account: true },
    });
    if (!message || message.account.userId !== req.user!.id) {
      throw new HttpError(404, '邮件不存在', 'NOT_FOUND');
    }
    if (!message.isRead) {
      await prisma.mailMessage.update({
        where: { id: message.id },
        data: { isRead: true },
      });
      message.isRead = true;
    }
    res.json({
      message: {
        ...message,
        to: JSON.parse(message.toJson || '[]'),
        cc: JSON.parse(message.ccJson || '[]'),
        account: { id: message.account.id, email: message.account.email, label: message.account.label },
      },
    });
  }),
);

mailRouter.post(
  '/messages/:id/to-todo',
  asyncHandler(async (req, res) => {
    const message = await prisma.mailMessage.findUnique({
      where: { id: req.params.id },
      include: { account: true },
    });
    if (!message || message.account.userId !== req.user!.id) {
      throw new HttpError(404, '邮件不存在', 'NOT_FOUND');
    }
    const body = z
      .object({
        title: z.string().trim().max(200).optional(),
        dueDate: z.string().nullable().optional(),
      })
      .parse(req.body ?? {});
    const baseTitle = body.title?.trim() || message.subject || '邮件待办';
    const due = body.dueDate ? new Date(body.dueDate) : null;
    const todo = await prisma.todoItem.create({
      data: {
        userId: req.user!.id,
        title: `📧 ${baseTitle}`.slice(0, 200),
        dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
      },
    });
    res.json({ todo });
  }),
);

mailRouter.patch(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const target = await prisma.mailMessage.findUnique({
      where: { id: req.params.id },
      include: { account: true },
    });
    if (!target || target.account.userId !== req.user!.id) {
      throw new HttpError(404, '邮件不存在', 'NOT_FOUND');
    }
    const body = z
      .object({
        isRead: z.boolean().optional(),
        isFlagged: z.boolean().optional(),
        folder: z.string().trim().min(1).max(120).optional(),
      })
      .parse(req.body);
    const updated = await prisma.mailMessage.update({ where: { id: target.id }, data: body });
    res.json({ message: updated });
  }),
);

mailRouter.post(
  '/accounts/:id/send',
  uploadMailAttachments.array('attachments', 10),
  asyncHandler(async (req, res) => {
    const account = await loadAccount(req.user!.id, req.params.id);
    const files = (Array.isArray(req.files) ? req.files : []) as {
      originalname: string;
      buffer: Buffer;
      mimetype: string;
    }[];
    const body = z
      .object({
        to: z.array(z.string().email()).min(1).max(20),
        cc: z.array(z.string().email()).max(20).optional(),
        subject: z.string().trim().max(200).default(''),
        text: z.string().max(50_000).optional(),
        html: z.string().max(200_000).optional(),
      })
      .parse({
        to: parseAddressList(req.body.to),
        cc: parseAddressList(req.body.cc || []).length
          ? parseAddressList(req.body.cc)
          : undefined,
        subject: firstString(req.body.subject) ?? '',
        text: firstString(req.body.text),
        html: firstString(req.body.html),
      });
    const attachments = files.map((file) => ({
      filename: normalizeFilename(file.originalname),
      content: file.buffer,
      contentType: file.mimetype,
    }));
    const hasBody = Boolean(body.text?.trim() || body.html?.trim());
    if (!hasBody && attachments.length === 0) {
      throw new HttpError(400, '请填写正文或添加附件', 'EMPTY_MAIL');
    }
    const textPreview = body.text?.replace(/\s+/g, ' ').trim();
    const attachmentPreview = attachments.length
      ? `附件：${attachments.map((file) => file.filename).join(', ')}`
      : '';
    const pass = decryptSecret(account.passwordEnc);
    try {
      await smtpSend(
        {
          host: account.smtpHost,
          port: account.smtpPort,
          secure: account.smtpSecure,
          user: account.username,
          pass,
        },
        {
          fromName: account.fromName ?? undefined,
          fromEmail: account.email,
          to: body.to,
          cc: body.cc,
          subject: body.subject,
          text: body.text,
          html: body.html,
          attachments,
        },
      );
      await prisma.mailMessage.create({
        data: {
          accountId: account.id,
          folder: 'Sent',
          uid: -Math.floor(Date.now() % 1_000_000_000),
          subject: body.subject || null,
          fromName: account.fromName,
          fromEmail: account.email,
          toJson: JSON.stringify(body.to.map((address) => ({ address }))),
          ccJson: JSON.stringify((body.cc ?? []).map((address) => ({ address }))),
          receivedAt: new Date(),
          preview: (textPreview || attachmentPreview).slice(0, 240),
          textBody: body.text?.trim() ? body.text : null,
          htmlBody: body.html ?? null,
          isRead: true,
        },
      });
      res.json({ ok: true });
    } catch (err) {
      throw new HttpError(502, `发送失败：${(err as Error).message}`, 'SMTP_FAILED');
    }
  }),
);
