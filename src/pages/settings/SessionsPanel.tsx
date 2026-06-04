import { useCallback, useEffect, useState } from 'react';
import { Monitor, Smartphone, Globe, Trash2, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, asApiError } from '../../lib/api';
import { useUiStore } from '../../store/ui';

interface SessionItem {
  id: string;
  userAgent: string | null;
  ipAddr: string | null;
  lastSeenAt: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  isActive: boolean;
  isCurrent: boolean;
}

interface SessionsResponse {
  currentId: string | null;
  sessions: SessionItem[];
}

function detectDeviceIcon(ua: string | null) {
  if (!ua) return <Globe size={14} />;
  if (/iPhone|Android|Mobile/i.test(ua)) return <Smartphone size={14} />;
  return <Monitor size={14} />;
}

function describeUA(ua: string | null): string {
  if (!ua) return '未知设备';
  let browser = '浏览器';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  let os = '';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return os ? `${browser} · ${os}` : browser;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return d.toLocaleDateString();
}

export function SessionsPanel() {
  const showToast = useUiStore((s) => s.showToast);
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const hasActiveOtherSession = sessions.some((s) => s.isActive && !s.isCurrent);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<SessionsResponse>('/me/sessions');
      setSessions(data.sessions);
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const revokeOne = async (id: string) => {
    const ok = await confirmDialog({
      title: '注销设备',
      message: '确认注销该设备的会话？此后该设备需重新登录。',
      confirmText: '注销',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/me/sessions/${id}`);
      showToast('已注销', 'success');
      void load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  const revokeAllOthers = async () => {
    const ok = await confirmDialog({
      title: '注销其他设备',
      message: '确认退出当前设备外的所有登录？',
      confirmText: '全部注销',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete('/me/sessions/others');
      showToast('已注销其他设备', 'success');
      void load();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-text-primary inline-flex items-center gap-2">
          <ShieldCheck size={14} className="text-liquid-indigo" /> 登录设备
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="text-xs px-2 py-1 rounded-md text-text-secondary hover:bg-black/5 inline-flex items-center gap-1"
          >
            <RefreshCw size={12} /> 刷新
          </button>
          {hasActiveOtherSession && (
            <button
              onClick={revokeAllOthers}
              className="text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-50"
            >
              注销其他设备
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-text-secondary mb-3">
        登录过的设备会留痕；注销设备会让对应会话立即失效，但不会保存或展示任何密码。
      </div>
      {loading && sessions.length === 0 ? (
        <div className="text-sm text-text-secondary py-6 text-center">加载中…</div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-text-secondary py-6 text-center">没有登录记录</div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const expired = Boolean(s.expiresAt && new Date(s.expiresAt).getTime() < Date.now());
            const revoked = Boolean(s.revokedAt);
            return (
            <li
              key={s.id}
              className={`rounded-xl border p-3 flex items-start gap-3 ${
                s.isCurrent
                  ? 'border-liquid-indigo/40 bg-liquid-indigo/5'
                  : revoked || expired
                    ? 'border-black/10 bg-surface-container-low opacity-80'
                    : 'border-black/10 bg-surface-container-lowest'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center text-text-secondary shrink-0">
                {detectDeviceIcon(s.userAgent)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {describeUA(s.userAgent)}
                  </div>
                  {s.isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-liquid-indigo text-white">
                      当前设备
                    </span>
                  )}
                  {!s.isCurrent && revoked && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 text-text-secondary">
                      已注销
                    </span>
                  )}
                  {!s.isCurrent && !revoked && expired && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 text-text-secondary">
                      已过期
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary mt-1 flex flex-wrap gap-x-3">
                  <span>IP {s.ipAddr || '未知'}</span>
                  <span>登录 {formatTime(s.createdAt)}</span>
                  <span>最近活跃 {formatTime(s.lastSeenAt)}</span>
                </div>
                {s.userAgent && (
                  <div className="text-[11px] text-text-secondary/80 mt-1 truncate" title={s.userAgent}>
                    {s.userAgent}
                  </div>
                )}
              </div>
              {!s.isCurrent && !revoked && !expired && (
                <button
                  onClick={() => revokeOne(s.id)}
                  className="text-text-secondary hover:text-red-500 p-2 rounded-md"
                  title="注销该设备"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
