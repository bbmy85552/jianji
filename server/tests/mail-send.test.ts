import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/mail/smtp.js', () => ({
  smtpSend: vi.fn().mockResolvedValue(undefined),
  smtpVerify: vi.fn().mockResolvedValue(undefined),
}));

describe('邮件发送', () => {
  beforeEach(async () => {
    const { resetData } = await import('./helpers.js');
    await resetData();
    vi.clearAllMocks();
  });

  it('支持 multipart 附件发送，并保留正常发送字段', async () => {
    const [{ getApp, registerUser }, { prisma }, { encryptSecret }, { smtpSend }] =
      await Promise.all([
        import('./helpers.js'),
        import('../src/prisma.js'),
        import('../src/lib/crypto.js'),
        import('../src/lib/mail/smtp.js'),
      ]);
    const app = await getApp();
    const user = await registerUser('send@m.local', 'Sender');
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: 'send@m.local' } });
    const account = await prisma.mailAccount.create({
      data: {
        userId: dbUser.id,
        label: '测试发件箱',
        email: 'send@m.local',
        imapHost: 'imap.local',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.local',
        smtpPort: 465,
        smtpSecure: true,
        username: 'send@m.local',
        passwordEnc: encryptSecret('token'),
        fromName: 'Sender',
        isDefault: true,
      },
    });

    const res = await request(app)
      .post(`/api/mail/accounts/${account.id}/send`)
      .set('Cookie', user.cookie)
      .field('to', JSON.stringify(['to@example.com']))
      .field('subject', '')
      .field('text', '附件发送测试')
      .attach('attachments', Buffer.from('hello'), {
        filename: 'å´éæ±-å­èä¿¡æ¯ç³»ç»peopleæ¹å.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(smtpSend).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.local', user: 'send@m.local' }),
      expect.objectContaining({
        fromEmail: 'send@m.local',
        subject: '',
        text: '附件发送测试',
        attachments: [
          expect.objectContaining({
            filename: '吴镜昱-字节信息系统people方向.pdf',
            contentType: 'application/pdf',
          }),
        ],
      }),
    );
    const sent = await prisma.mailMessage.findFirstOrThrow({
      where: { accountId: account.id, folder: 'Sent' },
    });
    expect(sent.subject).toBeNull();
    expect(sent.preview).toBe('附件发送测试');
  });
});
