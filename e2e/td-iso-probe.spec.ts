/**
 * td-iso-probe.spec.ts — prices each section of the isometric renderer on the phone profile (docs/handoff/iso.md).
 * Skipped unless ISO_PROBE is set:
 *
 *   ISO_PROBE=1 [ISO_PROBE_SCENE=town] PW_PORT=4706 npx playwright test e2e/td-iso-probe --project=chromium
 *
 * Stands in a scene at CPU ×6 with the canvas flushed after each section of drawIso (window.__tdArt.isoFlush), so each
 * section's time per frame includes its own rasterisation: ground, floor, queue, standing, air, fog/light, world UI, bake.
 */
import { expect, test } from '@playwright/test';
import { seed } from './play-helpers';

const on = process.env['ISO_PROBE'] ? test.describe : test.describe.skip;
const SCENE = process.env['ISO_PROBE_SCENE'] ?? 'town';
const GO: Record<string, string> = {
  town: 'w => true',
  road: "w => { w.__tdZones.to(58, 62); w.__tdArt.road(0); w.__tdArt.aura(true); }",
  harbour: "w => w.__tdArt.visit('surface', 30, 111, 'ember-isle')",
  dungeon: "w => w.__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle')",
  hot: "w => { w.__tdZones.to(58, 62); w.__tdArt.road(0); w.__tdArt.aura(true); for (let i = 0; i < 18; i++) w.__tdZones.foe('bone-walker', 3, Math.round(Math.cos(i * .7) * (40 + i * 4)), Math.round(Math.sin(i * .7) * (30 + i * 3))); }",
};

on('iso probe', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test(SCENE, async ({ page }) => {
    test.setTimeout(240000);
    await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', hair: 'curls', updatedAt: 1 } });
    await page.goto('/play?td=1&hour=12&artopt=iso');
    await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
    await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt);
    await page.waitForTimeout(2000);
    await page.evaluate(f => new Function('w', `return (${f})(w)`)(window), GO[SCENE]);
    await page.waitForTimeout(3000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env['TD_CPU'] ?? 6) });
    // Each section flushed before it is timed: ms per frame per section, raster included (window.__tdArt.isoProf).
    await page.evaluate(() => { const a = (window as unknown as { __tdArt: { isoFlush(on: boolean): void; isoProf(): number[] } }).__tdArt; a.isoFlush(true); a.isoProf(); });
    for (let k = 0; k < 3; k++) {
      await page.waitForTimeout(3000);
      const ip = await page.evaluate(() => (window as unknown as { __tdArt: { isoProf(): number[] } }).__tdArt.isoProf());
      const fr = Math.max(1, ip[ip.length - 1]), per = ip.slice(0, -1).map(v => (v / fr).toFixed(2));
      console.warn(`[iso-probe] ${SCENE} ms/frame with raster — ground ${per[0]} floor ${(+per[1] + +per[8] + +per[9]).toFixed(2)} queue ${per[2]} standing ${per[3]} air ${per[4]} fog/light ${per[5]} ui ${per[6]} bake ${per[7]} | floor = shadows ${per[8]} + ground fx ${per[9]} + water ${per[1]} (${fr} frames)`);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
});
