import { useEffect, useRef, useState } from 'react';
import { api, asApiError } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { useUiStore } from '../../store/ui';
import { SettingsLayout, Field } from './SettingsLayout';
import { SessionsPanel } from './SessionsPanel';
import type { CurrentUser } from '../../lib/types';

export function SecurityPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const showToast = useUiStore((s) => s.showToast);

  // 密码
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // 邮箱
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
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

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSaving(true);
    try {
      await api.post('/me/password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      showToast('密码已更新', 'success');
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    } finally {
      setPwdSaving(false);
    }
  };

  const purpose: 'bind_email' | 'change_email' = user?.emailVerifiedAt ? 'change_email' : 'bind_email';

  const sendCode = async () => {
    if (!email) return showToast('请输入邮箱', 'error');
    setSending(true);
    try {
      await api.post('/me/email-code', { email, purpose });
      showToast('验证码已发送', 'success');
      startCountdown(60);
    } catch (err) {
      const e = asApiError(err);
      showToast(e.error, 'error');
      if (e.code === 'CODE_RESEND_TOO_FAST') {
        const r = (e.details as any)?.remainingSeconds;
        if (typeof r === 'number') startCountdown(r);
      }
    } finally {
      setSending(false);
    }
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);
    try {
      const { data } = await api.post<{ user: CurrentUser }>('/me/email', {
        email,
        code,
        purpose,
      });
      setUser(data.user);
      setEmail('');
      setCode('');
      showToast(user.emailVerifiedAt ? '邮箱已更新' : '邮箱已验证', 'success');
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    } finally {
      setEmailSaving(false);
    }
  };

  if (!user) return null;

  return (
    <SettingsLayout title="密码与邮箱" subtitle="账号安全相关设置">
      <form onSubmit={changePassword} className="mb-10">
        <div className="text-sm font-semibold text-text-primary mb-3">修改密码</div>
        <Field label="当前密码">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            className="w-full sm:w-72 px-3 py-2 rounded-xl border border-black/10 bg-white/80 text-sm outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15"
          />
        </Field>
        <Field label="新密码" hint="长度 8-64 位">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
            maxLength={64}
            className="w-full sm:w-72 px-3 py-2 rounded-xl border border-black/10 bg-white/80 text-sm outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15"
          />
        </Field>
        <button
          type="submit"
          disabled={pwdSaving}
          className="px-4 py-2 rounded-xl bg-liquid-indigo text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-60"
        >
          {pwdSaving ? '更新中…' : '更新密码'}
        </button>
      </form>

      <form onSubmit={changeEmail}>
        <div className="text-sm font-semibold text-text-primary mb-3">
          {purpose === 'bind_email' ? '验证或绑定邮箱' : '更换邮箱'}
        </div>
        <div className="text-xs text-text-secondary mb-3">
          当前绑定：<span className="text-text-primary">{user.email}</span>
          {user.emailVerifiedAt ? '（已验证）' : '（待验证，可在下方输入当前邮箱完成验证）'}
        </div>
        <Field label={purpose === 'bind_email' ? '邮箱' : '替换为'}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={purpose === 'bind_email' ? user.email : undefined}
            className="w-full sm:w-72 px-3 py-2 rounded-xl border border-black/10 bg-white/80 text-sm outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15"
          />
        </Field>
        <Field label="验证码">
          <div className="flex items-stretch gap-2">
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              className="w-44 px-3 py-2 rounded-xl border border-black/10 bg-white/80 text-sm outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15"
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={sending || countdown > 0}
              className="px-3 py-2 rounded-xl border border-liquid-indigo/30 text-liquid-indigo text-sm font-medium hover:bg-liquid-indigo/5 disabled:opacity-50"
            >
              {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
            </button>
          </div>
        </Field>
        <button
          type="submit"
          disabled={emailSaving}
          className="px-4 py-2 rounded-xl bg-liquid-indigo text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-60"
        >
          {emailSaving ? '更新中…' : purpose === 'bind_email' ? '验证邮箱' : '更换邮箱'}
        </button>
      </form>

      <SessionsPanel />
    </SettingsLayout>
  );
}
