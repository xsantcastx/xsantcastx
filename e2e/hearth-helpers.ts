/**
 * hearth-helpers.ts — a private Hearth room for a spec: `node scripts/social-server.mjs` on a free port, allowing
 * only this run's preview origin, and the localStorage key that points the client at it (social-room.ts
 * HEARTH_PORT_KEY, honoured on localhost only). The child is this spec's own and is stopped by it, never by name.
 */
import { spawn, type ChildProcess } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { seed } from './play-helpers';

export interface Hearth { port: number; stop: () => Promise<void> }

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address() as net.AddressInfo; s.close(() => resolve(port)); });
  });
}

/** `script`: another build of the room (a spec can stand up the deployed v1 server to check the client degrades). */
export async function startHearth(origin: string, script = path.join(__dirname, '..', 'scripts', 'social-server.mjs')): Promise<Hearth> {
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, [script], {
    env: { ...process.env, PORT: '', SOCIAL_HOST: '127.0.0.1', SOCIAL_PORT: String(port), SOCIAL_ORIGINS: origin },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the Hearth room did not start')), 10000);
    child.stdout?.on('data', (d: Buffer) => { if (/social room/.test(String(d))) { clearTimeout(t); resolve(); } });
    child.once('exit', code => { clearTimeout(t); reject(new Error(`the Hearth room exited (${code})`)); });
  });
  return {
    port,
    stop: () => new Promise<void>(resolve => {
      if (child.exitCode !== null) { resolve(); return; }
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
      setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); resolve(); }, 3000);
    }),
  };
}

/** A Keeper in the top-down world, in the room on `port`. */
export async function enterAs(page: Page, port: number, name: string, vocation: string, extra: Record<string, unknown> = {}, query = ''): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'eclipse-hearth-port': String(port),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name, vocation, updatedAt: 1 },
    ...extra,
  });
  await page.goto(`/play?td=1&hour=12${query ? `&${query}` : ''}`);
  await expect(page.locator('.viewport canvas')).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await expect(page.locator('.td-chat')).toHaveAttribute('data-chat-connected', 'true', { timeout: 20000 });
}

/** A second browser with the suite's storage (the onboarding and lobby skips). */
export async function newContext(browser: Browser, info: TestInfo, options: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
  return browser.newContext({ baseURL: info.project.use.baseURL, storageState: info.project.use.storageState, ...options });
}
