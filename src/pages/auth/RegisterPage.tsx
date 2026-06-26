import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, Input, PrimaryButton } from './AuthLayout';
import { api, asApiError } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import type { CurrentUser } from '../../lib/types';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    setError(null);
    setHint(null);
    if (!email || !inviteCode.trim()) {
      setError(!email ? '请先填写邮箱' : '请先填写邀请码');
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post<{ ok: boolean; ttlSeconds: number }>(
        '/auth/register-code',
        { email, inviteCode },
      );
      setHint(`验证码已发送，有效期 ${Math.round((data.ttlSeconds ?? 600) / 60)} 分钟`);
      startCountdown(60);
    } catch (err) {
      const e = asApiError(err);
      setError(e.error);
      if (e.code === 'CODE_RESEND_TOO_FAST') {
        const remain = (e.details as any)?.remainingSeconds;
        if (typeof remain === 'number') startCountdown(remain);
      }
    } finally {
      setSending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{ user: CurrentUser }>('/auth/register', {
        email,
        name,
        password,
        code,
        inviteCode,
      });
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
      title="创建账号"
      subtitle="使用管理员提供的邀请码注册。"
      footer={
        <>
          已有账号？<Link to="/login" className="text-liquid-indigo hover:underline">登录</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <Input
          label="邀请码"
          required
          autoComplete="off"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="请输入管理员提供的邀请码"
        />
        <Input
          label="邮箱"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <div className="mb-4 flex items-end gap-2">
          <div className="flex-1">
            <span className="block text-xs font-medium text-text-secondary mb-1.5">邮箱验证码</span>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6 位数字"
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 bg-white/70 text-sm text-text-primary outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15"
            />
          </div>
          <button
            type="button"
            disabled={sending || countdown > 0}
            onClick={sendCode}
            className="shrink-0 px-3 h-[42px] rounded-xl border border-liquid-indigo/30 text-liquid-indigo text-sm font-medium hover:bg-liquid-indigo/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码'}
          </button>
        </div>
        <Input
          label="用户名"
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="你想要的展示名"
        />
        <Input
          label="密码"
          type="password"
          required
          minLength={8}
          maxLength={64}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 8 位"
        />
        {hint && (
          <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {hint}
          </div>
        )}
        {error && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <PrimaryButton type="submit" loading={loading}>
          注册并登录
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
