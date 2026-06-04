import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import { Modal } from './Modal';
import { useUiStore } from '../store/ui';

export function DialogHost() {
  const dialog = useUiStore((s) => s.dialog);
  const resolveDialog = useUiStore((s) => s.resolveDialog);
  const showToast = useUiStore((s) => s.showToast);

  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      setPromptValue(dialog.defaultValue ?? '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [dialog?.id, dialog?.kind, dialog?.defaultValue]);

  useEffect(() => {
    if (!dialog) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialog.kind === 'alert') {
          resolveDialog(dialog.id, { ok: true });
        } else {
          resolveDialog(dialog.id, { ok: false });
        }
      } else if (e.key === 'Enter') {
        if (dialog.kind === 'prompt') {
          if (document.activeElement?.tagName === 'TEXTAREA') return;
          e.preventDefault();
          resolveDialog(dialog.id, { ok: true, value: promptValue });
        } else if (dialog.kind === 'confirm') {
          if (
            document.activeElement?.tagName === 'TEXTAREA' ||
            document.activeElement?.tagName === 'INPUT'
          )
            return;
          e.preventDefault();
          resolveDialog(dialog.id, { ok: true });
        } else if (dialog.kind === 'alert') {
          e.preventDefault();
          resolveDialog(dialog.id, { ok: true });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dialog, promptValue, resolveDialog]);

  if (!dialog) return null;

  const isDanger = dialog.danger;
  const confirmText =
    dialog.confirmText ?? (dialog.kind === 'alert' ? '我知道了' : dialog.danger ? '删除' : '确认');
  const cancelText = dialog.cancelText ?? '取消';

  const handleClose = () => {
    if (dialog.kind === 'alert') resolveDialog(dialog.id, { ok: true });
    else resolveDialog(dialog.id, { ok: false });
  };

  const handleConfirm = () => {
    if (dialog.kind === 'prompt') {
      resolveDialog(dialog.id, { ok: true, value: promptValue });
    } else {
      resolveDialog(dialog.id, { ok: true });
    }
  };

  const copyMono = async () => {
    if (typeof dialog.message !== 'string') return;
    try {
      await navigator.clipboard.writeText(dialog.message);
      showToast('已复制到剪贴板', 'success');
    } catch {
      showToast('复制失败,请手动选择文本复制', 'error');
    }
  };

  const title =
    dialog.title ??
    (dialog.kind === 'alert'
      ? '提示'
      : dialog.kind === 'confirm'
        ? isDanger
          ? '危险操作'
          : '请确认'
        : '请输入');

  return (
    <Modal
      open={true}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          {isDanger && <AlertTriangle size={16} className="text-red-500" />}
          <span>{title}</span>
        </div>
      }
      size="sm"
    >
      <div className="space-y-4">
        {dialog.mono && typeof dialog.message === 'string' ? (
          <div>
            <div className="relative">
              <pre className="text-sm font-mono bg-black/[0.04] border border-black/10 rounded-lg px-3 py-3 pr-10 whitespace-pre-wrap break-all text-text-primary">
                {dialog.message}
              </pre>
              <button
                onClick={copyMono}
                className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-black/10 text-text-secondary hover:text-text-primary transition-colors"
                aria-label="复制"
                title="复制"
              >
                <Copy size={14} />
              </button>
            </div>
            <div className="text-xs text-text-secondary mt-2">
              请妥善保存上述信息,关闭后将无法再次查看。
            </div>
          </div>
        ) : (
          <div className="text-sm text-text-primary whitespace-pre-wrap break-words">
            {dialog.message}
          </div>
        )}

        {dialog.kind === 'prompt' && (
          <input
            ref={inputRef}
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            placeholder={dialog.placeholder}
            className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-sm focus:border-liquid-indigo focus:ring-2 focus:ring-liquid-indigo/15 outline-none"
          />
        )}

        <div className="flex justify-end gap-2 pt-1">
          {dialog.kind !== 'alert' && (
            <button
              onClick={handleClose}
              className="px-4 h-9 text-sm rounded-lg border border-black/10 hover:bg-black/5 text-text-primary"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={
              isDanger
                ? 'px-4 h-9 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600'
                : 'px-4 h-9 text-sm rounded-lg bg-liquid-indigo text-white hover:bg-primary'
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
