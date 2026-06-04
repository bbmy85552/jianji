import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface text-center px-6">
      <h1 className="text-[64px] font-serif font-bold text-text-primary mb-2">404</h1>
      <p className="text-text-secondary mb-8">页面走丢了。</p>
      <Link
        to="/app/dashboard"
        className="px-4 py-2 rounded-xl bg-liquid-indigo text-white text-sm font-medium hover:bg-primary transition-colors"
      >
        返回工作台
      </Link>
    </div>
  );
}
