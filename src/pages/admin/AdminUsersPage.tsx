import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldOff,
  KeyRound,
  RefreshCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { api, asApiError } from '../../lib/api';
import { useUiStore } from '../../store/ui';
import { Modal } from '../../components/Modal';
import type { AdminUser } from '../../lib/types';

interface Page {
  list: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export function AdminUsersPage() {
  const showToast = useUiStore((s) => s.showToast);
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const alertDialog = useUiStore((s) => s.alertDialog);
  const [data, setData] = useState<Page>({ list: [], total: 0, page: 1, pageSize: 20 });
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState({
    email: '',
    name: '',
    role: 'USER' as 'USER' | 'ADMIN',
    status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
    password: '',
  });

  const load = useCallback(
    async (page = data.page, search = q) => {
      try {
        const { data: r } = await api.get<Page>('/admin/users', {
          params: { page, pageSize: data.pageSize, q: search || undefined },
        });
        setData(r);
      } catch (err) {
        showToast(asApiError(err).error, 'error');
      }
    },
    [data.page, data.pageSize, q, showToast],
  );

  useEffect(() => {
    void load(1, '');
  }, []);

  const update = async (u: AdminUser, patch: Partial<AdminUser>) => {
    try {
      const { data } = await api.patch<{ user: AdminUser }>(`/admin/users/${u.id}`, patch);
      showToast('已更新', 'success');
      setData((prev) => ({
        ...prev,
        list: prev.list.map((x) => (x.id === u.id ? { ...x, ...data.user } : x)),
      }));
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const resetPassword = async (u: AdminUser) => {
    const ok = await confirmDialog({
      title: '重置密码',
      message: `确认重置 ${u.email} 的密码？`,
      confirmText: '重置',
      danger: true,
    });
    if (!ok) return;
    try {
      const { data } = await api.post<{ password: string }>(`/admin/users/${u.id}/reset-password`);
      await alertDialog({
        title: `${u.email} 的新密码`,
        message: data.password,
        mono: true,
      });
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const remove = async (u: AdminUser) => {
    const ok = await confirmDialog({
      title: '删除用户',
      message: `彻底删除用户 ${u.email}？该用户的所有数据将一并清除,且不可恢复。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      showToast('用户已删除', 'success');
      void load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const create = async () => {
    if (!creating.email || !creating.name) {
      showToast('请填写邮箱和姓名', 'error');
      return;
    }
    try {
      const { data } = await api.post<{ initialPassword: string }>('/admin/users', {
        email: creating.email,
        name: creating.name,
        role: creating.role,
        status: creating.status,
        password: creating.password || undefined,
      });
      showToast('已创建用户', 'success');
      setCreateOpen(false);
      setCreating({ email: '', name: '', role: 'USER', status: 'ACTIVE', password: '' });
      void load(1, '');
      await alertDialog({
        title: `${creating.email} 的初始密码`,
        message: data.initialPassword,
        mono: true,
      });
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="py-6 sm:py-8 animate-fade-in-up">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold text-text-primary">用户管理</h1>
          <p className="text-text-secondary text-sm mt-1">查看、调整角色、重置密码、禁用账号</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-liquid-indigo text-white text-sm hover:bg-primary"
        >
          <UserPlus size={14} /> 新建用户
        </button>
      </header>

      <div className="flex items-center gap-2 mb-4 max-w-md">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
          />
          <input
            value={q}
            placeholder="按邮箱或姓名搜索"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load(1);
            }}
            className="w-full pl-8 pr-3 h-9 rounded-lg border border-black/10 bg-white outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15 text-sm"
          />
        </div>
        <button
          onClick={() => load(1)}
          className="px-3 h-9 rounded-lg border border-black/10 text-sm hover:bg-black/5 flex items-center gap-1"
        >
          <RefreshCcw size={14} /> 刷新
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-secondary border-b border-black/5 bg-black/[0.02]">
              <tr>
                <th className="px-4 py-2">用户</th>
                <th className="px-4 py-2">邮箱</th>
                <th className="px-4 py-2">角色</th>
                <th className="px-4 py-2">状态</th>
                <th className="px-4 py-2">最近登录</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.list.map((u) => (
                <tr key={u.id} className="border-b border-black/5 hover:bg-black/[0.02]">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} className="w-7 h-7 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-liquid-indigo/15 text-liquid-indigo flex items-center justify-center text-xs">
                          {u.name[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-text-primary text-sm">{u.name}</div>
                        <div className="text-xs text-text-secondary">{u.id.slice(0, 6)}…</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        update(u, { role: e.target.value as 'USER' | 'ADMIN' })
                      }
                      className="h-7 px-2 text-xs rounded-md border border-black/10 bg-white"
                    >
                      <option value="USER">普通用户</option>
                      <option value="ADMIN">管理员</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={u.status}
                      onChange={(e) =>
                        update(u, { status: e.target.value as 'ACTIVE' | 'DISABLED' })
                      }
                      className="h-7 px-2 text-xs rounded-md border border-black/10 bg-white"
                    >
                      <option value="ACTIVE">启用</option>
                      <option value="DISABLED">禁用</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-xs text-text-secondary">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => resetPassword(u)}
                        className="flex items-center gap-1 px-2 h-7 text-xs rounded-md border border-black/10 hover:bg-black/5"
                      >
                        <KeyRound size={12} /> 重置
                      </button>
                      <button
                        onClick={() =>
                          update(u, { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
                        }
                        className="flex items-center gap-1 px-2 h-7 text-xs rounded-md border border-black/10 hover:bg-black/5"
                      >
                        {u.status === 'ACTIVE' ? (
                          <>
                            <ShieldOff size={12} /> 禁用
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={12} /> 启用
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => remove(u)}
                        className="flex items-center gap-1 px-2 h-7 text-xs rounded-md border border-red-200 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={12} /> 删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.list.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-text-secondary">
                    没有匹配的用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs text-text-secondary border-t border-black/5">
          <span>
            共 {data.total} 人 · 第 {data.page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => data.page > 1 && load(data.page - 1)}
              disabled={data.page <= 1}
              className="p-1 rounded hover:bg-black/5 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => data.page < totalPages && load(data.page + 1)}
              disabled={data.page >= totalPages}
              className="p-1 rounded hover:bg-black/5 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建用户" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">邮箱</label>
            <input
              type="email"
              value={creating.email}
              onChange={(e) => setCreating((s) => ({ ...s, email: e.target.value }))}
              className="w-full h-9 px-2 text-sm rounded-md border border-black/10 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">姓名</label>
            <input
              value={creating.name}
              onChange={(e) => setCreating((s) => ({ ...s, name: e.target.value }))}
              className="w-full h-9 px-2 text-sm rounded-md border border-black/10 bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">角色</label>
              <select
                value={creating.role}
                onChange={(e) => setCreating((s) => ({ ...s, role: e.target.value as 'USER' | 'ADMIN' }))}
                className="w-full h-9 px-2 text-sm rounded-md border border-black/10 bg-white"
              >
                <option value="USER">普通用户</option>
                <option value="ADMIN">管理员</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">状态</label>
              <select
                value={creating.status}
                onChange={(e) =>
                  setCreating((s) => ({ ...s, status: e.target.value as 'ACTIVE' | 'DISABLED' }))
                }
                className="w-full h-9 px-2 text-sm rounded-md border border-black/10 bg-white"
              >
                <option value="ACTIVE">启用</option>
                <option value="DISABLED">禁用</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">
              初始密码（留空将自动生成）
            </label>
            <input
              value={creating.password}
              onChange={(e) => setCreating((s) => ({ ...s, password: e.target.value }))}
              placeholder="至少 8 位"
              className="w-full h-9 px-2 text-sm rounded-md border border-black/10 bg-white"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="px-3 h-9 text-sm rounded-md border border-black/10 hover:bg-black/5"
            >
              取消
            </button>
            <button
              onClick={create}
              className="px-3 h-9 text-sm rounded-md bg-liquid-indigo text-white hover:bg-primary"
            >
              创建
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
