/**
 * td-iso-shots.spec.ts — the production isometric renderer's photographs (td-artopt.ts `iso`, docs/handoff/iso.md).
 * Skipped unless ISO_SHOTS is set:
 *
 *   ISO_SHOTS=1 [ISO_SCENES=road,town,harbour,dungeon,tavern,hot,night] [ISO_SIZES=phone,desktop] PW_PORT=4706 \
 *     npx playwright test e2e/td-iso-shots --project=chromium
 *
 * The perf scenes (e2e/td-perf-phone.spec.ts) and the inn, at 390×844 DPR 3 and 1280×800 DPR 2, into
 * output/iso/<scene>-<size>.png (not committed). A camera, not a test.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const ON = !!process.env['ISO_SHOTS'];
const SCENES = (process.env['ISO_SCENES'] ?? 'road,town,harbour,dungeon,tavern,hot,night').split(',');
const SIZE_NAMES = (process.env['ISO_SIZES'] ?? 'phone,desktop').split(',');
const DIR = 'output/iso';
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
] as const;

const run = (page: Page, fn: string) => page.evaluate(f => new Function('w', `return (${f})(w)`)(window), fn);

async function open(page: Page, hour = 12): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 },
  });
  await page.goto(`/play?td=1&hour=${hour}&artopt=iso`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown }).__tdZones && !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  await page.waitForTimeout(2000);
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
}

const PLACES: Record<string, { hour?: number; go: string }> = {
  road: { go: "w => { w.__tdZones.to(58, 62); w.__tdArt.road(0); w.__tdArt.aura(true); }" },
  town: { go: 'w => true' },
  harbour: { go: "w => w.__tdArt.visit('surface', 30, 111, 'ember-isle')" },
  dungeon: { go: "w => w.__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle')" },
  tavern: { go: "w => w.__tdArt.visit('artopt-tavern', 9, 8, 'ember-isle')" },
  hot: { go: "w => { w.__tdZones.to(58, 62); w.__tdArt.road(0); w.__tdArt.aura(true); for (let i = 0; i < 18; i++) w.__tdZones.foe('bone-walker', 3, Math.round(Math.cos(i * .7) * (40 + i * 4)), Math.round(Math.sin(i * .7) * (30 + i * 3))); }" },
  night: { hour: 23, go: 'w => true' },
};

const shots = ON ? test.describe : test.describe.skip;
for (const size of SIZES) if (SIZE_NAMES.includes(size.name)) shots(`iso (${size.name})`, () => {
  test.use(size.use);
  for (const name of SCENES) test(name, async ({ page }) => {
    test.setTimeout(120000);
    const place = PLACES[name];
    await open(page, place.hour ?? 12);
    await run(page, place.go);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${DIR}/${name}-${size.name}.png` });
  });
});
