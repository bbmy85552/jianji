import { useEffect, useRef } from 'react';

interface Props {
  html: string;
  onOpenLink?: (href: string) => void;
}

/** 在 iframe 内渲染邮件 HTML，避免外链样式撑破页面三栏布局 */
export function MailHtmlBody({ html, onOpenLink }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    const baseStyles = `
      html, body { margin: 0; padding: 0; background: #fff; }
      body {
        font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #1b1b1d;
        word-break: break-word;
        overflow-wrap: anywhere;
        overflow-x: auto;
      }
      .mail-root { min-width: 0; max-width: 100%; overflow-x: auto; }
      img, video { max-width: 100% !important; height: auto !important; }
      iframe { max-width: 100% !important; }
      table { max-width: 100% !important; border-collapse: collapse; }
      td, th { word-break: break-word; }
      a { color: #5e5ce6; cursor: pointer; }
      a:hover { text-decoration: underline; }
      pre, code { white-space: pre-wrap; word-break: break-word; }
    `;

    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="mail-root">${html}</div><style>${baseStyles}</style></body></html>`,
    );
    doc.close();

    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link) return;
      const rawHref = link.getAttribute('href') || '';
      if (!rawHref || rawHref.startsWith('#')) return;
      event.preventDefault();
      event.stopPropagation();
      onOpenLink?.(link.href || rawHref);
    };
    doc.addEventListener('click', handleLinkClick, true);

    const fitHeight = () => {
      const body = doc.body;
      const htmlEl = doc.documentElement;
      if (!body || !htmlEl) return;
      const h = Math.max(body.scrollHeight, htmlEl.scrollHeight, 120);
      iframe.style.height = `${h}px`;
    };

    fitHeight();
    const t1 = window.setTimeout(fitHeight, 100);
    const t2 = window.setTimeout(fitHeight, 500);
    const t3 = window.setTimeout(fitHeight, 1500);
    const interval = window.setInterval(fitHeight, 500);
    const stopInterval = window.setTimeout(() => window.clearInterval(interval), 5000);

    const ResizeObserverCtor = (iframe.contentWindow as unknown as { ResizeObserver?: typeof ResizeObserver } | null)?.ResizeObserver;
    const ro = ResizeObserverCtor ? new ResizeObserverCtor(fitHeight) : null;
    if (ro && doc.body) ro.observe(doc.body);
    if (ro && doc.documentElement) ro.observe(doc.documentElement);
    void doc.fonts?.ready.then(fitHeight).catch(() => undefined);

    const imgs = doc.querySelectorAll('img');
    imgs.forEach((img) => {
      img.addEventListener('load', fitHeight);
      img.addEventListener('error', fitHeight);
    });

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearInterval(interval);
      window.clearTimeout(stopInterval);
      ro?.disconnect();
      doc.removeEventListener('click', handleLinkClick, true);
      imgs.forEach((img) => {
        img.removeEventListener('load', fitHeight);
        img.removeEventListener('error', fitHeight);
      });
    };
  }, [html, onOpenLink]);

  return (
    <iframe
      ref={iframeRef}
      title="邮件正文"
      sandbox="allow-same-origin"
      className="w-full border-0 block min-h-[120px] bg-transparent"
    />
  );
}
