import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateNumericCode(len = 6) {
  const max = 10 ** len;
  return crypto.randomInt(0, max).toString().padStart(len, '0');
}
