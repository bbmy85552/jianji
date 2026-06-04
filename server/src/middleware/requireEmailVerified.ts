import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { HttpError } from '../lib/asyncHandler.js';

/** 未验证邮箱的用户不可使用核心业务 API（管理员除外） */
export async function requireEmailVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, '未登录', 'UNAUTHORIZED'));
  if (req.user.role === 'ADMIN') return next();

  const row = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { emailVerifiedAt: true },
  });
  if (!row?.emailVerifiedAt) {
    return next(
      new HttpError(403, '请先验证邮箱后再使用此功能', 'EMAIL_NOT_VERIFIED'),
    );
  }
  return next();
}
