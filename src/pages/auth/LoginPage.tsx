import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, Input, PrimaryButton } from './AuthLayout';
import { api, asApiError } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import type { CurrentUser } from '../../lib/types';
import {
  clearRememberedLogin,
  readRememberedLogin,
  saveRememberedLogin,
} from '../../lib/rememberedLogin';
import { DEFAULT_PUBLIC_SETTINGS, fetchPublicSettings } from '../../lib/publicSettings';

export function LoginPage() {
  const remembered = readRememberedLogin();
  const [email, setEmail] = useState(remembered?.email ?? '');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(Boolean(remembered));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [brandName, setBrandName] = useState(DEFAULT_PUBLIC_SETTINGS.brandName);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    void fetchPublicSettings()
      .then((settings) => {
        if (alive) setBrandName(settings.brandName);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{ user: CurrentUser }>('/auth/login', {
        email,
        password,
      });
      if (rememberEmail) {
        saveRememberedLogin({ email });
      } else {
        clearRememberedLogin();
      }
      setUser(data.user);
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(asApiError(err).error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="欢迎回来"
      subtitle={`登录${brandName}，开始你的工作。`}
      footer={
        <>
          还没有账号？<Link to="/register" className="text-liquid-indigo hover:underline">注册</Link>
          <span className="mx-2">·</span>
          <Link to="/forgot-password" className="text-liquid-indigo hover:underline">忘记密码</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <Input
          label="邮箱"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Input
          label="密码"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
        />
        <label className="mb-4 flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={rememberEmail}
            onChange={(e) => setRememberEmail(e.target.checked)}
            className="h-4 w-4 rounded border-black/10 text-liquid-indigo focus:ring-liquid-indigo/20"
          />
          记住邮箱（不会保存密码）
        </label>
        {error && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <PrimaryButton type="submit" loading={loading}>
          登录
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
