import { useEffect, useState } from 'react';
import { ListTree } from 'lucide-react';
import type { EditorHeading } from '../../editor/Editor';

interface Props {
  headings: EditorHeading[];
}

export function DocumentToc({ headings }: Props) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (headings.length === 0) return;
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((node): node is HTMLElement => !!node);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: [0, 1] },
    );

    elements.forEach((element) => observer.observe(element));
    setActiveId((current) => current || elements[0]?.id || '');
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  const jumpTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    setActiveId(id);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <aside className="no-print hidden xl:block">
      <div className="sticky top-4 rounded-2xl border border-black/5 bg-surface-container-lowest/80 p-4 shadow-sm backdrop-blur">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <ListTree size={16} className="text-liquid-indigo" />
          目录
        </div>
        <nav className="max-h-[calc(100vh-9rem)] space-y-1 overflow-y-auto pr-1">
          {headings.map((heading) => {
            const active = heading.id === activeId;
            return (
              <button
                key={heading.id}
                type="button"
                onClick={() => jumpTo(heading.id)}
                className={`block w-full rounded-lg py-1.5 pr-2 text-left text-sm leading-snug transition-colors ${
                  active
                    ? 'bg-liquid-indigo/10 text-liquid-indigo'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary'
                }`}
                style={{ paddingLeft: `${Math.min(heading.level - 1, 4) * 12 + 8}px` }}
                title={heading.text}
              >
                <span className="line-clamp-2">{heading.text}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
