import nodemailer from 'nodemailer';
import { translateSmtpError } from './providers.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface OutgoingMail {
  fromName?: string;
  fromEmail: string;
  to: string[];
  cc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType?: string;
  }[];
}

export async function smtpVerify(cfg: SmtpConfig): Promise<void> {
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 20_000,
    socketTimeout: 30_000,
  });
  try {
    await t.verify();
  } catch (err) {
    throw new Error(translateSmtpError((err as Error).message));
  } finally {
    t.close();
  }
}

export async function smtpSend(cfg: SmtpConfig, mail: OutgoingMail): Promise<void> {
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 20_000,
    socketTimeout: 30_000,
  });
  try {
    const from = mail.fromName ? `${mail.fromName} <${mail.fromEmail}>` : mail.fromEmail;
    await t.sendMail({
      from,
      to: mail.to.join(', '),
      cc: mail.cc?.length ? mail.cc.join(', ') : undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments?.length ? mail.attachments : undefined,
    });
  } catch (err) {
    throw new Error(translateSmtpError((err as Error).message));
  } finally {
    t.close();
  }
}
