const MOJIBAKE_RE = /[ÃÂÅÆÐÑåæéèçäöü]/;
const CJK_RE = /[\u3400-\u9fff]/;

function scoreWeirdness(s: string) {
  return Array.from(s).filter((ch) => MOJIBAKE_RE.test(ch) || ch === '\uFFFD').length;
}

export function normalizeFilename(name: string) {
  let current = name.replace(/[\\/]/g, '_').trim() || '未命名文件';
  for (let i = 0; i < 3 && MOJIBAKE_RE.test(current); i += 1) {
    const decoded = Buffer.from(current, 'latin1').toString('utf8');
    if (!decoded || decoded.includes('\uFFFD')) break;
    const cleaned = decoded.replace(/[\\/]/g, '_').trim();
    if (!cleaned || cleaned === current) break;
    if (CJK_RE.test(cleaned) || scoreWeirdness(cleaned) <= scoreWeirdness(current)) {
      current = cleaned;
      if (CJK_RE.test(current)) break;
    } else {
      break;
    }
  }
  return current;
}

export function contentDispositionAttachment(name: string) {
  const normalized = normalizeFilename(name);
  const ascii = normalized.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(normalized)}`;
}
