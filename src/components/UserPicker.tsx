import { useEffect, useRef, useState } from 'react';
import { api, asApiError } from '../lib/api';
import type { UserSearchItem } from '../lib/types';
import { useUiStore } from '../store/ui';

interface UserPickerProps {
  placeholder?: string;
  onPick: (user: UserSearchItem) => void;
  excludeIds?: string[];
}

export function UserPicker({ placeholder = '输入姓名或邮箱…', onPick, excludeIds }: UserPickerProps) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<UserSearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    if (!q.trim()) {
      setList([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<{ list: UserSearchItem[] }>('/users/search', {
          params: { q: q.trim(), limit: 8 },
        });
        if (cancelled) return;
        const excluded = new Set(excludeIds ?? []);
        setList(data.list.filter((u) => !excluded.has(u.id)));
      } catch (err) {
        if (!cancelled) showToast(asApiError(err).error, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, excludeIds, showToast]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        className="w-full h-9 px-3 text-sm rounded-lg border border-black/10 bg-white/90 outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15"
      />
      {open && q.trim() && (
        <div className="absolute z-30 mt-1 left-0 right-0 bg-white rounded-xl shadow-lg border border-black/10 max-h-72 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-text-secondary">搜索中…</div>}
          {!loading && list.length === 0 && (
            <div className="px-3 py-3 text-xs text-text-secondary">没有匹配的用户</div>
          )}
          {list.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                onPick(u);
                setQ('');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-liquid-indigo/5"
            >
              <Avatar user={u} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">{u.name}</div>
                <div className="text-xs text-text-secondary truncate">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Avatar({ user, size = 28 }: { user: { name: string; email: string; avatarUrl: string | null }; size?: number }) {
  const initial = (user.name?.[0] || user.email?.[0] || '?').toUpperCase();
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover bg-black/5"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-liquid-indigo/15 text-liquid-indigo flex items-center justify-center text-xs font-medium"
    >
      {initial}
    </div>
  );
}
