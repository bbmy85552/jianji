import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Table, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { api, asApiError } from '../../lib/api';
import { useUiStore } from '../../store/ui';
import type { RecentItem } from '../../lib/types';

const TYPE_LABEL: Record<string, string> = {
  all: '全部',
  doc: '文档',
  table: '数据表',
  event: '日程',
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { hour12: false });
}

export function RecentPage() {
  const showToast = useUiStore((s) => s.showToast);
  const [items, setItems] = useState<RecentItem[]>([]);
  const [type, setType] = useState<'all' | 'doc' | 'table' | 'event'>('all');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ list: RecentItem[] }>('/recent', { params: { type } });
      setItems(data.list);
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    } finally {
      setLoading(false);
    }
  }, [type, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const targetFor = (item: RecentItem) => {
    if (item.type === 'doc') return `/app/docs/${item.id}`;
    if (item.type === 'table') return `/app/tables/${item.id}`;
    return '/app/calendar';
  };

  return (
    <div className="animate-fade-in-up py-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-text-primary tracking-tight mb-1">
            最近
          </h1>
          <p className="text-text-secondary text-sm">汇总你近期编辑或查看过的文档、表格与日程。</p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg border border-black/10 text-sm text-text-secondary hover:bg-black/5 inline-flex items-center gap-1"
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </header>

      <div className="flex gap-2 mb-4">
        {(['all', 'doc', 'table', 'event'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setType(k)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              type === k
                ? 'bg-liquid-indigo text-white'
                : 'border border-black/10 text-text-secondary hover:bg-black/5'
            }`}
          >
            {TYPE_LABEL[k]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-sm text-text-secondary text-center">
          加载中…
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-sm text-text-secondary text-center">
          暂无最近活动
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = item.type === 'doc' ? FileText : item.type === 'table' ? Table : CalendarIcon;
            return (
              <li key={`${item.type}-${item.id}`}>
                <Link
                  to={targetFor(item)}
                  className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 hover:shadow-md transition"
                >
                  <span className="w-8 h-8 rounded-lg bg-liquid-indigo/10 text-liquid-indigo flex items-center justify-center">
                    <Icon size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {item.title || '未命名'}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {TYPE_LABEL[item.type]} · {fmt(item.updatedAt)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
