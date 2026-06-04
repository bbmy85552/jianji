export interface MailProviderPreset {
  key: string;
  label: string;
  domains: string[];
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  hint?: string;
  helpUrl?: string;
}

export const MAIL_PROVIDERS: MailProviderPreset[] = [
  {
    key: '163',
    label: '网易 163 邮箱',
    domains: ['163.com'],
    imapHost: 'imap.163.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.163.com',
    smtpPort: 465,
    smtpSecure: true,
    hint: '请先在 163 邮箱网页端开启 IMAP/SMTP，并使用「客户端授权密码」登录（非邮箱密码）。',
    helpUrl: 'https://help.mail.163.com/faq.do?m=list&categoryID=197',
  },
  {
    key: '126',
    label: '网易 126 邮箱',
    domains: ['126.com'],
    imapHost: 'imap.126.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.126.com',
    smtpPort: 465,
    smtpSecure: true,
    hint: '需要在 126 邮箱网页端开启 IMAP/SMTP 并使用授权码。',
  },
  {
    key: 'yeah',
    label: '网易 yeah 邮箱',
    domains: ['yeah.net'],
    imapHost: 'imap.yeah.net',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.yeah.net',
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    key: 'qq',
    label: 'QQ / Foxmail 邮箱',
    domains: ['qq.com', 'foxmail.com', 'vip.qq.com'],
    imapHost: 'imap.qq.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.qq.com',
    smtpPort: 465,
    smtpSecure: true,
    hint: '请在 QQ 邮箱网页端「设置 → 账户」开启 IMAP/SMTP，并生成 16 位授权码作为密码。',
    helpUrl: 'https://service.mail.qq.com/detail/0/75',
  },
  {
    key: 'gmail',
    label: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    hint: '请开启两步验证后生成「应用专用密码」作为登录密码。',
    helpUrl: 'https://support.google.com/accounts/answer/185833',
  },
  {
    key: 'outlook',
    label: 'Outlook / Hotmail / Office365',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'office365.com'],
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    smtpSecure: false,
    hint: '企业账号需要管理员在 Microsoft 365 后台开启 SMTP AUTH，并可能要求应用专用密码。',
    helpUrl: 'https://support.microsoft.com/zh-cn/office/4f0e1242-2bb8-4254-a9be-9e0b6cd4e3d3',
  },
  {
    key: 'icloud',
    label: 'iCloud 邮箱',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecure: false,
    hint: 'iCloud 必须使用「Apple ID 应用专用密码」，可在 appleid.apple.com 创建。',
    helpUrl: 'https://support.apple.com/zh-cn/HT204397',
  },
  {
    key: 'sina',
    label: '新浪邮箱',
    domains: ['sina.com', 'sina.cn'],
    imapHost: 'imap.sina.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.sina.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    key: 'sohu',
    label: '搜狐邮箱',
    domains: ['sohu.com'],
    imapHost: 'imap.sohu.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.sohu.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    key: '139',
    label: '139 / 移动云邮箱',
    domains: ['139.com'],
    imapHost: 'imap.139.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.139.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    key: 'aliyun',
    label: '阿里云 / 阿里邮箱',
    domains: ['aliyun.com'],
    imapHost: 'imap.aliyun.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.aliyun.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    key: 'tencent_exmail',
    label: '腾讯企业邮 (exmail)',
    domains: ['exmail.qq.com'],
    imapHost: 'imap.exmail.qq.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.exmail.qq.com',
    smtpPort: 465,
    smtpSecure: true,
  },
];

export function detectProvider(email: string): MailProviderPreset | null {
  const at = email.toLowerCase().split('@')[1];
  if (!at) return null;
  for (const p of MAIL_PROVIDERS) {
    if (p.domains.includes(at)) return p;
  }
  // 二级匹配：xx.exmail.qq.com 的自定义域名走腾讯企业邮 / 阿里云邮箱较难判断，留空
  return null;
}

export function translateImapError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid credentials') || m.includes('authentication failed') || m.includes('login')) {
    return '邮箱账号或授权码错误。请检查邮箱网页端是否已开启 IMAP/SMTP，并使用「授权码 / 应用专用密码」而非登录密码。';
  }
  if (m.includes('etimedout') || m.includes('timeout')) {
    return '连接超时。请检查服务器、端口是否正确，以及服务器是否允许外部连接。';
  }
  if (m.includes('certificate') || m.includes('self signed') || m.includes('ssl')) {
    return 'SSL 证书校验失败。请确认端口与是否启用 SSL 的设置匹配（IMAP 993 / SMTP 465 通常需要 SSL）。';
  }
  if (m.includes('enotfound') || m.includes('getaddrinfo')) {
    return '服务器地址无法解析。请检查服务器域名是否拼写正确。';
  }
  if (m.includes('connection refused') || m.includes('econnrefused')) {
    return '服务器拒绝连接。请确认端口号正确，且服务商允许外部 IMAP/SMTP 接入。';
  }
  if (m.includes('mailbox is gone')) {
    return '会话被服务器关闭，请稍后重试或在邮箱网页端重新生成授权码。';
  }
  return message;
}

export function translateSmtpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login') || m.includes('authentication failed') || m.includes('eauth')) {
    return 'SMTP 鉴权失败。请使用「授权码 / 应用专用密码」作为密码，不要使用邮箱登录密码。';
  }
  if (m.includes('etimedout') || m.includes('timeout')) {
    return 'SMTP 连接超时。如果使用了 25 端口请改为 465 或 587，多数云服务商封锁了 25 端口。';
  }
  return translateImapError(message);
}
