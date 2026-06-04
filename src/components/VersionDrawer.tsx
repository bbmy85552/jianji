import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, Save, X } from 'lucide-react';
import { api, asApiError } from '../lib/api';
import { useUiStore } from '../store/ui';
import type { DocumentVersion } from '../lib/types';

interface VersionDrawerProps {
  open: boolean;
  onClose: () => void;
  docId: string;
  canWrite: boolean;
  onRestored: () => void;
}

export function VersionDrawer({ open, onClose, docId, canWrite, onRestored }: VersionDrawerProps) {
  const showToast = useUiStore((s) => s.showToast);
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const [list, setList] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ list: DocumentVersion[] }>(`/docs/${docId}/versions`);
      setList(data.list);
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    } finally {
      setLoading(false);
    }
  }, [docId, showToast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const snapshot = async () => {
    try {
      await api.post(`/docs/${docId}/versions`, { label: label.trim() || undefined });
      setLabel('');
      showToast('已保存版本', 'success');
      void load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const restore = async (id: string) => {
    const ok = await confirmDialog({
      title: '恢复版本',
      message: '恢复到该版本？当前内容会自动保存为新版本。',
      confirmText: '恢复',
    });
    if (!ok) return;
    try {
      await api.post(`/docs/${docId}/versions/${id}/restore`, {});
      showToast('已恢复', 'success');
      onRestored();
      onClose();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-sm bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <History size={16} /> 版本历史
          </div>
          <button onClick={onClose} className="p-1.5 text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        {canWrite && (
          <div className="p-3 border-b border-black/5 flex gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="为本次版本添加备注（可选）"
              maxLength={40}
              className="flex-1 h-8 px-2 text-sm rounded-md border border-black/10 bg-white"
            />
            <button
              onClick={snapshot}
              className="flex items-center gap-1 h-8 px-3 rounded-md bg-liquid-indigo text-white text-xs hover:bg-primary"
            >
              <Save size={12} /> 保存当前
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && <div className="text-xs text-text-secondary py-4">加载中…</div>}
          {!loading && list.length === 0 && (
            <div className="text-xs text-text-secondary py-6 text-center">还没有版本快照</div>
          )}
          <ul className="space-y-2">
            {list.map((v) => (
              <li key={v.id} className="p-3 rounded-xl border border-black/5 bg-white">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-text-primary truncate">{v.label || v.title}</div>
                  {canWrite && (
                    <button
                      onClick={() => restore(v.id)}
                      className="flex items-center gap-1 text-xs text-liquid-indigo hover:underline"
                    >
                      <RotateCcw size={12} /> 恢复
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-text-secondary mt-1">
                  {v.author.name} · {new Date(v.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
