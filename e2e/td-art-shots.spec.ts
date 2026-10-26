/**
 * td-art-shots.spec.ts — the art style upgrade's camera (docs/handoff/art-style.md). Skipped unless ART_SHOTS names a
 * prefix:
 *
 *   ART_SHOTS=after PW_PORT=4698 npx playwright test e2e/td-art-shots --project=chromium
 *
 * One spot in the Emberwood (the starting island's forest: trees, grass, a dirt road) at noon, with the Keeper (an
 * Ashguard, sword and cape), three Bone Walkers standing calm round him, and his aura running when the build has one
 * (window.__tdArt). 1280×800 and 390×844 into docs/handoff/art/<prefix>-forest-<size>.png. A camera, not a test.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const PREFIX = process.env['ART_SHOTS'] ?? '';
const DIR = 'docs/handoff/art';
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
] as const;

type Zones = { to(c: number, r: number): boolean; foe(type: string, level: number, dx?: number, dy?: number): number | null };
const zones = (page: Page, fn: (z: Zones) => unknown) => page.evaluate(f => new Function('z', `return (${f})(z)`)((window as unknown as { __tdZones: Zones }).__tdZones), fn.toString());

const shots = PREFIX ? test.describe : test.describe.skip;
for (const size of SIZES) {
  shots(`art shots (${size.name})`, () => {
    test.use(size.use);
    test('town square', async ({ page }) => {
      test.setTimeout(120000);
      await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
      await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', hair: 'curls', updatedAt: 1 } });
      await page.goto('/play?td=1&hour=12');
      await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${DIR}/${PREFIX}-town-${size.name}.png` });
    });
    // Stage 4 (the structures, the dungeon dressing, interiors and the water): a few places in the new style.
    // [name, level, c, r, continent, wait ms] (the vault's dead walk: photograph it before they arrive).
    const spots: [string, string, number, number, string, number][] = [
      ['barrow-door', 'hushed-barrow-1', 15, 11, 'ember-isle', 2600], ['harbour', 'surface', 30, 111, 'ember-isle', 7500], ['inn', 'ember-inn-1', 10, 6, 'ember-isle', 7500], ['mine', 'ember-mine-1', 11, 13, 'ember-isle', 7500],
    ];
    for (const [name, level, c, r, continent, wait] of spots) test(`stage 4: ${name}`, async ({ page }) => {
      test.setTimeout(120000);
      await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
      await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', hair: 'curls', updatedAt: 1 } });
      await page.goto('/play?td=1&hour=12');
      await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
      await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt);
      await page.waitForTimeout(2500);
      const ok = await page.evaluate(([l, cc, rr, k]) => (window as unknown as { __tdArt: { visit(l: string, c: number, r: number, k: string): boolean } }).__tdArt.visit(l as string, cc as number, rr as number, k as string), [level, c, r, continent] as const);
      expect(ok).toBe(true);
      // Clear the stage: no creature in the photograph, the place's title faded.
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `${DIR}/${PREFIX}-${name}-${size.name}.png` });
    });
    test('forest clearing', async ({ page }) => {
      test.setTimeout(120000);
      await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
      await seed(page, {
        'eclipse-td': '1',
        'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 },
      });
      await page.goto('/play?td=1&hour=12');
      const canvas = page.locator('canvas').first();
      await expect(canvas).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
      await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown }).__tdZones);
      await page.waitForTimeout(2500);
      const at = (process.env['ART_AT'] ?? '58,62').split(',').map(Number);
      await zones(page, new Function('z', `return z.to(${at[0]}, ${at[1]})`) as (z: Zones) => unknown);
      // Beside a worn road, when the build can find one (window.__tdArt.road).
      if (process.env['ART_ROAD'] !== '0') console.warn('road', JSON.stringify(await page.evaluate(() => (window as unknown as { __tdArt?: { road(dc: number): unknown } }).__tdArt?.road?.(0))));
      await page.waitForTimeout(600);
      await zones(page, z => { z.foe('bone-walker', 3, -50, -28); z.foe('bone-walker', 3, 50, -34); z.foe('bone-walker', 3, -46, 30); return true; });
      await page.evaluate(() => { const a = (window as unknown as { __tdArt?: { aura(on: boolean): void } }).__tdArt; a?.aura(true); });
      await page.waitForTimeout(4500);
      await page.screenshot({ path: `${DIR}/${PREFIX}-forest-${size.name}.png` });
      // A close-up round the Keeper at twice the size (the details).
      const box = (await canvas.boundingBox())!, w = size.name === 'phone' ? 300 : 520, h = size.name === 'phone' ? 300 : 360;
      await page.screenshot({ path: `${DIR}/${PREFIX}-closeup-${size.name}.png`, clip: { x: Math.round(box.x + box.width / 2 - w / 2), y: Math.round(box.y + box.height / 2 - h / 2 + 10), width: w, height: h } });
    });
  });
}
