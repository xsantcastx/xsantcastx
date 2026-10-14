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
import { bag as bagOf, canvas, ERA, focusWorld, openPlay, seed } from './play-helpers';
import { DelveFixture, withSectors } from './play-delve-fixtures';

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

async function measure(page: Page, cdp: CDPSession, scene: string, walk: boolean | 'east' = true): Promise<SceneResult> {
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
    if (walk !== 'east') dir = dir === 'd' ? 'a' : 'd';
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
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

async function travelByPlaces(page: Page, label: RegExp, area: string): Promise<void> {
  await page.getByRole('button', { name: 'Places' }).click();
  await page.locator('#places-list button', { hasText: label }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 90000 });
  await page.waitForTimeout(800);
}

/**
 * Deliberately skipped unless asked for (not a left-over isolation): the
 * harness takes ~8 minutes, and frame timing on shared CI runners means nothing.
 */
const harness = RUN ? test.describe : test.describe.skip;
const guard = RUN && !process.env['CI'] ? test.describe : test.describe.skip;

harness('/play on a throttled phone', () => {
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

  /** Into the Delve by "Descend to your camp", for the liquid scenes (Phase 6). */
  async function descendTo(page: Page, f: DelveFixture): Promise<void> {
    await seed(page, { ...RESTORED, ...f.blobs() });
    await openPlay(page, '?at=delve');
    const descend = page.getByRole('button', { name: /Descend to your camp/ });
    await expect(descend).toBeVisible({ timeout: 60000 });
    await descend.click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
    await page.waitForTimeout(2000);
  }

  // Phase 6 (docs/handoff/liquids-fishing.md): the lake and a lava pool on screen.
  // On a build without liquids the same caves are measured dry, for the before/after.
  test('delve: Grotto Mere, wading the lake', async ({ page }) => {
    const cdp = await phone(page);
    await descendTo(page, new DelveFixture().camp(30, 34));
    await measure(page, cdp, 'delve:grotto-mere');
  });

  // Phase 7 (docs/handoff/endless-delve.md): the wide traverse. From a camp at the core's east
  // end the Keeper walks east along the surface for the whole window (about 18 sector columns at
  // 4× CPU), so the ring streams a column in every few seconds. On a build without the endless
  // Delve the same walk stops at the core's east wall: the "before" is the same frame, standing.
  test('delve: wide traverse east', async ({ page }) => {
    const cdp = await phone(page);
    await descendTo(page, new DelveFixture().carve(112, 112, 0, 0).camp(112, 0));
    await measure(page, cdp, 'delve:wide-traverse', 'east');
  });

  // Phase 8 (docs/handoff/underhearth.md): the Furnace Hall with the Banked Furnace awake (its face, core,
  // breath and vents, the trough, embers spilling), walking the hall floor. The rows below the Magma
  // Halls only exist on a build with the Underhearth: on one without, the camp is not found (no "before").
  test('delve: the Furnace Hall, the Banked Furnace awake', async ({ page }) => {
    const cdp = await phone(page);
    const f = new DelveFixture();
    f.claimed = ['warden-defeated', 'underhearth-unsealed', 'underhearth-reached'];
    await seed(page, { ...RESTORED, ...withSectors(f, [{ col: 60, row: 109, id: 'camp' }]), ...bagOf({ 'four-hammer-marks': 1 }) });
    await openPlay(page, '?at=delve');
    const descend = page.getByRole('button', { name: /Descend to your camp/ });
    await expect(descend).toBeVisible({ timeout: 60000 });
    await descend.click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
    await page.waitForTimeout(1500);
    // Walk to the hearth and wake it (E), then measure walking the hall either side of it.
    await focusWorld(page);
    await page.keyboard.down('d'); await page.waitForTimeout(1300); await page.keyboard.up('d');
    await page.keyboard.press('e');
    await page.waitForTimeout(500);
    await measure(page, cdp, 'delve:furnace-hall');
  });

  test('delve: Magma Halls beside a lava pool', async ({ page }) => {
    const cdp = await phone(page);
    // A wall between the camp and the pool (cols 31-35): the walk never enters the lava.
    const f = new DelveFixture().set(36, 47, 'bedrock').set(36, 48, 'bedrock').set(44, 47, 'bedrock').set(44, 48, 'bedrock').camp(39, 48);
    await descendTo(page, f);
    await measure(page, cdp, 'delve:lava-pool');
  });
});

/**
 * The guard: the Magma Halls is the heaviest scene (lighting + torches +
 * terrain). Skipped on CI: shared runners make frame timing meaningless.
 */
guard('/play perf guard', () => {
  test('town p95 frame time at 4× CPU throttle stays under the ceiling', async ({ page }) => {
    test.setTimeout(120000);
    const cdp = await phone(page);
    await seed(page, inTown('infernal'));
    await openPlay(page);
    const r = await measure(page, cdp, 'guard:infernal');
    expect(r.p95, `p95 ${r.p95} ms`).toBeLessThan(GUARD_P95_MS);
  });
});
