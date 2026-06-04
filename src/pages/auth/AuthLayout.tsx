import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';

export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface relative overflow-hidden flex items-center justify-center px-4 py-8">
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-liquid-indigo/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-purple-300/20 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-[420px] glass-panel rounded-3xl p-8 sm:p-10 shadow-xl">
        <Link to="/" className="mb-8 inline-flex">
          <BrandLogo size="sm" />
        </Link>

        <h1 className="text-2xl font-serif font-bold text-text-primary mb-1">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mb-6">{subtitle}</p>}

        {children}

        {footer && <div className="mt-6 text-sm text-text-secondary text-center">{footer}</div>}
      </div>
    </div>
  );
}

export function Input({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-text-secondary mb-1.5">{label}</span>
      <input
        {...rest}
        className={`w-full px-3 py-2.5 rounded-xl border border-black/10 bg-white/70 text-sm text-text-primary outline-none focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15 transition-all ${rest.className ?? ''}`}
      />
    </label>
  );
}

export function PrimaryButton({
  loading,
  children,
  ...rest
}: { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={`w-full py-2.5 rounded-xl bg-liquid-indigo text-white text-sm font-medium hover:bg-primary transition-all disabled:opacity-60 disabled:cursor-not-allowed ${rest.className ?? ''}`}
    >
      {loading ? '请稍候…' : children}
    </button>
  );
}
