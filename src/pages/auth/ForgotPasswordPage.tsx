import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, Input, PrimaryButton } from './AuthLayout';
import { api, asApiError } from '../../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  const startCountdown = (s: number) => {
    setCountdown(s);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCountdown((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
  };

  const sendCode = async () => {
    setError(null);
    setHint(null);
    if (!email) return setError('请先填写邮箱');
    setSending(true);
    try {
      const { data } = await api.post<{ ok: boolean; ttlSeconds?: number }>(
        '/auth/forgot-code',
        { email },
      );
      setHint('如该邮箱已注册，我们已发送验证码（10 分钟内有效）');
      startCountdown(data.ttlSeconds ? 60 : 60);
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
      await api.post('/auth/reset-password', { email, code, password });
      navigate('/login');
    } catch (err) {
      setError(asApiError(err).error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="重置密码"
      subtitle="通过邮箱验证码重新设置密码"
      footer={
        <Link to="/login" className="text-liquid-indigo hover:underline">
          返回登录
        </Link>
      }
    >
      <form onSubmit={submit}>
        <Input
          label="注册邮箱"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 bg-white/70 text-sm outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15"
            />
          </div>
          <button
            type="button"
            disabled={sending || countdown > 0}
            onClick={sendCode}
            className="shrink-0 px-3 h-[42px] rounded-xl border border-liquid-indigo/30 text-liquid-indigo text-sm font-medium hover:bg-liquid-indigo/5 transition disabled:opacity-50"
          >
            {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
          </button>
        </div>
        <Input
          label="新密码"
          type="password"
          required
          minLength={8}
          maxLength={64}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          重置密码
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
