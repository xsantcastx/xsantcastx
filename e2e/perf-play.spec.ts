/**
 * perf-play.spec.ts — /play on an emulated mid-range phone.
 *
 * Not part of the `play-*.spec.ts` suite and not a correctness test: it is the
 * measuring harness behind docs/handoff/play-perf.md, plus one generous guard.
 *
 *   PLAY_PERF=1 PW_PORT=4298 npx playwright test e2e/perf-play.spec.ts --project=chromium
 *
 * Each scene runs on a 390×844 DPR-3 touch viewport with the CPU throttled 4×
 * through the DevTools protocol. Setup (seeding, walking, descending) runs
 * unthrottled; only the measured window is throttled. In the window the Keeper
 * walks back and forth so the camera moves, and the harness records:
 *   - frame time p50 / p95 / max from a requestAnimationFrame probe
 *   - long tasks (count, total ms) from PerformanceObserver
 *   - JS heap after a forced GC, before and after the window
 *   - bytes allocated per frame, from the sampling heap profiler with collected
 *     objects kept (an estimate: one sample per 16 KiB)
 *   - every canvas's backing store in device pixels
 * Results go to PLAY_PERF_OUT (JSON) when set.
 *
 * Headless frame timing is not a phone's: compare runs of this harness with
 * each other, not with a real device.
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import * as fs from 'fs';
import { canvas, ERA, focusWorld, openPlay, seed } from './play-helpers';
import { DelveFixture } from './play-delve-fixtures';

const RUN = !!process.env['PLAY_PERF'];
const SECONDS = Number(process.env['PLAY_PERF_SECONDS'] ?? 60);
const OUT = process.env['PLAY_PERF_OUT'];
/** A directory: when set, each scene also saves a .cpuprofile, a .heapprofile (open in DevTools) and a screenshot there. */
const PROFILE_DIR = process.env['PLAY_PERF_PROFILE'];
/** The guard's ceiling: generous on purpose. A 4× throttled headless p95 above this is a real regression. */
const GUARD_P95_MS = Number(process.env['PLAY_PERF_P95_CEILING'] ?? 70);

/**
 * PLAY_PERF_GPU=1 launches Chromium with the Metal GPU (macOS): canvas 2D is
 * then GPU-rasterised as on a real phone. Without it, headless Chromium uses
 * SwiftShader and rasterises every canvas on the main thread: a worst case
 * (a phone whose GPU is blocklisted), where pixel fill dominates.
 */
const GPU = !!process.env['PLAY_PERF_GPU'];
const PHONE = {
  hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
  ...(GPU ? { launchOptions: { args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] } } : {}),
};

// File level: launchOptions is a worker option and cannot be set per describe.
test.use(PHONE);

const RESTORED = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };
const inTown = (town: string) => ({ ...RESTORED, 'eclipse-play-world-v1': { town } });

export interface SceneResult {
  scene: string;
  frames: number;
  p50: number; p95: number; max: number;
  longTasks: number; longTaskMs: number;
  heapStartMB: number; heapEndMB: number; heapGrowthMB: number;
  allocKBPerFrame: number;
  /** Main-thread time per frame (ms), from Performance.getMetrics: all tasks, and JS alone. */
  taskMsPerFrame: number; scriptMsPerFrame: number;
  canvases: { cls: string; w: number; h: number; mpx: number; visible: boolean }[];
}

const results: SceneResult[] = [];

async function phone(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.setViewportSize({ width: 390, height: 844 });
  return cdp;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

async function heapMB(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  return (metrics.find(m => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1048576;
}

type ProfileNode = { selfSize: number; children: ProfileNode[] };
function totalBytes(node: ProfileNode): number {
  let sum = node.selfSize;
  for (const child of node.children) sum += totalBytes(child);
  return sum;
}

async function mainThread(cdp: CDPSession): Promise<{ task: number; script: number }> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (name: string) => metrics.find(m => m.name === name)?.value ?? 0;
  return { task: get('TaskDuration'), script: get('ScriptDuration') };
}

async function measure(page: Page, cdp: CDPSession, scene: string, walk = true): Promise<SceneResult> {
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  await focusWorld(page);
  const heapStart = await heapMB(cdp);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { frames: number[]; long: number[]; stop: boolean } };
    w.__perf = { frames: [], long: [], stop: false };
    try {
      new PerformanceObserver(list => { for (const e of list.getEntries()) w.__perf.long.push(e.duration); })
        .observe({ type: 'longtask', buffered: false });
    } catch { /* no longtask support */ }
    let last = 0;
    const probe = (now: number) => {
      if (w.__perf.stop) return;
      if (last) w.__perf.frames.push(now - last);
      last = now;
      requestAnimationFrame(probe);
    };
    requestAnimationFrame(probe);
  });
  await cdp.send('HeapProfiler.startSampling', {
    samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true,
  } as never);
  if (PROFILE_DIR) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
  const busyStart = await mainThread(cdp);
  const end = Date.now() + SECONDS * 1000;
  let dir: 'd' | 'a' = 'd';
  while (Date.now() < end) {
    const slice = Math.min(3000, end - Date.now());
    if (walk) await page.keyboard.down(dir);
    await page.waitForTimeout(slice);
    if (walk) await page.keyboard.up(dir);
    dir = dir === 'd' ? 'a' : 'd';
  }
  const busyEnd = await mainThread(cdp);
  const { profile } = await cdp.send('HeapProfiler.stopSampling') as unknown as { profile: { head: ProfileNode } };
  if (PROFILE_DIR) await page.screenshot({ path: `${PROFILE_DIR}/${scene.replace(/[^a-z0-9-]+/gi, '_')}.png` });
  if (PROFILE_DIR) {
    const cpu = await cdp.send('Profiler.stop');
    const name = scene.replace(/[^a-z0-9-]+/gi, '_');
    fs.writeFileSync(`${PROFILE_DIR}/${name}.cpuprofile`, JSON.stringify(cpu.profile));
    fs.writeFileSync(`${PROFILE_DIR}/${name}.heapprofile`, JSON.stringify(profile));
  }
  const data = await page.evaluate(() => {
    const w = window as unknown as { __perf: { frames: number[]; long: number[]; stop: boolean } };
    w.__perf.stop = true;
    const canvases = [...document.querySelectorAll('canvas')].map(c => ({
      cls: c.className || c.parentElement?.className || 'canvas',
      w: c.width, h: c.height, mpx: +(c.width * c.height / 1e6).toFixed(2),
      visible: c.getClientRects().length > 0 && getComputedStyle(c).visibility !== 'hidden',
    }));
    return { frames: w.__perf.frames, long: w.__perf.long, canvases };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const heapEnd = await heapMB(cdp);
  const sorted = [...data.frames].sort((a, b) => a - b);
  const allocated = totalBytes(profile.head);
  const result: SceneResult = {
    scene,
    frames: sorted.length,
    p50: +percentile(sorted, .5).toFixed(1),
    p95: +percentile(sorted, .95).toFixed(1),
    max: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
    longTasks: data.long.length,
    longTaskMs: Math.round(data.long.reduce((a, b) => a + b, 0)),
    heapStartMB: +heapStart.toFixed(2), heapEndMB: +heapEnd.toFixed(2), heapGrowthMB: +(heapEnd - heapStart).toFixed(2),
    allocKBPerFrame: +(allocated / 1024 / Math.max(1, sorted.length)).toFixed(1),
    taskMsPerFrame: +((busyEnd.task - busyStart.task) * 1000 / Math.max(1, sorted.length)).toFixed(2),
    scriptMsPerFrame: +((busyEnd.script - busyStart.script) * 1000 / Math.max(1, sorted.length)).toFixed(2),
    canvases: data.canvases,
  };
  results.push(result);
  console.log(JSON.stringify(result));
  return result;
}

async function travelByPlaces(page: Page, label: RegExp, area: string): Promise<void> {
  await page.getByRole('button', { name: 'Places' }).click();
  await page.locator('#places-list button', { hasText: label }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 90000 });
  await page.waitForTimeout(800);
}

test.describe('/play on a throttled phone', () => {
  test.skip(!RUN, 'measuring harness: set PLAY_PERF=1');
  test.describe.configure({ timeout: SECONDS * 1000 + 240000 });

  test.afterAll(() => {
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  });

  for (const town of ['infernal', 'luminous', 'umbral', 'celestial', 'verdant']) {
    test(`town: ${town}`, async ({ page }) => {
      const cdp = await phone(page);
      await seed(page, inTown(town));
      await openPlay(page);
      await page.waitForTimeout(1500);
      await measure(page, cdp, `town:${town}`);
    });
  }

  test('hunt: Reflection Channels', async ({ page }) => {
    const cdp = await phone(page);
    await seed(page, inTown('luminous'));
    await openPlay(page);
    await travelByPlaces(page, /East Stair/i, 'Reflection Channels');
    await measure(page, cdp, 'hunt:reflection-channels');
  });

  test('delve: Magma Halls gallery with torches', async ({ page }) => {
    const cdp = await phone(page);
    const CEIL = 41;
    const f = new DelveFixture().carve(1, 88, CEIL + 1, CEIL + 3).floor(1, 88, CEIL + 4).camp(2, CEIL + 3);
    for (let col = 6; col <= 86; col += 5) f.set(col, CEIL + 3, 'torch');
    await seed(page, { ...RESTORED, ...f.blobs() });
    // `?at=delve` stands the Keeper at the shaft (a passage is not opened), where "Descend to your camp" shows.
    await openPlay(page, '?at=delve');
    const descend = page.getByRole('button', { name: /Descend to your camp/ });
    await expect(descend).toBeVisible({ timeout: 60000 });
    await descend.click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
    await page.waitForTimeout(2000);
    await measure(page, cdp, 'delve:magma-halls');
  });
});

/**
 * The guard: the Magma Halls is the heaviest scene (lighting + torches +
 * terrain). Skipped on CI: shared runners make frame timing meaningless.
 */
test.describe('/play perf guard', () => {
  test.skip(!!process.env['CI'] || !RUN, 'local only: set PLAY_PERF=1');
  test('town p95 frame time at 4× CPU throttle stays under the ceiling', async ({ page }) => {
    test.setTimeout(120000);
    const cdp = await phone(page);
    await seed(page, inTown('infernal'));
    await openPlay(page);
    const r = await measure(page, cdp, 'guard:infernal');
    expect(r.p95, `p95 ${r.p95} ms`).toBeLessThan(GUARD_P95_MS);
  });
});
