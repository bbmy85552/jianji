import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { normalizeFilename } from './filename.js';

export async function importDocxToHtml(filePath: string) {
  const result = await mammoth.convertToHtml({ path: filePath });
  return result.value;
}

export async function importMarkdownToHtml(filePath: string) {
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  const html = await marked.parse(raw, { async: true });
  return html;
}

export async function importPlainTextToHtml(filePath: string) {
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export async function importByExtension(filePath: string, originalName: string) {
  const ext = path.extname(normalizeFilename(originalName)).toLowerCase();
  if (ext === '.docx') return importDocxToHtml(filePath);
  if (ext === '.md' || ext === '.markdown') return importMarkdownToHtml(filePath);
  if (ext === '.txt') return importPlainTextToHtml(filePath);
  throw new Error(`不支持的文件格式：${ext || '未知'}`);
}
