/**
 * td-iso-props-shots.spec.ts — the isometric ground dressing's photographs (td-iso-props.ts, docs/handoff/iso-props.md):
 * trees and bushes in every land, the town's props, the harbour, and a loot pile. Skipped unless PROPS_SHOTS is set:
 *
 *   PROPS_SHOTS=1 [PROPS_TAG=after] [PROPS_SCENES=forest,town,harbour,loot,jungle,marsh] [PROPS_SIZES=phone,desktop] \
 *     PW_PORT=4741 npx playwright test e2e/td-iso-props-shots --project=chromium
 *
 * Into output/iso-props/<tag>-<scene>-<size>.png (not committed). A camera, not a test.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const ON = !!process.env['PROPS_SHOTS'];
const TAG = process.env['PROPS_TAG'] ?? 'after';
const SCENES = (process.env['PROPS_SCENES'] ?? 'forest,town,harbour,loot,jungle,marsh').split(',');
const SIZE_NAMES = (process.env['PROPS_SIZES'] ?? 'phone,desktop').split(',');
const DIR = 'output/iso-props';
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
  await page.goto(`/play?td=1&hour=12&artopt=iso${query}`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown }).__tdZones && !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  await page.waitForTimeout(2000);
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
  await page.addStyleTag({ content: '.guide, .glim-say, .lvl-banner, .area-card { visibility: hidden !important; }' });
}

const PLACES: Record<string, { query?: string; go: string }> = {
  // The deep Emberwood (ember-isle.ts region F).
  forest: { go: 'w => w.__tdZones.to(-36, -44)' },
  // The Seamworks square: lamps, barrels, crates, benches, the fence, the cart, signposts, trees.
  town: { go: 'w => w.__tdZones.to(22, 22)' },
  harbour: { go: "w => w.__tdArt.visit('surface', 30, 111, 'ember-isle')" },
  // The showcase's rungs round the Keeper (a piece of each rarity), and a pile of two on one tile beside him.
  loot: { query: '&fxloot=1', go: "w => { w.__tdGround.lay('ore', 34, 12, 5); w.__tdGround.lay('ore', 34, 12, 3); }" },
  // The Deep Wilds (verdant-wilds.ts J) and the Marches' cypress fen (umbral-marches.ts Q).
  jungle: { go: "w => w.__tdArt.visit('surface', -76, -20, 'verdant-wilds')" },
  marsh: { go: "w => { w.__tdArt.visit('surface', 20, 20, 'umbral-marches'); setTimeout(() => w.__tdZones.to(-76, -28), 1500); }" },
};

const shots = ON ? test.describe : test.describe.skip;
for (const size of SIZES) if (SIZE_NAMES.includes(size.name)) shots(`iso props (${size.name})`, () => {
  test.use(size.use);
  for (const name of SCENES) test(name, async ({ page }) => {
    test.setTimeout(120000);
    const place = PLACES[name];
    await open(page, place.query ?? '');
    await run(page, place.go);
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${DIR}/${TAG}-${name}-${size.name}.png` });
  });
});
