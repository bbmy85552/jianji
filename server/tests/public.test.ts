import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, resetData, registerUser, loginAdmin } from './helpers.js';
import { prisma } from '../src/prisma.js';

async function getPublicWorkspaceId() {
  const ws = await prisma.workspace.findFirst({ where: { kind: 'PUBLIC' } });
  if (!ws) throw new Error('public workspace missing');
  return ws.id;
}

describe('公共知识库 + 权限模型', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('用户可在公共知识库创建文档，其他登录用户默认可查看但不可编辑或删除', async () => {
    const app = await getApp();
    const alice = await registerUser('alice@public.local', 'Alice');
    const bob = await registerUser('bob@public.local', 'Bob');
    const wsId = await getPublicWorkspaceId();

    const create = await request(app)
      .post('/api/docs')
      .set('Cookie', alice.cookie)
      .send({ workspaceKind: 'PUBLIC', title: 'Alice 公共文档' });
    expect(create.status).toBe(200);
    expect(create.body.doc.workspaceId).toBe(wsId);
    const docId = create.body.doc.id;

    const bobRead = await request(app).get(`/api/docs/${docId}`).set('Cookie', bob.cookie);
    expect(bobRead.status).toBe(200);
    expect(bobRead.body.access.canRead).toBe(true);
    expect(bobRead.body.access.canWrite).toBe(false);
    expect(bobRead.body.access.canDelete).toBe(false);

    const bobEdit = await request(app)
      .patch(`/api/docs/${docId}`)
      .set('Cookie', bob.cookie)
      .send({ contentJson: '<p>恶意编辑</p>' });
    expect(bobEdit.status).toBe(403);

    const bobDelete = await request(app).delete(`/api/docs/${docId}`).set('Cookie', bob.cookie);
    expect(bobDelete.status).toBe(403);
  });

  it('公共文档协作者可编辑但不可删除或邀请；所有者与管理员都可删除', async () => {
    const app = await getApp();
    const alice = await registerUser('alice2@public.local', 'Alice');
    const bob = await registerUser('bob2@public.local', 'Bob');
    const charlie = await registerUser('charlie@public.local', 'Charlie');
    const admin = await loginAdmin();

    const create = await request(app)
      .post('/api/docs')
      .set('Cookie', alice.cookie)
      .send({ workspaceKind: 'PUBLIC', title: '协作演示' });
    const docId = create.body.doc.id;

    // alice 邀请 bob 为 EDITOR
    const invite = await request(app)
      .post(`/api/docs/${docId}/collaborators`)
      .set('Cookie', alice.cookie)
      .send({ email: 'bob2@public.local', role: 'EDITOR' });
    expect(invite.status).toBe(200);

    // bob 可编辑
    const bobEdit = await request(app)
      .patch(`/api/docs/${docId}`)
      .set('Cookie', bob.cookie)
      .send({ contentJson: '<p>bob 已编辑</p>' });
    expect(bobEdit.status).toBe(200);

    // bob 不可删除
    const bobDel = await request(app).delete(`/api/docs/${docId}`).set('Cookie', bob.cookie);
    expect(bobDel.status).toBe(403);

    // bob 不可邀请其他人
    const bobInvite = await request(app)
      .post(`/api/docs/${docId}/collaborators`)
      .set('Cookie', bob.cookie)
      .send({ email: 'charlie@public.local', role: 'EDITOR' });
    expect(bobInvite.status).toBe(403);

    // 管理员可删除
    const adminDel = await request(app).delete(`/api/docs/${docId}`).set('Cookie', admin.cookie);
    expect(adminDel.status).toBe(200);

    // charlie 用作 placeholder，确保创建未影响
    expect(charlie.res.status).toBe(200);
  });

  it('私人文档对非协作者完全不可见', async () => {
    const app = await getApp();
    const alice = await registerUser('p1@public.local', 'Alice');
    const bob = await registerUser('p2@public.local', 'Bob');
    const wsRes = await request(app).get('/api/workspaces').set('Cookie', alice.cookie);
    const workspaceId = wsRes.body.list[0].id;
    const create = await request(app)
      .post('/api/docs')
      .set('Cookie', alice.cookie)
      .send({ workspaceId, title: '私人' });
    const docId = create.body.doc.id;
    const bobRead = await request(app).get(`/api/docs/${docId}`).set('Cookie', bob.cookie);
    expect(bobRead.status).toBe(403);
    const tree = await request(app).get('/api/docs/tree').set('Cookie', bob.cookie);
    expect(tree.status).toBe(200);
    expect(tree.body.mine.find((d: { id: string }) => d.id === docId)).toBeUndefined();
    expect(tree.body.public.find((d: { id: string }) => d.id === docId)).toBeUndefined();
  });
});

describe('导出', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('文档可以导出为 Markdown / HTML', async () => {
    const app = await getApp();
    const alice = await registerUser('exp@public.local', 'Alice');
    const wsRes = await request(app).get('/api/workspaces').set('Cookie', alice.cookie);
    const workspaceId = wsRes.body.list[0].id;
    const doc = await request(app)
      .post('/api/docs')
      .set('Cookie', alice.cookie)
      .send({ workspaceId, title: '导出测试', contentJson: '<h1>标题</h1><p>正文</p>' });
    const docId = doc.body.doc.id;
    const md = await request(app)
      .get(`/api/docs/${docId}/export?format=md`)
      .set('Cookie', alice.cookie);
    expect(md.status).toBe(200);
    expect(md.text).toContain('# 标题');
    const html = await request(app)
      .get(`/api/docs/${docId}/export?format=html`)
      .set('Cookie', alice.cookie);
    expect(html.status).toBe(200);
    expect(html.text).toContain('<h1>标题</h1>');
  });

  it('表格可以导出为 CSV', async () => {
    const app = await getApp();
    const alice = await registerUser('expt@public.local', 'Alice');
    const wsRes = await request(app).get('/api/workspaces').set('Cookie', alice.cookie);
    const workspaceId = wsRes.body.list[0].id;
    const t = await request(app)
      .post('/api/tables')
      .set('Cookie', alice.cookie)
      .send({ workspaceId, name: '导出表', templateKey: 'project_tasks' });
    const tableId = t.body.table.id;
    const csv = await request(app)
      .get(`/api/tables/${tableId}/export?format=csv`)
      .set('Cookie', alice.cookie);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('任务名称');
  });
});

describe('日历 CRUD', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('用户可以创建并查询日程', async () => {
    const app = await getApp();
    const alice = await registerUser('cal@public.local', 'Cal');
    const create = await request(app)
      .post('/api/calendar')
      .set('Cookie', alice.cookie)
      .send({
        title: '产品评审',
        startAt: '2026-05-20T10:00:00.000Z',
        endAt: '2026-05-20T11:00:00.000Z',
        reminderMinutes: 30,
      });
    expect(create.status).toBe(200);
    const list = await request(app)
      .get('/api/calendar?from=2026-05-01&to=2026-06-01')
      .set('Cookie', alice.cookie);
    expect(list.status).toBe(200);
    expect(list.body.list.length).toBeGreaterThan(0);
  });
});
