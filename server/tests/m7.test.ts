import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, registerUser, resetData } from './helpers.js';

beforeAll(async () => {
  await getApp();
});

afterEach(async () => {
  await resetData();
});

describe('M7 - 文档树移动 / 公式字段', () => {
  it('PATCH /docs/:id 设置 parentId 后,GET /docs/tree 反映层级', async () => {
    const app = await getApp();
    const { cookie } = await registerUser('tree@test.local', 'TreeUser');

    const a = await request(app).post('/api/docs').set('Cookie', cookie).send({ title: '父文档' });
    const b = await request(app).post('/api/docs').set('Cookie', cookie).send({ title: '子文档' });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const move = await request(app)
      .patch(`/api/docs/${b.body.doc.id}`)
      .set('Cookie', cookie)
      .send({ parentId: a.body.doc.id });
    expect(move.status).toBe(200);
    expect(move.body.doc.parentId).toBe(a.body.doc.id);

    const tree = await request(app).get('/api/docs/tree').set('Cookie', cookie);
    expect(tree.status).toBe(200);
    const child = tree.body.mine.find((d: any) => d.id === b.body.doc.id);
    expect(child.parentId).toBe(a.body.doc.id);
  });

  it('PATCH /docs/:id 不允许把节点移动到自身的子孙下', async () => {
    const app = await getApp();
    const { cookie } = await registerUser('cycle@test.local', 'CycleUser');

    const a = await request(app).post('/api/docs').set('Cookie', cookie).send({ title: 'A' });
    const b = await request(app)
      .post('/api/docs')
      .set('Cookie', cookie)
      .send({ title: 'B', parentId: a.body.doc.id });

    // 把 A 移动到 B 下,应该被拒绝(B 是 A 的子)
    const r = await request(app)
      .patch(`/api/docs/${a.body.doc.id}`)
      .set('Cookie', cookie)
      .send({ parentId: b.body.doc.id });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('CYCLIC_PARENT');
  });

  it('PATCH /docs/:id 不允许把节点设置为自身的父', async () => {
    const app = await getApp();
    const { cookie } = await registerUser('self@test.local', 'SelfUser');
    const a = await request(app).post('/api/docs').set('Cookie', cookie).send({ title: 'X' });
    const r = await request(app)
      .patch(`/api/docs/${a.body.doc.id}`)
      .set('Cookie', cookie)
      .send({ parentId: a.body.doc.id });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_PARENT');
  });

  it('可以创建 formula 类型字段且字段类型被正确保存', async () => {
    const app = await getApp();
    const { cookie } = await registerUser('formula@test.local', 'FormulaUser');

    const ws = (await request(app).get('/api/workspaces').set('Cookie', cookie)).body.list[0];
    const t = await request(app)
      .post('/api/tables')
      .set('Cookie', cookie)
      .send({ workspaceId: ws.id, name: '公式表', templateKey: 'project_tasks' });
    expect(t.status).toBe(200);
    const tableId = t.body.table.id;

    const f = await request(app)
      .post(`/api/tables/${tableId}/fields`)
      .set('Cookie', cookie)
      .send({
        name: '总价',
        type: 'formula',
        options: { formula: '{数量} * {单价}' },
      });
    expect(f.status).toBe(200);
    expect(f.body.field.type).toBe('formula');
    const opts =
      typeof f.body.field.options === 'string'
        ? JSON.parse(f.body.field.options)
        : f.body.field.options;
    expect(opts.formula).toBe('{数量} * {单价}');
  });
});
