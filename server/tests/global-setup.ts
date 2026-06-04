import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function () {
  const TEST_DB = path.resolve(__dirname, '../prisma/test.db');
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const journal = `${TEST_DB}-journal`;
  if (fs.existsSync(journal)) fs.unlinkSync(journal);
  fs.closeSync(fs.openSync(TEST_DB, 'w'));

  execSync('node_modules/.bin/prisma db push --skip-generate', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: `file:${TEST_DB}`,
    },
  });
}
