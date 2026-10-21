/**
 * play-memory.spec.ts — opening and closing in-world places must not pile up.
 *
 * Owner report (2026-10-13): on a phone, /play crashed after opening menus in
 * town (the Crafting Bench first). This guard opens and closes stations 20 times
 * on a 390×844 DPR-3 touch viewport and asserts that the JS heap, DOM nodes
 * (detached included), canvases and decoded image pixels stay flat, and that
 * the world stops drawing while a place covers it.
 *
 *   PW_PORT=4275 npx playwright test e2e/play-memory.spec.ts --project=chromium
 *
 * PLAY_MEMORY_PROBE=1 prints one JSON line per cycle (and PLAY_MEMORY_OUT=file
 * writes them all), 4× CPU throttled: the measuring run behind
 * docs/handoff/memory-heat-css.md. Chromium only (CDP). Skipped on CI: heap
 * numbers on shared runners are noisy.
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import { ERA, mapFind, openPlay, seed } from './play-helpers';
import { RAF_COUNTER, sample, startProbe, type MemorySample } from './play-memory-probe';

const PROBE = !!process.env['PLAY_MEMORY_PROBE'];
const OUT = process.env['PLAY_MEMORY_OUT'];

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

const RESTORED = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };
const inTown = (town: string) => ({ ...RESTORED, 'eclipse-play-world-v1': { town } });

async function taskSeconds(cdp: Awaited<ReturnType<typeof startProbe>>): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find(m => m.name === 'TaskDuration')?.value ?? 0;
}

const place = (page: Page) => page.locator('section.place');

async function openPlace(page: Page, name: RegExp): Promise<void> {
  await page.locator('.places-toggle').click();
  await mapFind(page, name);
  await page.locator('#places-list button', { hasText: name }).first().click();
  await expect(place(page)).toBeVisible({ timeout: 60000 });
  // The hosted page has rendered (not just the "Opening…" note).
  await expect(place(page).locator('.place-body > :not(p):not(ng-container)').first()).toBeAttached({ timeout: 60000 });
  await page.waitForTimeout(600);
}

async function closePlace(page: Page): Promise<void> {
  await place(page).locator('.place-close').click();
  await expect(place(page)).toBeHidden({ timeout: 10000 });
  await page.waitForTimeout(400);
}

/** Deliberately not run on CI (not a left-over isolation): heap numbers on shared runners are noisy. */
const suite = process.env['CI'] ? test.describe.skip : test.describe;

suite('/play memory across place open/close', () => {

  const scenes: { town: string; stations: RegExp[] }[] = PROBE
    ? [
        { town: 'infernal', stations: [/Crafting Bench/, /Rune Forge/, /Enchanting Table/, /The Vault/, /Material Vendor/] },
        { town: 'luminous', stations: [/The Market/] },
        { town: 'celestial', stations: [/The Codex/] },
        { town: 'umbral', stations: [/The Gambler/] },
        { town: 'verdant', stations: [/The Sanctum/] },
      ]
    : [{ town: 'infernal', stations: [/Crafting Bench/, /Rune Forge/, /Enchanting Table/, /The Vault/] }];

  for (const scene of scenes) {
    test(`${scene.town}: 20 open/close cycles stay flat`, async ({ page, browserName }) => {
      // CDP (heap, queryObjects, LayerTree) is Chromium-only; WebKit has nothing to read here.
      if (browserName !== 'chromium') return;
      test.setTimeout(PROBE ? 900000 : 420000);
      await page.addInitScript(RAF_COUNTER);
      // The crash (2026-10-13): opening the Crafting Bench recursed through
      // CraftingService.init() → snapshot$ until "Maximum call stack size
      // exceeded". Angular's ErrorHandler swallowed it into one console line.
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
      await seed(page, inTown(scene.town));
      await openPlay(page);
      await page.waitForTimeout(1500);
      const cdp = await startProbe(page);
      if (PROBE) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const rows: (MemorySample & { step: string })[] = [];
      const log = (step: string, s: MemorySample) => {
        rows.push({ step, ...s });
        if (PROBE) process.stdout.write(`${JSON.stringify({ town: scene.town, step, ...s })}\n`);
      };
      const idle = await sample(page, cdp);
      log('idle', idle);
      // One warm-up cycle per station: lazy chunks, fonts and images load once.
      for (const station of scene.stations) { await openPlace(page, station); await closePlace(page); }
      const base = await sample(page, cdp);
      log('baseline', base);
      let open: MemorySample | null = null;
      const cycles = PROBE ? 20 : 20;
      for (let i = 0; i < cycles; i++) {
        const station = scene.stations[i % scene.stations.length];
        const before = await taskSeconds(cdp);
        await openPlace(page, station);
        const openMs = Math.round((await taskSeconds(cdp) - before) * 1000);
        if (PROBE) process.stdout.write(`${JSON.stringify({ town: scene.town, step: `open ${i + 1} ${station.source}`, openTaskMs: openMs })}\n`);
        if (PROBE || i === 0) { open = await sample(page, cdp); log(`open ${i + 1} ${station.source}`, open); }
        await closePlace(page);
        if (PROBE || i === cycles - 1) log(`closed ${i + 1}`, await sample(page, cdp));
      }
      const end = rows[rows.length - 1];
      expect(errors.filter(e => /call stack|GODFORGE ERROR/i.test(e)), 'no errors while opening places').toEqual([]);
      if (OUT) fs.appendFileSync(OUT, rows.map(r => JSON.stringify({ town: scene.town, ...r })).join('\n') + '\n');
      // Generous bounds: a real leak grows by a panel (thousands of nodes, MBs) per cycle.
      expect(end.heapMB - base.heapMB, `heap ${base.heapMB} → ${end.heapMB} MB`).toBeLessThan(6);
      expect(end.nodes - base.nodes, `DOM nodes ${base.nodes} → ${end.nodes}`).toBeLessThan(1500);
      expect(end.listeners - base.listeners, `listeners ${base.listeners} → ${end.listeners}`).toBeLessThan(300);
      expect(end.canvases, `canvases ${base.canvases} → ${end.canvases}`).toBeLessThanOrEqual(base.canvases + 2);
      expect(end.imagesDecodedMP - base.imagesDecodedMP, `decoded images ${base.imagesDecodedMP} → ${end.imagesDecodedMP} MP`).toBeLessThan(8);
      // The covered world does not draw: the engine's loop is parked while a place is open.
      expect(open!.rafPerSec, `rAF callbacks/s with a place open`).toBeLessThan(idle.rafPerSec / 2 + 5);
    });
  }
});
