const MOJIBAKE_RE = /[ÃÂÅÆÐÑåæéèçäöü]/;
const CJK_RE = /[\u3400-\u9fff]/;

function scoreWeirdness(s: string) {
  return Array.from(s).filter((ch) => MOJIBAKE_RE.test(ch) || ch === '\uFFFD').length;
}

export function displayFilename(name: string) {
  let current = name.replace(/[\\/]/g, '_').trim() || '未命名文件';
  for (let i = 0; i < 3 && MOJIBAKE_RE.test(current); i += 1) {
    const bytes = Uint8Array.from(Array.from(current, (ch) => ch.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8').decode(bytes);
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
