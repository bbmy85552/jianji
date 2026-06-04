import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { onUnauthorized } from '../lib/api';
import { clearRememberedLogin } from '../lib/rememberedLogin';

function FullPageLoading() {
  return (
    <div className="flex h-screen items-center justify-center text-text-secondary">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-liquid-indigo animate-pulse" />
        <span>载入中…</span>
      </div>
    </div>
  );
}

function useEnsureMe() {
  const { status, fetchMe } = useAuthStore();
  useEffect(() => {
    if (status === 'idle') void fetchMe();
  }, [status, fetchMe]);
  useEffect(() => {
    onUnauthorized((url) => {
      useAuthStore.setState({ user: null, status: 'ready' });
      if (url !== '/auth/login') clearRememberedLogin();
    });
  }, []);
  return status;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useEnsureMe();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (status !== 'ready') return <FullPageLoading />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const status = useEnsureMe();
  const user = useAuthStore((s) => s.user);
  if (status !== 'ready') return <FullPageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

export function RequireGuest() {
  const status = useEnsureMe();
  const user = useAuthStore((s) => s.user);
  if (status !== 'ready') return <FullPageLoading />;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return <Outlet />;
}
