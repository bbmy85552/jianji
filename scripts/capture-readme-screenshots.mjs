#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseUrl = process.env.JIANJI_SCREENSHOT_BASE_URL || 'http://127.0.0.1:3000';
const email = process.env.JIANJI_SCREENSHOT_EMAIL || 'admin@jianji.local';
const password = process.env.JIANJI_SCREENSHOT_PASSWORD;
const width = Number(process.env.JIANJI_SCREENSHOT_WIDTH || 1920);
const height = Number(process.env.JIANJI_SCREENSHOT_HEIGHT || 1080);

if (!password) {
  throw new Error('Set JIANJI_SCREENSHOT_PASSWORD before capturing screenshots.');
}

const outputDir = path.resolve('docs/images');
const userDataDir = '/private/tmp/jianji-readme-chrome';
const debugPort = Number(process.env.JIANJI_CHROME_DEBUG_PORT || 9333);

async function waitForJson(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function openTab(url) {
  const res = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });
  if (!res.ok) throw new Error(`Unable to open Chrome tab: ${res.status}`);
  return res.json();
}

function cdpClient(webSocketDebuggerUrl) {
  let nextId = 1;
  const pending = new Map();
  const ws = new WebSocket(webSocketDebuggerUrl);
  const loaded = new Set();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Page.loadEventFired') loaded.forEach((resolve) => resolve());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  return {
    ready: new Promise((resolve) => ws.addEventListener('open', resolve, { once: true })),
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    waitForLoad(timeoutMs = 15000) {
      return new Promise((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        loaded.add(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
    close() {
      ws.close();
    },
  };
}

function parseCookie(setCookie) {
  const first = setCookie.split(';')[0];
  const idx = first.indexOf('=');
  return { name: first.slice(0, idx), value: first.slice(idx + 1) };
}

async function login() {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('Login response did not include a session cookie.');
  return parseCookie(setCookie);
}

async function capture(page, route, file) {
  await page.send('Page.navigate', { url: `${baseUrl}${route}` });
  await page.waitForLoad();
  await new Promise((resolve) => setTimeout(resolve, 700));
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  await fs.writeFile(path.join(outputDir, file), Buffer.from(result.data, 'base64'));
  return { file, width, height };
}

await fs.mkdir(outputDir, { recursive: true });
await fs.rm(userDataDir, { recursive: true, force: true });

const cookie = await login();
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  `--window-size=${width},${height}`,
  'about:blank',
], { stdio: 'ignore' });

try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const tab = await openTab(`${baseUrl}/app/dashboard`);
  const page = cdpClient(tab.webSocketDebuggerUrl);
  await page.ready;
  await page.send('Page.enable');
  await page.send('Network.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.send('Network.setCookie', {
    name: cookie.name,
    value: cookie.value,
    url: baseUrl,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });

  const results = [];
  results.push(await capture(page, '/app/dashboard', 'screenshot-dashboard.png'));
  results.push(await capture(page, '/app/mail', 'screenshot-mail.png'));
  results.push(await capture(page, '/admin/settings', 'screenshot-admin-settings.png'));
  page.close();
  console.log(JSON.stringify(results, null, 2));
} finally {
  chrome.kill('SIGTERM');
  await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
}
