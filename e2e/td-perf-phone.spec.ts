/**
 * td-perf-phone.spec.ts — the mid-range phone profile (docs/handoff/calm.md). Skipped unless TD_PERF=1:
 *
 *   TD_PERF=1 PW_PORT=4695 npx playwright test e2e/td-perf-phone --project=chromium
 *
 * A 390×844 phone at DPR 3 with the CPU throttled ×6 (TD_CPU), the canvas at whatever backing resolution the engine
 * picks. Five places (the Emberwood road, the town square, Ember Harbour, Ember Mine −1, a hot spot with a crowd of
 * Bone Walkers), each standing and walking (the Keeper stepped a tile every eight frames, so ground chunks bake mid-run;
 * the crowd fights instead). Prints the rAF frame deltas (mean / p95 / worst, the count over 33 ms), the engine's own
 * work per frame (window.__tdArt.perf(): update, draw, of which ground baking), the paint caches' canvas pixels, the
 * main canvas's backing pixels and the JS heap. Printed, not asserted. TD_DETAIL=low|normal picks the setting.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const on = process.env['TD_PERF'] ? test.describe : test.describe.skip;
const CPU = Number(process.env['TD_CPU'] ?? 6);
type W = {
  __tdZones: { to(c: number, r: number): boolean; foe(type: string, level: number, dx?: number, dy?: number): number | null };
  __tdArt: { aura(on: boolean): void; road(dc: number): unknown; visit(l: string, c: number, r: number, k?: string): boolean; perf?(): [number, number, number][] };
  __made: HTMLCanvasElement[];
};

async function open(page: Page): Promise<void> {
  const look = { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', hair: 'curls', updatedAt: 1 };
  await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': look });
  const detail = process.env['TD_DETAIL'];
  await page.addInitScript(d => {
    if (d) try { localStorage.setItem('eclipse-td-detail', d); } catch { /* private mode */ }
    const made: HTMLCanvasElement[] = [];
    (window as unknown as W).__made = made;
    const orig = document.createElement.bind(document);
    document.createElement = ((tag: string, o?: ElementCreationOptions) => { const el = orig(tag, o); if (tag.toLowerCase() === 'canvas') made.push(el as HTMLCanvasElement); return el; }) as typeof document.createElement;
  }, detail ?? '');
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__tdZones && !!(window as unknown as Partial<W>).__tdArt);
  await page.waitForTimeout(2500);
}

async function measure(page: Page, label: string, walk: boolean, ms = 5000): Promise<void> {
  await page.evaluate(() => (window as unknown as W).__tdArt.perf?.());
  const r = await page.evaluate(([walk, ms]) => new Promise<Record<string, number>>(done => {
    const w = window as unknown as W, d: number[] = [];
    const cv = document.querySelector('canvas')!;
    let last = performance.now(), dir = 1, n = 0;
    const t0 = last;
    const tick = (t: number) => {
      d.push(t - last); last = t; n++;
      if (walk && n % 8 === 0) {
        const x = Number(cv.getAttribute('data-player-x')), y = Number(cv.getAttribute('data-player-y'));
        if (n % 400 === 0) dir = -dir;
        w.__tdZones.to(Math.floor(x / 16) + dir, Math.floor(y / 16) + (n % 48 === 0 ? 1 : 0));
      }
      if (t - t0 < ms) { requestAnimationFrame(tick); return; }
      const s = [...d].sort((a, b) => a - b), q = (p: number) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
      const work = w.__tdArt.perf?.() ?? [];
      const tot = work.map(f => f[0] + f[1]).sort((a, b) => a - b), bake = work.map(f => f[2]);
      const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
      const px = w.__made.reduce((a, c) => a + c.width * c.height, 0);
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
      done({
        mean: mean(d), p95: q(.95), max: s[s.length - 1], over33: d.filter(x => x > 33.4).length, frames: d.length,
        workMean: mean(tot), workP95: tot[Math.floor(tot.length * .95)] ?? 0, workMax: tot[tot.length - 1] ?? 0,
        update: mean(work.map(f => f[0])), draw: mean(work.map(f => f[1])), bakeMax: Math.max(0, ...bake), bakeSum: bake.reduce((a, b) => a + b, 0),
        mpx: px / 1e6, backing: cv.width * cv.height / 1e6, heap: mem / 1048576,
      });
    };
    requestAnimationFrame(tick);
  }), [walk, ms] as const);
  const f = (n: number, p = 1) => n.toFixed(p);
  console.warn(`[td-perf] ${label}: frame mean ${f(r['mean'], 2)} p95 ${f(r['p95'])} worst ${f(r['max'])} ms, ${r['over33']}/${r['frames']} over 33 ms | work mean ${f(r['workMean'], 2)} p95 ${f(r['workP95'])} worst ${f(r['workMax'])} (update ${f(r['update'], 2)}, draw ${f(r['draw'], 2)}; bake worst ${f(r['bakeMax'])}, total ${f(r['bakeSum'], 0)}) | caches ${f(r['mpx'], 2)} Mpx, backing ${f(r['backing'], 2)} Mpx, heap ${f(r['heap'], 0)} MB`);
}

on('phone perf (390×844, DPR 3)', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const places: [string, (p: Page) => Promise<void>][] = [
    ['road', p => p.evaluate(() => { const w = window as unknown as W; w.__tdZones.to(58, 62); w.__tdArt.road(0); w.__tdArt.aura(true); })],
    ['town', async () => undefined],
    ['harbour', p => p.evaluate(() => { (window as unknown as W).__tdArt.visit('surface', 30, 111, 'ember-isle'); })],
    ['dungeon', p => p.evaluate(() => { (window as unknown as W).__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle'); })],
  ];
  for (const [name, go] of places) test(name, async ({ page }) => {
    test.setTimeout(180000);
    await open(page);
    await go(page);
    await page.waitForTimeout(2000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    if (process.env['TD_TRACE'] === name) await page.context().browser()!.startTracing(page, { path: `test-results/td-trace-${name}.json`, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc', 'gpu', 'v8'] });
    await measure(page, `${name} standing ×${CPU}`, false, 4000);
    if (process.env['TD_TRACE'] === name) await page.context().browser()!.stopTracing();
    await measure(page, `${name} walking ×${CPU}`, true);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
  test('hot spot', async ({ page }) => {
    test.setTimeout(180000);
    await open(page);
    await page.evaluate(() => {
      const w = window as unknown as W;
      w.__tdZones.to(58, 62); w.__tdArt.road(0); w.__tdArt.aura(true);
      for (let i = 0; i < 18; i++) w.__tdZones.foe('bone-walker', 3, Math.round(Math.cos(i * .7) * (40 + i * 4)), Math.round(Math.sin(i * .7) * (30 + i * 3)));
    });
    await page.waitForTimeout(1500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await measure(page, `hot spot fighting (18 walkers) ×${CPU}`, false);
    await measure(page, `hot spot walking ×${CPU}`, true);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
});
