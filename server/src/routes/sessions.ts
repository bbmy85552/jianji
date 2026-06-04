import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  listSessionsForUser,
  revokeAllOtherSessions,
  revokeSession,
} from '../lib/session.js';

export const sessionRouter = Router();
sessionRouter.use(requireAuth);

sessionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await listSessionsForUser(req.user!.id);
    const current = req.sessionId ?? null;
    res.json({
      currentId: current,
      sessions: list.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddr: s.ipAddr,
        lastSeenAt: s.lastSeenAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        isActive: !s.revokedAt && (!s.expiresAt || s.expiresAt > new Date()),
        isCurrent: s.id === current,
      })),
    });
  }),
);

sessionRouter.delete(
  '/others',
  asyncHandler(async (req, res) => {
    if (!req.sessionId) {
      throw new HttpError(400, '当前会话信息缺失，无法识别本机', 'NO_CURRENT_SESSION');
    }
    const r = await revokeAllOtherSessions(req.user!.id, req.sessionId);
    res.json({ revoked: r.count });
  }),
);

sessionRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.sessionId && req.sessionId === req.params.id) {
      throw new HttpError(400, '不能在此撤销当前设备，请使用退出登录', 'CANNOT_REVOKE_SELF');
    }
    const r = await revokeSession(req.params.id, req.user!.id);
    if (r.count === 0) throw new HttpError(404, '会话不存在', 'NOT_FOUND');
    res.json({ ok: true });
  }),
);
