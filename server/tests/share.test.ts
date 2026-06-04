import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, resetData, registerUser } from './helpers.js';

describe('文档分享与协作', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('owner 可以创建分享链接，受邀者可领取并编辑', async () => {
    const app = await getApp();
    const ownerReg = await registerUser('owner@share.local', 'Owner');
    expect(ownerReg.res.status).toBe(200);
    const ownerCookie = ownerReg.cookie;

    const guestReg = await registerUser('guest@share.local', 'Guest');
    expect(guestReg.res.status).toBe(200);
    const guestCookie = guestReg.cookie;

    const wsRes = await request(app).get('/api/workspaces').set('Cookie', ownerCookie);
    const workspaceId = wsRes.body.list[0].id;
    const docRes = await request(app)
      .post('/api/docs')
      .set('Cookie', ownerCookie)
      .send({ workspaceId, title: '共享文档' });
    expect(docRes.status).toBe(200);
    const docId = docRes.body.doc.id;

    const linkRes = await request(app)
      .post('/api/share')
      .set('Cookie', ownerCookie)
      .send({ resourceType: 'doc', resourceId: docId, role: 'edit' });
    expect(linkRes.status).toBe(200);
    const token = linkRes.body.link.token;

    const publicView = await request(app).get(`/api/share/${token}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.doc.title).toBe('共享文档');

    const claim = await request(app)
      .post(`/api/share/${token}/claim`)
      .set('Cookie', guestCookie)
      .send({});
    expect(claim.status).toBe(200);

    const editRes = await request(app)
      .patch(`/api/docs/${docId}`)
      .set('Cookie', guestCookie)
      .send({ contentJson: '<p>edited by guest</p>' });
    expect(editRes.status).toBe(200);
  });
});

describe('文档版本快照', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('可以创建版本并恢复', async () => {
    const app = await getApp();
    const reg = await registerUser('ver@share.local', 'Ver');
    const cookie = reg.cookie;
    const wsRes = await request(app).get('/api/workspaces').set('Cookie', cookie);
    const workspaceId = wsRes.body.list[0].id;
    const docRes = await request(app)
      .post('/api/docs')
      .set('Cookie', cookie)
      .send({ workspaceId, title: '版本测试', contentJson: '<p>v1</p>' });
    const docId = docRes.body.doc.id;
    const v1 = await request(app)
      .post(`/api/docs/${docId}/versions`)
      .set('Cookie', cookie)
      .send({ label: '第一版' });
    expect(v1.status).toBe(200);
    await request(app)
      .patch(`/api/docs/${docId}`)
      .set('Cookie', cookie)
      .send({ contentJson: '<p>v2</p>' });
    const restored = await request(app)
      .post(`/api/docs/${docId}/versions/${v1.body.version.id}/restore`)
      .set('Cookie', cookie)
      .send({});
    expect(restored.status).toBe(200);
    expect(restored.body.doc.contentJson).toBe('<p>v1</p>');
  });
});

describe('用户搜索', () => {
  beforeEach(async () => {
    await resetData();
  });

  it('登录后可以按邮箱或姓名搜索用户', async () => {
    const app = await getApp();
    const reg = await registerUser('seeker@share.local', 'Seeker');
    await registerUser('target@share.local', '小目标');
    const r = await request(app).get('/api/users/search?q=target').set('Cookie', reg.cookie);
    expect(r.status).toBe(200);
    expect(r.body.list.length).toBeGreaterThan(0);
    expect(r.body.list[0].email).toContain('target');
  });
});
