import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, readCode, resetData } from './helpers.js';

beforeAll(async () => {
  await getApp();
});

afterEach(async () => {
  await resetData();
});

describe('注册与验证码', () => {
  it('完整邮箱验证码注册流程可成功', async () => {
    const app = await getApp();
    const email = 'alice@test.local';
    const r1 = await request(app).post('/api/auth/register-code').send({ email });
    expect(r1.status).toBe(200);
    const code = readCode(email, 'register')!;
    expect(code).toMatch(/^\d{6}$/);

    const r2 = await request(app)
      .post('/api/auth/register')
      .send({ email, code, password: 'Aa12345678', name: 'Alice' });
    expect(r2.status).toBe(200);
    expect(r2.body.user.email).toBe(email);
    expect(r2.headers['set-cookie']).toBeDefined();
  });

  it('错误验证码会增加 attempts 并最终拒绝', async () => {
    const app = await getApp();
    const email = 'bob@test.local';
    await request(app).post('/api/auth/register-code').send({ email });
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/auth/register')
        .send({ email, code: '000000', password: 'Aa12345678', name: 'Bob' });
      expect(r.status).toBe(400);
    }
    const real = readCode(email, 'register')!;
    const blocked = await request(app)
      .post('/api/auth/register')
      .send({ email, code: real, password: 'Aa12345678', name: 'Bob' });
    expect(blocked.status).toBe(429);
  });

  it('60 秒重发间隔会触发 429', async () => {
    const app = await getApp();
    const email = 'carol@test.local';
    const r1 = await request(app).post('/api/auth/register-code').send({ email });
    expect(r1.status).toBe(200);
    const r2 = await request(app).post('/api/auth/register-code').send({ email });
    expect(r2.status).toBe(429);
  });
});

describe('登录与退出', () => {
  it('注册后可登录，禁用后无法登录', async () => {
    const app = await getApp();
    const email = 'dave@test.local';
    await request(app).post('/api/auth/register-code').send({ email });
    const code = readCode(email, 'register')!;
    await request(app)
      .post('/api/auth/register')
      .send({ email, code, password: 'Aa12345678', name: 'Dave' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Aa12345678' });
    expect(login.status).toBe(200);

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPass1' });
    expect(bad.status).toBe(401);
  });
});
