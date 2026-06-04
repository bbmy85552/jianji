import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, asApiError } from '../../lib/api';
import { useUiStore } from '../../store/ui';
import { Avatar, UserPicker } from '../../components/UserPicker';
import type { AdminGroup, UserSearchItem } from '../../lib/types';

export function AdminGroupsPage() {
  const showToast = useUiStore((s) => s.showToast);
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [creating, setCreating] = useState({ name: '', description: '' });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ list: AdminGroup[] }>('/admin/groups');
      setGroups(data.list);
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!creating.name.trim()) return;
    try {
      await api.post('/admin/groups', {
        name: creating.name.trim(),
        description: creating.description.trim() || undefined,
      });
      setCreating({ name: '', description: '' });
      showToast('已创建用户组', 'success');
      void load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const remove = async (id: string) => {
    const ok = await confirmDialog({
      title: '删除用户组',
      message: '删除该用户组？组内的成员关系会一同清除。',
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/groups/${id}`);
      void load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const addMember = async (groupId: string, user: UserSearchItem) => {
    try {
      await api.post(`/admin/groups/${groupId}/members`, { userId: user.id });
      void load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const removeMember = async (groupId: string, userId: string) => {
    try {
      await api.delete(`/admin/groups/${groupId}/members/${userId}`);
      void load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  return (
    <div className="py-6 sm:py-8 animate-fade-in-up">
      <header className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-text-primary">用户组</h1>
        <p className="text-text-secondary text-sm mt-1">将用户分组，便于后续批量分享或权限分配</p>
      </header>

      <div className="glass-panel rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2 text-sm font-medium text-text-primary">
          <Plus size={14} /> 创建用户组
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={creating.name}
            onChange={(e) => setCreating((s) => ({ ...s, name: e.target.value }))}
            placeholder="组名称"
            className="flex-1 h-9 px-2 text-sm rounded-md border border-black/10 bg-white"
          />
          <input
            value={creating.description}
            onChange={(e) => setCreating((s) => ({ ...s, description: e.target.value }))}
            placeholder="简介（可选）"
            className="flex-1 h-9 px-2 text-sm rounded-md border border-black/10 bg-white"
          />
          <button
            onClick={create}
            className="px-3 h-9 text-sm rounded-md bg-liquid-indigo text-white hover:bg-primary"
          >
            创建
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-sm text-text-secondary">
          还没有创建任何用户组
        </div>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.id} className="glass-panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-text-primary">{g.name}</div>
                  <div className="text-xs text-text-secondary mt-1">
                    {g.description || '（无简介）'} · 创建于 {new Date(g.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => remove(g.id)}
                  className="text-text-secondary hover:text-red-500"
                  title="删除组"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mb-3 max-w-md">
                <UserPicker
                  excludeIds={g.members.map((m) => m.user.id)}
                  onPick={(u) => addMember(g.id, u)}
                />
              </div>
              {g.members.length === 0 ? (
                <div className="text-xs text-text-secondary">还没有成员</div>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {g.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-2 px-2 py-1 rounded-full border border-black/10 bg-white"
                    >
                      <Avatar user={m.user} size={20} />
                      <span className="text-xs">{m.user.name}</span>
                      <button
                        onClick={() => removeMember(g.id, m.user.id)}
                        className="text-text-secondary hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
