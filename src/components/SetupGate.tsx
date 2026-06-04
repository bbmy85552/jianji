import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

interface SetupStatus {
  initialized: boolean;
  setupAvailable: boolean;
  tokenRequired: boolean;
}

function SetupLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface text-text-secondary">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-liquid-indigo" />
        <span>检查系统状态…</span>
      </div>
    </div>
  );
}

export function SetupGate() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    api
      .get<SetupStatus>('/setup/status')
      .then(({ data }) => {
        if (!alive) return;
        setStatus(data);
        setFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface px-4 text-center text-text-secondary">
        无法连接服务器，请确认后端服务已启动。
      </div>
    );
  }

  if (!status) return <SetupLoading />;

  const isSetupPath = location.pathname.startsWith('/setup');
  if (!status.initialized && !isSetupPath) {
    return <Navigate to="/setup" replace />;
  }
  if (status.initialized && isSetupPath) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
