export function BrandLogo({
  size = 'md',
  showText = true,
}: {
  size?: 'sm' | 'md';
  showText?: boolean;
}) {
  const logoSize = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.svg"
        alt="简记"
        className={`${logoSize} rounded-xl shadow-md shadow-liquid-indigo/20`}
      />
      {showText && (
        <div className="flex flex-col text-left">
          <span className="font-serif font-bold leading-tight text-text-primary">简记</span>
          <span className="text-xs text-text-secondary">开源文档中心</span>
        </div>
      )}
    </div>
  );
}
