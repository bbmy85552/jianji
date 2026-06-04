import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, resetData, registerUser, loginAdmin } from './helpers.js';
import { prisma } from '../src/prisma.js';

async function createDoc(cookie: string[], title = '文档', kind: 'PRIVATE' | 'PUBLIC' = 'PRIVATE') {
  const app = await getApp();
  let workspaceId: string | undefined;
  if (kind === 'PRIVATE') {
    const ws = await request(app).get('/api/workspaces').set('Cookie', cookie);
    workspaceId = ws.body.list.find((w: { kind: string }) => w.kind === 'PRIVATE')?.id;
  } else {
    const pub = await prisma.workspace.findFirst({ where: { kind: 'PUBLIC' } });
    workspaceId = pub!.id;
  }
  const res = await request(app)
    .post('/api/docs')
    .set('Cookie', cookie)
    .send({ workspaceId, title });
  return res.body.doc as { id: string; title: string };
}

describe('M6 通知中心', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('未读数初始为 0；标记已读后归零', async () => {
    const app = await getApp();
    const alice = await registerUser('n1@m6.local', 'N1');
    const before = await request(app).get('/api/notifications/unread-count').set('Cookie', alice.cookie);
    expect(before.status).toBe(200);
    expect(before.body.count).toBe(0);

    const user = await prisma.user.findUnique({ where: { email: 'n1@m6.local' } });
    await prisma.notification.create({
      data: { userId: user!.id, category: 'system', title: '欢迎' },
    });
    const after = await request(app).get('/api/notifications/unread-count').set('Cookie', alice.cookie);
    expect(after.body.count).toBe(1);

    const list = await request(app).get('/api/notifications').set('Cookie', alice.cookie);
    expect(list.body.list.length).toBe(1);
    await request(app).post('/api/notifications/read-all').set('Cookie', alice.cookie);
    const zero = await request(app).get('/api/notifications/unread-count').set('Cookie', alice.cookie);
    expect(zero.body.count).toBe(0);
  });
});

describe('M6 偏好设置', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('GET 默认值；PUT 持久化', async () => {
    const app = await getApp();
    const alice = await registerUser('p1@m6.local');
    const get1 = await request(app).get('/api/me/preferences').set('Cookie', alice.cookie);
    expect(get1.status).toBe(200);
    expect(get1.body.preferences.theme).toBe('system');
    expect(get1.body.preferences.themeColor).toBe('#5E5CE6');

    const put = await request(app)
      .put('/api/me/preferences')
      .set('Cookie', alice.cookie)
      .send({ theme: 'dark', themeColor: '#16A34A', editorFontSize: 18, notifyEmail: true });
    expect(put.status).toBe(200);
    expect(put.body.preferences.theme).toBe('dark');
    expect(put.body.preferences.themeColor).toBe('#16A34A');
    expect(put.body.preferences.editorFontSize).toBe(18);

    const get2 = await request(app).get('/api/me/preferences').set('Cookie', alice.cookie);
    expect(get2.body.preferences.theme).toBe('dark');
    expect(get2.body.preferences.themeColor).toBe('#16A34A');
  });
});

describe('M6 文档收藏', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('收藏后 tree.favorites 出现该文档；取消后消失', async () => {
    const app = await getApp();
    const alice = await registerUser('f1@m6.local');
    const doc = await createDoc(alice.cookie, '我的笔记');
    const add = await request(app).post(`/api/docs/${doc.id}/favorite`).set('Cookie', alice.cookie);
    expect(add.status).toBe(200);
    const tree = await request(app).get('/api/docs/tree').set('Cookie', alice.cookie);
    expect(tree.body.favorites.map((d: { id: string }) => d.id)).toContain(doc.id);
    expect(tree.body.mine.find((d: { id: string }) => d.id === doc.id)?.isFavorite).toBe(true);

    await request(app).delete(`/api/docs/${doc.id}/favorite`).set('Cookie', alice.cookie);
    const tree2 = await request(app).get('/api/docs/tree').set('Cookie', alice.cookie);
    expect(tree2.body.favorites.map((d: { id: string }) => d.id)).not.toContain(doc.id);
  });
});

describe('M6 工作台聚合 / 最近', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('dashboard summary 含最近文档；recent 同时列出 doc/table/event', async () => {
    const app = await getApp();
    const alice = await registerUser('d1@m6.local');
    await createDoc(alice.cookie, '今日文档');

    const ws = await request(app).get('/api/workspaces').set('Cookie', alice.cookie);
    const wsid = ws.body.list[0].id;
    await request(app)
      .post('/api/tables')
      .set('Cookie', alice.cookie)
      .send({ workspaceId: wsid, name: '我的表', templateKey: 'project_tasks' });

    const start = new Date();
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await request(app)
      .post('/api/calendar')
      .set('Cookie', alice.cookie)
      .send({ title: '今日会议', startAt: start.toISOString(), endAt: end.toISOString() });

    const sum = await request(app).get('/api/dashboard/summary').set('Cookie', alice.cookie);
    expect(sum.status).toBe(200);
    expect(sum.body.recentDocs.length).toBeGreaterThan(0);
    expect(sum.body.todayEvents.length).toBeGreaterThan(0);

    const recent = await request(app).get('/api/recent').set('Cookie', alice.cookie);
    expect(recent.status).toBe(200);
    const types = new Set(recent.body.list.map((x: { type: string }) => x.type));
    expect(types.has('doc')).toBe(true);
    expect(types.has('table')).toBe(true);
    expect(types.has('event')).toBe(true);
  });
});

describe('M6 表单视图', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('所有者创建表单 -> 公开 GET 可拿到字段 -> 公开 POST 提交写入记录', async () => {
    const app = await getApp();
    const alice = await registerUser('fm@m6.local');
    const ws = await request(app).get('/api/workspaces').set('Cookie', alice.cookie);
    const wsid = ws.body.list[0].id;
    const t = await request(app)
      .post('/api/tables')
      .set('Cookie', alice.cookie)
      .send({ workspaceId: wsid, name: '问卷', templateKey: 'project_tasks' });
    const detail = await request(app)
      .get(`/api/tables/${t.body.table.id}`)
      .set('Cookie', alice.cookie);
    const titleField = detail.body.fields.find((f: { type: string; name: string }) => f.type === 'text');
    expect(titleField).toBeTruthy();

    const create = await request(app)
      .post(`/api/forms/by-table/${t.body.table.id}`)
      .set('Cookie', alice.cookie)
      .send({
        title: '收集反馈',
        fields: [{ name: titleField.name, required: true }],
      });
    expect(create.status).toBe(200);
    const token = create.body.form.token;

    const open = await request(app).get(`/api/public/forms/${token}`);
    expect(open.status).toBe(200);
    expect(open.body.form.fields[0].name).toBe(titleField.name);

    const submit = await request(app)
      .post(`/api/public/forms/${token}/submit`)
      .send({ data: { [titleField.name]: '我是公开访客' } });
    expect(submit.status).toBe(200);

    const after = await request(app)
      .get(`/api/tables/${t.body.table.id}`)
      .set('Cookie', alice.cookie);
    const found = after.body.records.find(
      (r: { data: Record<string, string> }) => r.data[titleField.name] === '我是公开访客',
    );
    expect(found).toBeTruthy();
  });

  it('表单未填必填字段返回 400', async () => {
    const app = await getApp();
    const alice = await registerUser('fm2@m6.local');
    const ws = await request(app).get('/api/workspaces').set('Cookie', alice.cookie);
    const wsid = ws.body.list[0].id;
    const t = await request(app)
      .post('/api/tables')
      .set('Cookie', alice.cookie)
      .send({ workspaceId: wsid, name: '问卷2', templateKey: 'project_tasks' });
    const detail2 = await request(app)
      .get(`/api/tables/${t.body.table.id}`)
      .set('Cookie', alice.cookie);
    const titleField = detail2.body.fields.find((f: { type: string; name: string }) => f.type === 'text');

    const create = await request(app)
      .post(`/api/forms/by-table/${t.body.table.id}`)
      .set('Cookie', alice.cookie)
      .send({
        title: '收集',
        fields: [{ name: titleField.name, required: true }],
      });
    const token = create.body.form.token;
    const bad = await request(app)
      .post(`/api/public/forms/${token}/submit`)
      .send({ data: {} });
    expect(bad.status).toBe(400);
  });
});

describe('M6 邮件转待办 & 管理员测试邮件', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('邮件 -> 待办 创建一条 TodoItem', async () => {
    const app = await getApp();
    const alice = await registerUser('mt@m6.local');
    const bind = await request(app)
      .post('/api/mail/quick-bind')
      .set('Cookie', alice.cookie)
      .send({ email: 'me@163.com', password: 'x', skipTest: true });
    const accountId = bind.body.account.id;
    const message = await prisma.mailMessage.create({
      data: {
        accountId,
        folder: 'INBOX',
        uid: 1,
        subject: '请处理报销',
        receivedAt: new Date(),
      },
    });
    const res = await request(app)
      .post(`/api/mail/messages/${message.id}/to-todo`)
      .set('Cookie', alice.cookie)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.todo.title).toContain('请处理报销');
  });

  it('管理员可发送测试邮件（测试环境可走 log transport）', async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const res = await request(app)
      .post('/api/admin/mail/test')
      .set('Cookie', admin.cookie)
      .send({ to: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(['log', 'smtp']).toContain(res.body.transport);
  });
});
