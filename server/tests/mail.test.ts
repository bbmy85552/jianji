import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, resetData, registerUser } from './helpers.js';

describe('邮箱 一键绑定', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('已知服务商可被识别', async () => {
    const app = await getApp();
    const alice = await registerUser('a@m3.local', 'A');
    const res = await request(app)
      .post('/api/mail/detect')
      .set('Cookie', alice.cookie)
      .send({ email: 'me@163.com' });
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(res.body.provider.key).toBe('163');
    expect(res.body.provider.imapHost).toBe('imap.163.com');
  });

  it('未知域名返回 matched=false', async () => {
    const app = await getApp();
    const alice = await registerUser('a2@m3.local', 'A');
    const res = await request(app)
      .post('/api/mail/detect')
      .set('Cookie', alice.cookie)
      .send({ email: 'me@unknown-domain.test' });
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(false);
  });

  it('quick-bind 无密码会校验失败', async () => {
    const app = await getApp();
    const alice = await registerUser('a3@m3.local', 'A');
    const res = await request(app)
      .post('/api/mail/quick-bind')
      .set('Cookie', alice.cookie)
      .send({ email: 'me@163.com' });
    expect(res.status).toBe(400);
  });

  it('quick-bind 未知服务商被拒绝', async () => {
    const app = await getApp();
    const alice = await registerUser('a4@m3.local', 'A');
    const res = await request(app)
      .post('/api/mail/quick-bind')
      .set('Cookie', alice.cookie)
      .send({ email: 'me@unknown-domain.test', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PROVIDER_UNKNOWN');
  });

  it('skipTest=true 允许在不联网的情况下保存', async () => {
    const app = await getApp();
    const alice = await registerUser('a5@m3.local', 'A');
    const res = await request(app)
      .post('/api/mail/quick-bind')
      .set('Cookie', alice.cookie)
      .send({ email: 'me@163.com', password: 'token', skipTest: true });
    expect(res.status).toBe(200);
    expect(res.body.account.email).toBe('me@163.com');
    expect(res.body.account.imapHost).toBe('imap.163.com');
    expect(res.body.account.smtpHost).toBe('smtp.163.com');
  });
});

describe('表格 XLSX 导出', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('返回 xlsx mime', async () => {
    const app = await getApp();
    const alice = await registerUser('xl@m3.local', 'X');
    const wsRes = await request(app).get('/api/workspaces').set('Cookie', alice.cookie);
    const workspaceId = wsRes.body.list[0].id;
    const t = await request(app)
      .post('/api/tables')
      .set('Cookie', alice.cookie)
      .send({ workspaceId, name: 'xlsx', templateKey: 'project_tasks' });
    const res = await request(app)
      .get(`/api/tables/${t.body.table.id}/export?format=xlsx`)
      .buffer(true)
      .parse((response, callback) => {
        response.setEncoding('binary');
        let data = '';
        response.on('data', (chunk: string) => {
          data += chunk;
        });
        response.on('end', () => callback(null, Buffer.from(data, 'binary')));
      })
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const buf = res.body as Buffer;
    expect(buf.length).toBeGreaterThan(100);
    // XLSX 文件以 PK (zip) 头开头
    expect(buf.slice(0, 2).toString()).toBe('PK');
  });
});
