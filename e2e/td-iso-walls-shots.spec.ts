/**
 * td-iso-walls-shots.spec.ts — the isometric walls, buildings and landmarks (td-hd-structures.ts,
 * docs/handoff/iso-walls.md). Skipped unless ISO_WALLS_SHOTS is set:
 *
 *   ISO_WALLS_SHOTS=1 [ISO_WALLS_TAG=after] [ISO_SCENES=town,dungeon,harbour,hearth,inn,behind] [ISO_SIZES=phone,desktop] \
 *     PW_PORT=4791 npx playwright test e2e/td-iso-walls-shots --project=chromium
 *
 * Writes output/iso-walls/<tag>/<scene>-<size>.png (not committed): 1280×800 DPR 2 and 390×844 DPR 3. A camera, not a
 * test — but every scene must draw without a page error.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const ON = !!process.env['ISO_WALLS_SHOTS'];
const TAG = process.env['ISO_WALLS_TAG'] ?? 'after';
const SCENES = (process.env['ISO_SCENES'] ?? 'town,dungeon,harbour,hearth,inn,behind,crypt').split(',');
const SIZE_NAMES = (process.env['ISO_SIZES'] ?? 'phone,desktop').split(',');
const DIR = `output/iso-walls/${TAG}`;
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
] as const;

const run = (page: Page, fn: string) => page.evaluate(f => new Function('w', `return (${f})(w)`)(window), fn);

async function open(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
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
  return errors;
}

const PLACES: Record<string, { query?: string; go: string }> = {
  town: { go: 'w => true' },
  harbour: { go: "w => w.__tdArt.visit('surface', 30, 111, 'ember-isle')" },
  dungeon: { go: "w => w.__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle')" },
  // The inn's upstairs: the hall's doorways into the guest rooms, the room's camera-side walls cut away.
  inn: { go: "w => w.__tdArt.visit('ember-inn-2', 8, 5, 'ember-isle')" },
  // The Drowned Crypts' drowned walls.
  crypt: { go: "w => w.__tdArt.visit('drowned-crypts-1', 24, 3, 'umbral-marches')" },
  // The Seamworks' Cold Hearth by day, the Keeper three tiles east of it (so it shows).
  hearth: { query: 'phase=day&fxfall=1', go: "w => { w.__tdHearth.at('hearth'); return new Promise(done => setTimeout(() => { const cv = document.querySelector('canvas'); const c = Math.floor(+cv.getAttribute('data-player-x') / 16), r = Math.floor(+cv.getAttribute('data-player-y') / 16); done(w.__tdArt.visit('surface', c + 3, r + 2, 'ember-isle')); }, 500)); }" },
  // Behind a house: the roof cut away, the walls dithered over the Keeper.
  // Behind a house (the thatched one south-west of the square, the Keeper a tile north of it): the roof lifted, the
  // walls over him see-through.
  behind: { go: "w => { const cv = document.querySelector('canvas'); const c = Math.floor(+cv.getAttribute('data-player-x') / 16), r = Math.floor(+cv.getAttribute('data-player-y') / 16); return w.__tdArt.visit('surface', c - 17, r - 5, 'ember-isle'); }" },
};

const shots = ON ? test.describe : test.describe.skip;
for (const size of SIZES) if (SIZE_NAMES.includes(size.name)) shots(`iso walls (${size.name})`, () => {
  test.use(size.use);
  for (const name of SCENES) test(name, async ({ page }) => {
    test.setTimeout(120000);
    const place = PLACES[name];
    const errors = await open(page, place.query ?? 'hour=12');
    await run(page, place.go);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${DIR}/${name}-${size.name}.png` });
    expect(errors).toEqual([]);
  });
});
