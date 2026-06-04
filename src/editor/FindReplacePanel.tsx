import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Replace, X } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface Match {
  from: number;
  to: number;
}

interface Props {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectMatches(editor: Editor, keyword: string, caseSensitive: boolean): Match[] {
  if (!keyword) return [];
  const matches: Match[] = [];
  const flags = caseSensitive ? 'g' : 'gi';
  const re = new RegExp(escapeRegExp(keyword), flags);
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(node.text))) {
      const from = pos + m.index;
      const to = from + m[0].length;
      matches.push({ from, to });
      if (m[0].length === 0) re.lastIndex += 1;
    }
    return true;
  });
  return matches;
}

export function FindReplacePanel({ editor, open, onClose }: Props) {
  const [keyword, setKeyword] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (!editor || !keyword) return [] as Match[];
    return collectMatches(editor, keyword, caseSensitive);
  }, [editor, keyword, caseSensitive]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (cursor >= matches.length) setCursor(0);
  }, [matches.length, cursor]);

  useEffect(() => {
    if (!editor || !open) return;
    if (matches.length === 0) return;
    const safe = Math.min(cursor, matches.length - 1);
    const m = matches[safe];
    editor.commands.setTextSelection({ from: m.from, to: m.to });
    editor.commands.scrollIntoView();
  }, [editor, open, matches, cursor]);

  if (!open) return null;

  const next = () => {
    if (matches.length === 0) return;
    setCursor((c) => (c + 1) % matches.length);
  };
  const prev = () => {
    if (matches.length === 0) return;
    setCursor((c) => (c - 1 + matches.length) % matches.length);
  };

  const replaceOne = () => {
    if (!editor || matches.length === 0) return;
    const safe = Math.min(cursor, matches.length - 1);
    const m = matches[safe];
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replacement).run();
  };

  const replaceAll = () => {
    if (!editor || matches.length === 0) return;
    const ordered = [...matches].sort((a, b) => b.from - a.from);
    let chain = editor.chain();
    for (const m of ordered) {
      chain = chain.insertContentAt({ from: m.from, to: m.to }, replacement);
    }
    chain.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.shiftKey ? prev() : next();
    }
  };

  return (
    <div
      className="find-replace-panel no-print fixed top-24 right-6 z-30 w-80 bg-white border border-black/10 rounded-xl shadow-xl p-3"
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-text-secondary">查找与替换</div>
        <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setCursor(0);
            }}
            placeholder="查找…"
            className="flex-1 h-8 px-2 text-sm rounded-md border border-black/10 bg-white outline-none focus:border-liquid-indigo"
          />
          <button
            onClick={prev}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-black/5 disabled:opacity-40"
            disabled={matches.length === 0}
            title="上一个 (Shift+Enter)"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={next}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-black/5 disabled:opacity-40"
            disabled={matches.length === 0}
            title="下一个 (Enter)"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="替换为…"
            className="flex-1 h-8 px-2 text-sm rounded-md border border-black/10 bg-white outline-none focus:border-liquid-indigo"
          />
          <button
            onClick={replaceOne}
            disabled={matches.length === 0}
            className="h-8 px-2 text-xs rounded-md border border-black/10 inline-flex items-center gap-1 hover:bg-black/5 disabled:opacity-40"
            title="替换当前匹配"
          >
            <Replace size={12} /> 替换
          </button>
        </div>
        <div className="flex items-center justify-between text-xs">
          <label className="inline-flex items-center gap-1 text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            区分大小写
          </label>
          <button
            onClick={replaceAll}
            disabled={matches.length === 0}
            className="px-2 py-1 rounded-md bg-liquid-indigo/10 text-liquid-indigo hover:bg-liquid-indigo/15 disabled:opacity-40"
          >
            全部替换 ({matches.length})
          </button>
        </div>
        <div className="text-[11px] text-text-secondary">
          {matches.length === 0
            ? keyword
              ? '未找到匹配'
              : '输入关键词开始查找'
            : `第 ${Math.min(cursor + 1, matches.length)} / ${matches.length} 项`}
        </div>
      </div>
    </div>
  );
}
