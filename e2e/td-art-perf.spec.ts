/**
 * td-art-perf.spec.ts — the art style upgrade's frame-time check (docs/handoff/art-style.md). Skipped unless ART_PERF=1:
 *
 *   ART_PERF=1 PW_PORT=4698 npx playwright test e2e/td-art-perf --project=chromium
 *
 * The forest road with the Keeper, three Bone Walkers and the aura, on a 1280×800 desktop and on a 390×844 phone with
 * the CPU throttled 4× (CDP): five seconds of requestAnimationFrame deltas (mean and 95th percentile, ms), and the live
 * canvases' pixel count (the paint caches: chunks, sheets, sprites). Printed, not asserted.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const on = process.env['ART_PERF'] ? test.describe : test.describe.skip;
type Zones = { to(c: number, r: number): boolean; foe(type: string, level: number, dx?: number, dy?: number): number | null };

async function scene(page: Page): Promise<void> {
  await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', hair: 'curls', updatedAt: 1 } });
  await page.addInitScript(() => {
    // Count every canvas made (the caches never hand theirs to the DOM).
    const made: HTMLCanvasElement[] = [];
    (window as unknown as { __made: HTMLCanvasElement[] }).__made = made;
    const orig = document.createElement.bind(document);
    document.createElement = ((tag: string, o?: ElementCreationOptions) => { const el = orig(tag, o); if (tag.toLowerCase() === 'canvas') made.push(el as HTMLCanvasElement); return el; }) as typeof document.createElement;
  });
  // ART_QUERY=fxs6=aura (S6, docs/handoff/mobs.md): one of the monsters' scenes instead of the forest road.
  const query = process.env['ART_QUERY'];
  await page.goto(`/play?td=1&hour=12${query ? `&${query}` : ''}`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown }).__tdZones);
  if (!query) await page.evaluate(() => {
    const w = window as unknown as { __tdZones: Zones; __tdArt?: { aura(on: boolean): void; road(dc: number): unknown } };
    w.__tdZones.to(26, 94); w.__tdArt?.road(0);
    w.__tdZones.foe('bone-walker', 3, -50, -28); w.__tdZones.foe('bone-walker', 3, 50, -34); w.__tdZones.foe('bone-walker', 3, -46, 30);
    w.__tdArt?.aura(true);
  });
  // ART_VISIT=level,c,r,continent: stand there instead (stage 4: the harbour's water, a dungeon floor, the inn).
  const visit = process.env['ART_VISIT'];
  if (visit) await page.evaluate(v => { const [l, c, r, k] = v.split(','); (window as unknown as { __tdArt: { visit(l: string, c: number, r: number, k?: string): boolean } }).__tdArt.visit(l, Number(c), Number(r), k || undefined); }, visit);
  await page.waitForTimeout(2500);
}

async function measure(page: Page, label: string): Promise<void> {
  if (process.env['ART_PAN']) await page.evaluate(() => { (window as unknown as { __pan: boolean }).__pan = true; });
  const r = await page.evaluate(() => new Promise<{ mean: number; p95: number; max: number; frames: number; canvases: number; mpx: number }>(done => {
    const d: number[] = [];
    let last = performance.now();
    const t0 = last;
    // ART_PAN=1: the Keeper steps a tile a few times a second, so new ground chunks are baked while it runs (the hitch).
    const pan = (window as unknown as { __pan?: boolean }).__pan;
    const z = (window as unknown as { __tdZones: { to(c: number, r: number): boolean } }).__tdZones;
    const cv = document.querySelector('canvas')!;
    let step = 0;
    const tick = (t: number) => {
      d.push(t - last); last = t;
      if (pan && d.length % 6 === 0) { step++; const x = Number(cv.getAttribute('data-player-x')), y = Number(cv.getAttribute('data-player-y')); z.to(Math.floor(x / 16) + 1, Math.floor(y / 16)); void step; }
      if (t - t0 < 5000) requestAnimationFrame(tick);
      else {
        d.sort((a, b) => a - b);
        const made = (window as unknown as { __made: HTMLCanvasElement[] }).__made;
        const px = made.reduce((s, c) => s + c.width * c.height, 0);
        done({ mean: d.reduce((a, b) => a + b, 0) / d.length, p95: d[Math.floor(d.length * .95)], max: d[d.length - 1], frames: d.length, canvases: made.length, mpx: px / 1e6 });
      }
    };
    requestAnimationFrame(tick);
  }));
  console.warn(`[art-perf] ${label}: mean ${r.mean.toFixed(2)} ms, p95 ${r.p95.toFixed(2)} ms, max ${r.max.toFixed(1)} ms over ${r.frames} frames; ${r.canvases} canvases made, ${r.mpx.toFixed(2)} Mpx`);
}

on('art perf', () => {
  test('desktop 1280×800', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await scene(page);
    await measure(page, 'desktop');
  });
  test('phone 390×844, CPU ×4', async ({ page, browser }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 390, height: 844 });
    void browser;
    const cdp = await page.context().newCDPSession(page);
    await scene(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env['ART_CPU'] ?? 4) });
    await measure(page, `phone x${process.env['ART_CPU'] ?? 4}`);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
});
