/**
 * td-artopt-iso-shots.spec.ts — the isometric prototype's photographs (td-artopt.ts `iso`, td-iso.ts). Skipped unless
 * ARTOPT_ISO_SHOTS is set:
 *
 *   ARTOPT_ISO_SHOTS=1 [ARTOPT=b,iso] PW_PORT=4704 npx playwright test e2e/td-artopt-iso-shots --project=chromium
 *
 * Top-down B (with the organic terrain edges) and isometric B in the same two places: the Emberwood road at noon (the
 * Keeper with his aura and pet, three Bone Walkers, trees, the road) and the prototype tavern (maps/artopt-tavern.ts:
 * the bar, barrels, tables, lamps, a dark storeroom). 1280×800 at DPR 2 and 390×844 at DPR 3, into
 * docs/handoff/artopt/iso/<opt>-<scene>-<size>.png. A camera, not a test.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const ON = !!process.env['ARTOPT_ISO_SHOTS'];
const OPTS = (process.env['ARTOPT'] ?? 'b,iso').split(',');
const SCENES = (process.env['ARTOPT_SCENES'] ?? 'road,tavern,shore').split(',');
const DIR = 'docs/handoff/artopt/iso';
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
] as const;

const zones = (page: Page, fn: string) => page.evaluate(f => new Function('z', `return (${f})(z)`)((window as unknown as { __tdZones: unknown }).__tdZones), fn);
const art = (page: Page, fn: string) => page.evaluate(f => new Function('a', `return (${f})(a)`)((window as unknown as { __tdArt: unknown }).__tdArt), fn);

async function open(page: Page, opt: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 },
  });
  await page.goto(`/play?td=1&hour=12&artopt=${opt}`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown }).__tdZones && !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  await page.waitForTimeout(2500);
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
}

const shots = ON ? test.describe : test.describe.skip;
for (const size of SIZES) for (const opt of OPTS) {
  shots(`artopt ${opt} (${size.name})`, () => {
    test.use(size.use);
    if (SCENES.includes('road')) test('emberwood road', async ({ page }) => {
      test.setTimeout(120000);
      await open(page, opt);
      await zones(page, 'z => z.to(58, 62)');
      await art(page, 'a => a.road(0)');
      await page.waitForTimeout(600);
      await zones(page, "z => { z.foe('bone-walker', 3, -50, -28); z.foe('bone-walker', 3, 50, -34); z.foe('bone-walker', 3, -46, 30); return true; }");
      await art(page, "a => { a.aura(true); a.pet?.('shade-kit'); }");
      await page.waitForTimeout(4500);
      await page.screenshot({ path: `${DIR}/${opt}-road-${size.name}.png` });
    });
    if (SCENES.includes('tavern')) test('tavern', async ({ page }) => {
      test.setTimeout(120000);
      await open(page, opt);
      const ok = await art(page, "a => a.visit('artopt-tavern', 9, 8, 'ember-isle')");
      expect(ok).toBe(true);
      await art(page, "a => { a.aura(true); a.pet?.('shade-kit'); }");
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${DIR}/${opt}-tavern-${size.name}.png` });
    });
    // The shore: sand, water and grass meeting (the organic edges and the foam).
    if (SCENES.includes('shore')) test('shore', async ({ page }) => {
      test.setTimeout(120000);
      await open(page, opt);
      const ok = await art(page, "a => a.visit('surface', 30, 111, 'ember-isle')");
      expect(ok).toBe(true);
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${DIR}/${opt}-shore-${size.name}.png` });
    });
  });
}
