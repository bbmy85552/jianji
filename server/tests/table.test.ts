import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, registerUser, resetData } from './helpers.js';

beforeAll(async () => {
  await getApp();
});

afterEach(async () => {
  await resetData();
});

describe('数据表', () => {
  it('可以从模板创建表格并新增记录', async () => {
    const app = await getApp();
    const { cookie } = await registerUser('table@test.local', 'TabUser');
    const ws = (await request(app).get('/api/workspaces').set('Cookie', cookie)).body.list[0];
    const tpl = await request(app).get('/api/tables/templates').set('Cookie', cookie);
    expect(tpl.body.templates.length).toBeGreaterThanOrEqual(7);
    expect(tpl.body.templates.map((t: { key: string }) => t.key)).toContain('asset_inventory');

    const created = await request(app)
      .post('/api/tables')
      .set('Cookie', cookie)
      .send({ workspaceId: ws.id, name: '我的项目', templateKey: 'project_tasks' });
    expect(created.status).toBe(200);
    const tableId = created.body.table.id;

    const detail = await request(app).get(`/api/tables/${tableId}`).set('Cookie', cookie);
    expect(detail.body.fields.length).toBeGreaterThan(0);
    expect(detail.body.records.length).toBeGreaterThan(0);

    const rec = await request(app)
      .post(`/api/tables/${tableId}/records`)
      .set('Cookie', cookie)
      .send({ data: { 任务名称: '新任务', 状态: '进行中' } });
    expect(rec.status).toBe(200);
    expect(rec.body.record.data['任务名称']).toBe('新任务');

    const selectField = await request(app)
      .post(`/api/tables/${tableId}/fields`)
      .set('Cookie', cookie)
      .send({ name: '风险等级', type: 'select', options: { choices: ['低', '中', '高'] } });
    expect(selectField.status).toBe(200);
    expect(selectField.body.field.options.choices).toEqual(['低', '中', '高']);
  });
});
