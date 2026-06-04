import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import { translateImapError } from './providers.js';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface RawMail {
  uid: number;
  messageId?: string;
  subject?: string;
  fromName?: string;
  fromEmail?: string;
  to: { name?: string; address: string }[];
  cc: { name?: string; address: string }[];
  receivedAt: Date;
  preview?: string;
  textBody?: string;
  htmlBody?: string;
}

function makeClient(cfg: ImapConfig) {
  return new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
    socketTimeout: 30_000,
  });
}

export async function imapPing(cfg: ImapConfig): Promise<void> {
  const client = makeClient(cfg);
  try {
    await client.connect();
  } catch (err) {
    throw new Error(translateImapError((err as Error).message));
  } finally {
    await client.logout().catch(() => undefined);
  }
}

interface FetchOptions {
  folder?: string;
  limit?: number;
}

function pickAddresses(addr?: AddressObject | AddressObject[]): { name?: string; address: string }[] {
  if (!addr) return [];
  const arr = Array.isArray(addr) ? addr : [addr];
  const out: { name?: string; address: string }[] = [];
  for (const a of arr) {
    for (const v of a.value) {
      if (v.address) out.push({ name: v.name || undefined, address: v.address });
    }
  }
  return out;
}

export async function imapFetchRecent(
  cfg: ImapConfig,
  opts: FetchOptions = {},
): Promise<RawMail[]> {
  const folder = opts.folder || 'INBOX';
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 100));
  const client = makeClient(cfg);
  const result: RawMail[] = [];
  try {
    await client.connect();
  } catch (err) {
    throw new Error(translateImapError((err as Error).message));
  }
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const box = client.mailbox;
      if (!box || typeof box === 'boolean') return result;
      const total = box.exists ?? 0;
      if (total === 0) return result;
      const start = Math.max(1, total - limit + 1);
      const range = `${start}:*`;
      for await (const msg of client.fetch(
        range,
        { uid: true, internalDate: true, source: true },
        { uid: false },
      )) {
        if (!msg.source) continue;
        try {
          const parsed = await simpleParser(msg.source);
          const text = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '');
          const preview = text.replace(/\s+/g, ' ').trim().slice(0, 240);
          const fromValue = parsed.from?.value?.[0];
          result.push({
            uid: msg.uid,
            messageId: parsed.messageId || undefined,
            subject: parsed.subject || undefined,
            fromName: fromValue?.name || undefined,
            fromEmail: fromValue?.address || undefined,
            to: pickAddresses(parsed.to),
            cc: pickAddresses(parsed.cc),
            receivedAt: parsed.date || (msg.internalDate ? new Date(msg.internalDate) : new Date()),
            preview,
            textBody: parsed.text || undefined,
            htmlBody: typeof parsed.html === 'string' ? parsed.html : undefined,
          });
        } catch {
          // 单封解析失败不阻塞其它邮件
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    throw new Error(translateImapError((err as Error).message));
  } finally {
    await client.logout().catch(() => undefined);
  }
  return result.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}

export async function imapListFolders(cfg: ImapConfig): Promise<string[]> {
  const client = makeClient(cfg);
  try {
    await client.connect();
    const list = await client.list();
    return list.map((m) => m.path);
  } catch (err) {
    throw new Error(translateImapError((err as Error).message));
  } finally {
    await client.logout().catch(() => undefined);
  }
}
