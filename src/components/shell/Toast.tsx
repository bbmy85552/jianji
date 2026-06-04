import { useUiStore } from '../../store/ui';

export function Toast() {
  const toast = useUiStore((s) => s.toast);
  if (!toast) return null;
  const color =
    toast.type === 'error'
      ? 'bg-red-500'
      : toast.type === 'success'
        ? 'bg-emerald-500'
        : 'bg-liquid-indigo';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center">
      <div className={`pointer-events-auto rounded-xl px-4 py-2 text-sm text-white shadow-lg ${color}`}>
        {toast.text}
      </div>
    </div>
  );
}
