import { useEffect, useState } from 'react';

interface Props {
  disabled?: boolean;
  onClick: () => Promise<void>;
  initialSeconds?: number;
  label?: string;
}

export function CodeButton({ disabled, onClick, initialSeconds = 60, label = '获取验证码' }: Props) {
  const [left, setLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);

  const handle = async () => {
    if (left > 0 || loading) return;
    setLoading(true);
    try {
      await onClick();
      setLeft(initialSeconds);
    } finally {
      setLoading(false);
    }
  };

  const text =
    left > 0 ? `${left}s 后重试` : loading ? '发送中…' : label;

  return (
    <button
      type="button"
      disabled={disabled || left > 0 || loading}
      onClick={handle}
      className="shrink-0 px-3 py-2.5 text-sm font-medium rounded-xl border border-liquid-indigo/20 text-liquid-indigo hover:bg-liquid-indigo/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
    >
      {text}
    </button>
  );
}
