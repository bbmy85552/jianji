import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.resolve(__dirname, '../prisma/test.db');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${TEST_DB}`;
process.env.JWT_SECRET = 'test-secret-32-bytes-min-please-okay';
process.env.SETUP_TOKEN = 'test-setup-token-32-bytes-minimum-value';
process.env.MAIL_ENABLED = 'false';
process.env.CODE_RESEND_INTERVAL_SECONDS = '1';
process.env.CODE_MAX_PER_HOUR_PER_EMAIL = '5';
process.env.CODE_MAX_PER_HOUR_PER_IP = '20';
process.env.CODE_MAX_PER_DAY_PER_EMAIL = '20';
process.env.CODE_MAX_ATTEMPTS = '5';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'Admin@Test123';
process.env.ALLOW_PUBLIC_REGISTER = 'true';
