/**
 * td-night-shots.spec.ts — the darkness pass (design-bible §5.3, effects-spec "The night"): night and the eclipse are
 * properly dark, every light is a stepped pixel disc in a low-resolution light buffer, creatures past the light are
 * faint silhouettes with glowing eyes, and Menu → Sound → "Night darkness" (Full / Softer) is saved like the Hush.
 *
 * Always runs: the Full / Softer setting reaches the engine (`data-night` on the canvas: setting and the pass's
 * opacity), and noon stays clear.
 *
 * On demand (they write files):
 *   NIGHT_SHOTS=<dir> NIGHT_TAG=before|after  — the six scenes as <dir>/<scene>-<tag>.jpg
 *   NIGHT_COMPOSE=<dir>                       — before | after side by side → docs/handoff/cozy-ui/night-<scene>.jpg
 *   NIGHT_PERF=1 [NIGHT_PERF_OUT=<file>]      — rAF frames counted over 3 s at 390×844 DPR 3, CPU throttled 4×
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { seed, openMenu } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const DESKTOP = { width: 1400, height: 900 }, PHONE = { width: 390, height: 844 };
const SHOTS = process.env['NIGHT_SHOTS'], TAG = process.env['NIGHT_TAG'] ?? 'after', COMPOSE = process.env['NIGHT_COMPOSE'];
const PERF = !!process.env['NIGHT_PERF'];

const sound = (night: 'full' | 'softer') => ({ version: 1, music: .35, ambience: .4, effects: .5, muted: false, hush: 'full', night, updatedAt: 1 });

async function open(page: Page, query: string, size: { width: number; height: number }, night: 'full' | 'softer' = 'full'): Promise<void> {
  await page.setViewportSize(size);
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', 'godforge-sound': sound(night) });
  await page.goto(`/play?td=1&${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.addStyleTag({ content: '.guide, .glim-say { visibility: hidden !important; }' });
}

type Scene = { name: string; query: string; size: { width: number; height: number }; night?: 'full' | 'softer'; ready?: (page: Page) => Promise<void> };
const nightReady = async (page: Page) => { await expect(canvas(page)).toHaveAttribute('data-phase', 'night', { timeout: 15000 }); };
const SCENES: Scene[] = [
  { name: 'town', query: 'hour=0', size: DESKTOP },
  { name: 'wilds', query: 'phase=night', size: DESKTOP, ready: nightReady },
  { name: 'eclipse', query: 'phase=eclipse', size: DESKTOP, ready: async page => { await expect(canvas(page)).toHaveAttribute('data-phase', 'eclipse', { timeout: 15000 }); } },
  {
    name: 'dungeon', query: 'fxdark=1', size: DESKTOP, ready: async page => {
      await page.waitForFunction(() => !!(window as unknown as { __tdDark?: unknown }).__tdDark, null, { timeout: 15000 });
      await page.evaluate(() => (window as unknown as { __tdDark: { chest(id: string): string } }).__tdDark.chest('galleries'));
    },
  },
  { name: 'phone', query: 'phase=night', size: PHONE, ready: nightReady },
  { name: 'softer', query: 'phase=night', size: DESKTOP, night: 'softer', ready: nightReady },
];

test('Night darkness: Full and Softer reach the night pass; noon stays clear', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, 'hour=0', DESKTOP, 'full');
  await expect(canvas(page)).toHaveAttribute('data-night', /^full:0\.8\d$/, { timeout: 15000 });
  await open(page, 'hour=0', DESKTOP, 'softer');
  await expect(canvas(page)).toHaveAttribute('data-night', /^softer:0\.7\d$/, { timeout: 15000 });
  // The row lives in Menu → Sound beside the Hush: choosing Full turns the pass back up at once.
  await page.locator('.places-toggle').click();
  await openMenu(page);
  await page.locator('#game-menu [data-open="sound"]').first().click();
  const sheet = page.locator('app-sound-sheet');
  await expect(sheet.locator('[data-night-setting="softer"]')).toHaveAttribute('aria-checked', 'true', { timeout: 5000 });
  await sheet.locator('[data-night-setting="full"]').click();
  await expect(sheet.locator('[data-night-setting="full"]')).toHaveAttribute('aria-checked', 'true');
  await expect(canvas(page)).toHaveAttribute('data-night', /^full:0\.8\d$/, { timeout: 5000 });
  await open(page, 'hour=12', DESKTOP, 'full');
  await expect(canvas(page)).toHaveAttribute('data-night', 'full:0.00', { timeout: 15000 });
});

for (const s of SCENES) {
  test(`night shot: ${s.name}`, async ({ page }) => {
    test.skip(!SHOTS, 'NIGHT_SHOTS=<dir> takes the before/after photographs');
    test.setTimeout(90000);
    await open(page, s.query, s.size, s.night ?? 'full');
    await s.ready?.(page);
    await page.waitForTimeout(5000);
    fs.mkdirSync(SHOTS!, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS!, `${s.name}-${TAG}.jpg`), type: 'jpeg', quality: 86 });
  });
}

test('night shots side by side', async ({ page }) => {
  test.skip(!COMPOSE, 'NIGHT_COMPOSE=<dir> joins the before/after pairs');
  test.setTimeout(120000);
  for (const s of SCENES) {
    const pair = ['before', 'after'].map(t => `data:image/jpeg;base64,${fs.readFileSync(path.join(COMPOSE!, `${s.name}-${t}.jpg`)).toString('base64')}`);
    const w = s.size.width, h = s.size.height, k = s.size.width > 1000 ? .6 : 1, cw = Math.round(w * k), ch = Math.round(h * k);
    await page.setViewportSize({ width: cw * 2 + 12, height: ch + 34 });
    await page.setContent(`<body style="margin:0;background:#140c1c;color:#f3e7cf;font:600 14px monospace;display:flex;gap:12px">
      ${pair.map((src, i) => `<figure style="margin:0"><figcaption style="height:34px;line-height:34px;padding-left:8px">${i ? 'AFTER' : 'BEFORE'} · ${s.name}</figcaption><img src="${src}" style="display:block;width:${cw}px;height:${ch}px"></figure>`).join('')}</body>`);
    await page.waitForFunction(() => [...document.images].every(i => i.complete));
    await page.screenshot({ path: `docs/handoff/cozy-ui/night-${s.name}.jpg`, type: 'jpeg', quality: 84 });
  }
});

test.describe('night perf probe (390×844 DPR 3, CPU 4×)', () => {
  test.use({ viewport: PHONE, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  for (const [name, query] of [['noon', 'hour=12'], ['town-midnight', 'hour=0'], ['wilds-night', 'phase=night'], ['eclipse', 'phase=eclipse']] as const) {
    test(`fps: ${name}`, async ({ page }) => {
      test.skip(!PERF, 'NIGHT_PERF=1 measures');
      test.setTimeout(90000);
      await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en' });
      await page.goto(`/play?td=1&${query}`);
      await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
      await page.waitForTimeout(4000);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const frames = await page.evaluate(() => new Promise<{ frames: number; p95: number }>(done => {
        const gaps: number[] = []; let n = 0, last = performance.now();
        const t0 = last;
        const tick = (now: number) => {
          n++; gaps.push(now - last); last = now;
          if (now - t0 < 3000) requestAnimationFrame(tick);
          else { gaps.sort((a, b) => a - b); done({ frames: n, p95: Math.round(gaps[Math.floor(gaps.length * .95)] * 10) / 10 }); }
        };
        requestAnimationFrame(tick);
      }));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const row = { scene: name, frames: frames.frames, fps: Math.round(frames.frames / 3 * 10) / 10, p95ms: frames.p95, tag: TAG };
      console.log('NIGHT_PERF', JSON.stringify(row));
      if (process.env['NIGHT_PERF_OUT']) fs.appendFileSync(process.env['NIGHT_PERF_OUT'], JSON.stringify(row) + '\n');
    });
  }
});
