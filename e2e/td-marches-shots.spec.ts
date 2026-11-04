/**
 * td-marches-shots.spec.ts — photographs of S11 part 2's new areas (the Umbral Marches as an act) for the Director's
 * review: each spot in Isometric (the default) and Classic at 1280×800, and Isometric on a phone (390×844), by day and
 * at night; the Bell Under the Water's ripple and the keyhole glowing; the Atlas on a small phone. The tutorial is
 * hidden. Written to output/s11marches/ (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { purse, seed } from './play-helpers';

const OUT = 'output/s11marches';
const canvas = (page: Page) => page.locator('canvas').first();
type Spot = { name: string; level: string; area: string; c: number; r: number };
const SPOTS: readonly Spot[] = [
  { name: 'shore-mirewatch-boardwalk', level: 'surface', area: 'umbral-marches-shore', c: -1, r: 64 },
  { name: 'shore-corvane-stone', level: 'surface', area: 'umbral-marches-shore', c: 8, r: 9 },
  { name: 'shore-north-boardwalk', level: 'surface', area: 'umbral-marches-shore', c: 100, r: -40 },
  { name: 'gloamhaven-west-boardwalk', level: 'surface', area: 'umbral-marches-gloamhaven', c: 0, r: 18 },
  { name: 'fen-wick-stone', level: 'surface', area: 'umbral-marches-fen', c: 8, r: 9 },
  { name: 'fen-lanternfen-road', level: 'surface', area: 'umbral-marches-fen', c: -112, r: -30 },
  { name: 'boardwalk-prayer-board', level: 'surface', area: 'umbral-marches-boardwalk', c: -60, r: 10 },
  { name: 'boardwalk-broken-end', level: 'surface', area: 'umbral-marches-boardwalk', c: 108, r: -52 },
  { name: 'belfry-bell-chamber', level: 'sunken-belfry-1', area: 'umbral-marches-boardwalk', c: 12, r: 6 },
  { name: 'belfry-fifth-door', level: 'sunken-belfry-1', area: 'umbral-marches-boardwalk', c: 42, r: 28 },
  { name: 'meres-belfry-roof', level: 'surface', area: 'umbral-marches-meres', c: -24, r: -40 },
  { name: 'meres-lure-pools', level: 'surface', area: 'umbral-marches-meres', c: 200, r: 62 },
  { name: 'meres-three-posts-pool', level: 'surface', area: 'umbral-marches-meres', c: 96, r: -46 },
  { name: 'deep-fen-knights-causeway', level: 'surface', area: 'umbral-marches-deep-fen', c: 180, r: 40 },
  { name: 'deep-fen-peat-cut', level: 'surface', area: 'umbral-marches-deep-fen', c: 236, r: -42 },
  { name: 'galleries-1-cutters-hall', level: 'bog-galleries-1', area: 'umbral-marches-deep-fen', c: 40, r: 30 },
  { name: 'galleries-2-flooded-cut', level: 'bog-galleries-2', area: 'umbral-marches-deep-fen', c: 30, r: 27 },
  { name: 'ruins-witchs-island', level: 'surface', area: 'umbral-marches-ruins', c: 160, r: 82 },
  { name: 'ruins-lantern-ring', level: 'surface', area: 'umbral-marches-ruins', c: 110, r: -30 },
  { name: 'ruins-crypt-door', level: 'surface', area: 'umbral-marches-ruins', c: 264, r: -40 },
];

async function open(page: Page, graphics: 'iso' | 'classic', query = '/play?td=1&hour=12'): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1', 'eclipse-td-graphics': graphics, 'preferred-language': 'en', ...purse(1000) });
  await page.goto(query);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  // The tutorial panel (the prologue's goal list) is hidden: these are photographs of the land, not of the HUD.
  await page.addStyleTag({ content: '.lvl-banner, .glim-say, .area-card, .guide { visibility: hidden !important; }' });
  // A level-1 Keeper in a level-30 zone would not live to the next photograph: the fight is held still for the camera.
  await page.evaluate(() => (window as unknown as { __tdArt: { freeze: (on: boolean) => void } }).__tdArt.freeze(true));
}
const visit = (page: Page, s: Spot) => page.evaluate(v => (window as unknown as { __tdArt: { visit: (l: string, c: number, r: number, k: string) => boolean } }).__tdArt.visit(v.level, v.c, v.r, v.area), s);

const VIEWS = [{ g: 'iso', w: 1280, h: 800, tag: 'iso' }, { g: 'classic', w: 1280, h: 800, tag: 'classic' }, { g: 'iso', w: 390, h: 844, tag: 'phone' }] as const;
for (const view of VIEWS) {
  for (const time of [{ hour: 12, tag: 'day' }, { hour: 23, tag: 'night' }] as const) {
    test(`the Marches' new areas, ${view.tag}, ${time.tag}`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width: view.w, height: view.h });
      await open(page, view.g, `/play?td=1&hour=${time.hour}`);
      for (const s of SPOTS) {
        expect(await visit(page, s), s.name).toBe(true);
        await page.waitForTimeout(1600);
        await page.screenshot({ path: `${OUT}/${s.name}-${view.tag}-${time.tag}.jpg`, type: 'jpeg', quality: 78 });
      }
    });
  }

  test(`the Bell Under the Water at night: the ripple, then the keyhole glowing, ${view.tag}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: view.w, height: view.h });
    // Reduced motion off for this one: the ripple is the effect in frame.
    await open(page, view.g, '/play?td=1&hour=23');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !!(window as unknown as { __tdS8?: unknown }).__tdS8);
    await visit(page, { name: 'roof', level: 'surface', area: 'umbral-marches-meres', c: -24, r: -42 });
    await page.evaluate(() => (window as unknown as { __tdS8: { night: (id: string) => boolean } }).__tdS8.night('bell-under-water'));
    type U = { age: number | null; keyhole: boolean };
    const ub = () => page.evaluate(() => (window as unknown as { __tdS8: { underbell: () => U } }).__tdS8.underbell());
    await expect.poll(async () => (await ub()).age ?? -1, { timeout: 10000 }).toBeGreaterThan(1.5);
    await page.screenshot({ path: `${OUT}/underbell-ripple-${view.tag}.jpg`, type: 'jpeg', quality: 80 });
    await expect.poll(async () => (await ub()).keyhole, { timeout: 25000 }).toBe(true);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/underbell-keyhole-${view.tag}.jpg`, type: 'jpeg', quality: 80 });
  });
}

test('the Marches\' Atlas on a small phone (360×640)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, 'iso');
  await visit(page, { name: 'corvane', level: 'surface', area: 'umbral-marches-shore', c: 8, r: 5 });
  await page.waitForTimeout(600);
  await canvas(page).focus();
  await page.keyboard.press('e');
  await expect(page.locator('.td-atlas')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/atlas-phone-360.jpg`, type: 'jpeg', quality: 80 });
});
