/**
 * td-edges-shots.spec.ts — the organic terrain edges and the ringless aura (docs/handoff/edges/). Skipped unless
 * EDGES_SHOTS names a prefix (`before` on a main build, `after` on this one):
 *
 *   EDGES_SHOTS=after PW_PORT=4707 npx playwright test e2e/td-edges-shots --project=chromium
 *
 * Four places at noon, 1280×800 and 390×844 at 1 device px per CSS px (what the canvas paints, pixel for pixel):
 * - shore: the water nearest the Seamworks square (the nearest fishing spot's shore);
 * - harbour: Ember Harbour's quay (surface 30,111);
 * - road: the Emberwood road (58,62, beside the worn road) with the Keeper's aura on, three Bone Walkers round him and
 *   a pulse just fired;
 * - dungeon: Ember Mine −1 (11,13), a quiet floor (the Barrow's vault boss walks over in the time the title takes).
 * Into docs/handoff/edges/<prefix>-<scene>-<size>.png. A camera, not a test.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const PREFIX = process.env['EDGES_SHOTS'] ?? '';
const DIR = 'docs/handoff/edges';
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
] as const;

type W = {
  __tdZones: { to(c: number, r: number): boolean; foe(type: string, level: number, dx?: number, dy?: number): number | null };
  __tdArt: { aura(on: boolean): void; pulse?(): number; road(dc: number): unknown; visit(l: string, c: number, r: number, k?: string): boolean };
  __tdGather: { spots(reach?: number): { water: boolean; x: number; y: number }[]; near(x: number, y: number, dx?: number, dy?: number): boolean };
};

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 } });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => { const w = window as unknown as Partial<W>; return !!w.__tdArt && !!w.__tdZones && !!w.__tdGather; });
  await page.waitForTimeout(2500);
}

const shots = PREFIX ? test.describe : test.describe.skip;
for (const size of SIZES) {
  shots(`edges shots (${size.name})`, () => {
    test.use(size.use);
    test('shore', async ({ page }) => {
      test.setTimeout(120000);
      await open(page);
      const ok = await page.evaluate(() => {
        const w = window as unknown as W, s = w.__tdGather.spots(1600).find(p => p.water);
        return !!s && w.__tdGather.near(s.x, s.y, 0, 40);
      });
      expect(ok).toBe(true);
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${DIR}/${PREFIX}-shore-${size.name}.png` });
    });
    test('harbour', async ({ page }) => {
      test.setTimeout(120000);
      await open(page);
      expect(await page.evaluate(() => (window as unknown as W).__tdArt.visit('surface', 30, 111, 'ember-isle'))).toBe(true);
      await page.waitForTimeout(7500);
      await page.screenshot({ path: `${DIR}/${PREFIX}-harbour-${size.name}.png` });
    });
    test('road with aura', async ({ page }) => {
      test.setTimeout(120000);
      await open(page);
      await page.evaluate(() => { const w = window as unknown as W; w.__tdZones.to(58, 62); w.__tdArt.road(0); });
      await page.waitForTimeout(600);
      await page.evaluate(() => { const z = (window as unknown as W).__tdZones; z.foe('bone-walker', 3, -50, -28); z.foe('bone-walker', 3, 50, -34); z.foe('bone-walker', 3, -46, 30); });
      await page.evaluate(() => (window as unknown as W).__tdArt.aura(true));
      await page.waitForTimeout(4000);
      // A pulse mid-run (the build that has one): the brief radius flash the aura gives instead of a standing ring.
      await page.evaluate(() => (window as unknown as W).__tdArt.pulse?.());
      await page.waitForTimeout(260);
      await page.screenshot({ path: `${DIR}/${PREFIX}-road-${size.name}.png` });
    });
    test('dungeon floor', async ({ page }) => {
      test.setTimeout(120000);
      await open(page);
      expect(await page.evaluate(() => (window as unknown as W).__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle'))).toBe(true);
      // Past the floor's title card.
      await page.waitForTimeout(7500);
      await page.screenshot({ path: `${DIR}/${PREFIX}-dungeon-${size.name}.png` });
    });
  });
}
