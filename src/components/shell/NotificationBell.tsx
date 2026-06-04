import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { NotificationItem } from '../../lib/types';

function timeAgo(iso: string) {
  const now = Date.now();
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return iso.slice(0, 10);
}

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  const loadUnread = useCallback(async () => {
    try {
      const { data } = await api.get<{ count: number }>('/notifications/unread-count');
      setUnread(data.count);
    } catch {
      /* ignore */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ list: NotificationItem[] }>(
        '/notifications?pageSize=12',
      );
      setList(data.list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnread();
    const t = window.setInterval(loadUnread, 60_000);
    return () => window.clearInterval(t);
  }, [loadUnread]);

  useEffect(() => {
    if (!open) return;
    void loadList();
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, loadList]);

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`).catch(() => undefined);
    setList((arr) => arr.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    void loadUnread();
  };

  const markAll = async () => {
    await api.post('/notifications/read-all').catch(() => undefined);
    setList((arr) => arr.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-text-secondary hover:text-liquid-indigo hover:bg-liquid-indigo/5 rounded-full transition-colors"
        aria-label="通知"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 text-[10px] leading-4 bg-red-500 text-white rounded-full text-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[480px] bg-white border border-black/5 rounded-2xl shadow-xl z-30 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <div className="text-sm font-semibold text-text-primary">通知</div>
            <button
              onClick={markAll}
              className="flex items-center gap-1 text-xs text-liquid-indigo hover:underline"
              title="全部标为已读"
            >
              <CheckCheck size={12} /> 全部已读
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-6 text-center text-sm text-text-secondary">加载中…</div>
            )}
            {!loading && list.length === 0 && (
              <div className="p-8 text-center text-sm text-text-secondary">暂无通知</div>
            )}
            {!loading &&
              list.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-black/5 ${
                    n.readAt ? 'bg-white' : 'bg-liquid-indigo/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <Link
                          to={n.link}
                          onClick={() => {
                            setOpen(false);
                            void markRead(n.id);
                          }}
                          className="text-sm font-medium text-text-primary hover:text-liquid-indigo"
                        >
                          {n.title}
                        </Link>
                      ) : (
                        <div className="text-sm font-medium text-text-primary">{n.title}</div>
                      )}
                      {n.body && (
                        <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</div>
                      )}
                      <div className="text-[10px] text-text-secondary mt-1">{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.readAt && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1 text-text-secondary hover:text-emerald-600"
                        title="标记已读"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
