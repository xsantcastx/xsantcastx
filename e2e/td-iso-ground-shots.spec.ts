/**
 * td-iso-ground-shots.spec.ts — the isometric ground's photographs (td-iso-tiles.ts, docs/handoff/iso-ground.md).
 * Skipped unless ISO_GROUND_SHOTS is set:
 *
 *   ISO_GROUND_SHOTS=1 [ISO_GROUND_TAG=after] [ISO_GROUND_SCENES=town,forest,...] [ISO_GROUND_SIZES=phone,desktop] \
 *     PW_PORT=4741 npx playwright test e2e/td-iso-ground-shots --project=chromium
 *
 * Town, forest, harbour, dungeon, the night bridge (Ashwater Lake's Nightroad), the ash lands (Ember Isle's
 * Ashfields) and the snow (Ember Isle reskinned through `__tdArt.isoLand('snow')`: no map lays snow yet), at
 * 390×844 DPR 3 and 1280×800 DPR 2, into output/iso-ground/<scene>-<size>-<tag>.png (not committed). A camera, not a
 * test.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const ON = !!process.env['ISO_GROUND_SHOTS'];
const TAG = process.env['ISO_GROUND_TAG'] ?? 'after';
const SCENES = (process.env['ISO_GROUND_SCENES'] ?? 'town,forest,harbour,dungeon,nightbridge,ash,snow').split(',');
const SIZE_NAMES = (process.env['ISO_GROUND_SIZES'] ?? 'phone,desktop').split(',');
const DIR = 'output/iso-ground';
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
] as const;

const run = (page: Page, fn: string) => page.evaluate(f => new Function('w', `return (${f})(w)`)(window), fn);

async function open(page: Page, query: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 },
  });
  await page.goto(`/play?td=1&${query}&artopt=iso`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown }).__tdZones && !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  await page.waitForTimeout(2000);
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
}

const PLACES: Record<string, { query?: string; go: string }> = {
  // The Basalt Seamworks' square: cobble, grass, the river and its plank bridge.
  town: { go: 'w => w.__tdZones.to(10, 24)' },
  // The Emberwood: grass, flower beds, a worn road through it.
  forest: { go: "w => { w.__tdZones.to(52, 76); w.__tdArt.road(0); }" },
  // Ember Harbour: sand, the sea, the pier on its posts.
  harbour: { go: "w => w.__tdArt.visit('surface', 30, 111, 'ember-isle')" },
  // Ember Mine −1: the dungeon's floor under its rock.
  dungeon: { go: "w => w.__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle')" },
  // Ashwater Lake's Nightroad at night: the ghost planks across the water.
  nightbridge: { query: 'phase=night&fxdark=1', go: "w => w.__tdDark.road('ashwater', 'shore')" },
  // Ember Isle's Ashfields: ash and lava (the cave floor reads as ash under the open sky).
  ash: { go: "w => w.__tdZones.to(100, 44)" },
  // Snow: no map lays it yet, so Ember Isle's meadows are drawn as snow (the iso painter's preview hook).
  snow: { go: "w => { w.__tdArt.isoLand && w.__tdArt.isoLand('snow'); w.__tdZones.to(52, 76); w.__tdArt.road(0); }" },
};

const shots = ON ? test.describe : test.describe.skip;
for (const size of SIZES) if (SIZE_NAMES.includes(size.name)) shots(`iso ground (${size.name})`, () => {
  test.use(size.use);
  for (const name of SCENES) test(name, async ({ page }) => {
    test.setTimeout(120000);
    const place = PLACES[name];
    await open(page, place.query ?? 'hour=12');
    await run(page, place.go);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${DIR}/${name}-${size.name}-${TAG}.png` });
  });
});
