import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, registerUser, resetData } from './helpers.js';

beforeAll(async () => {
  await getApp();
});

afterEach(async () => {
  await resetData();
});

describe('文档 CRUD 与权限', () => {
  it('创建/读取/更新/删除自己的文档', async () => {
    const app = await getApp();
    const { cookie } = await registerUser('docuser@test.local', 'DocUser');
    const wsList = await request(app).get('/api/workspaces').set('Cookie', cookie);
    const ws = wsList.body.list[0];

    const created = await request(app)
      .post('/api/docs')
      .set('Cookie', cookie)
      .send({ workspaceId: ws.id, title: '我的第一篇' });
    expect(created.status).toBe(200);
    const docId = created.body.doc.id;

    const read = await request(app).get(`/api/docs/${docId}`).set('Cookie', cookie);
    expect(read.status).toBe(200);
    expect(read.body.doc.title).toBe('我的第一篇');

    const updated = await request(app)
      .patch(`/api/docs/${docId}`)
      .set('Cookie', cookie)
      .send({ title: '改后的标题', contentJson: '{"type":"doc","content":[]}' });
    expect(updated.status).toBe(200);
    expect(updated.body.doc.title).toBe('改后的标题');

    const removed = await request(app)
      .delete(`/api/docs/${docId}`)
      .set('Cookie', cookie);
    expect(removed.status).toBe(200);
  });

  it('非所有者无法访问他人文档', async () => {
    const app = await getApp();
    const a = await registerUser('ownerA@test.local', 'OwnerA');
    const wsA = (await request(app).get('/api/workspaces').set('Cookie', a.cookie)).body.list[0];
    const doc = (
      await request(app)
        .post('/api/docs')
        .set('Cookie', a.cookie)
        .send({ workspaceId: wsA.id, title: '私密文档' })
    ).body.doc;

    const b = await registerUser('peerB@test.local', 'PeerB');
    const forbidden = await request(app).get(`/api/docs/${doc.id}`).set('Cookie', b.cookie);
    expect(forbidden.status).toBe(403);
  });
});
