import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { getApp, resetData, registerUser } from './helpers.js';
import { prisma } from '../src/prisma.js';
import { __testCodeMap } from '../src/lib/verifyCode.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
  await resetData();
});

afterEach(async () => {
  await resetData();
});

describe('邮箱验证门禁', () => {
  it('注册成功后邮箱即为已验证', async () => {
    const email = 'registered-verified@test.local';
    await registerUser(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerifiedAt).toBeTruthy();
  });

  it('未验证邮箱无法访问文档 API', async () => {
    const email = 'unverified@test.local';
    const { cookie } = await registerUser(email);
    await prisma.user.update({
      where: { email },
      data: { emailVerifiedAt: null },
    });

    const res = await request(app).get('/api/docs/tree').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('历史未验证账号可通过安全页邮箱流程完成验证', async () => {
    const email = 'verify@test.local';
    const { cookie } = await registerUser(email);
    await prisma.user.update({
      where: { email },
      data: { emailVerifiedAt: null },
    });

    await request(app)
      .post('/api/me/email-code')
      .set('Cookie', cookie)
      .send({ email, purpose: 'bind_email' });

    const code = __testCodeMap.get(`${email}:bind_email`);
    expect(code).toBeTruthy();

    const verifyRes = await request(app)
      .post('/api/me/email')
      .set('Cookie', cookie)
      .send({ email, code, purpose: 'bind_email' });
    expect(verifyRes.status).toBe(200);

    const res = await request(app).get('/api/docs/tree').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
});
