/**
 * td-wilds-shots.spec.ts — photographs of S11's new areas (the Verdant Wilds as an act) for the Director's review: each
 * in Isometric (the default) and Classic at 1280×800, and Isometric on a phone (390×844); the Walking Tree at night with
 * Glim dimmed beside it; the Deep Wilds in Spore drift; the Atlas on a small phone. Written to output/s11wilds/ (not
 * committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { purse, seed } from './play-helpers';

const OUT = 'output/s11wilds';
const canvas = (page: Page) => page.locator('canvas').first();
type Spot = { name: string; level: string; area: string; c: number; r: number };
const SPOTS: readonly Spot[] = [
  { name: 'shore-mossharbor-road', level: 'surface', area: 'verdant-wilds-shore', c: 79, r: 64 },
  { name: 'shore-net-stone', level: 'surface', area: 'verdant-wilds-shore', c: 8, r: 9 },
  { name: 'shore-north-road', level: 'surface', area: 'verdant-wilds-shore', c: 100, r: -40 },
  { name: 'rootglass-east-boardwalk', level: 'surface', area: 'verdant-wilds-rootglass', c: 44, r: 18 },
  { name: 'fernglades-bell-post-stone', level: 'surface', area: 'verdant-wilds-fernglades', c: 8, r: 9 },
  { name: 'fernglades-thornwick-road', level: 'surface', area: 'verdant-wilds-fernglades', c: 92, r: 18 },
  { name: 'rootwater-the-planks', level: 'surface', area: 'verdant-wilds-rootwater', c: -60, r: -52 },
  { name: 'glassmere-shore', level: 'surface', area: 'verdant-wilds-glassmere', c: 100, r: -58 },
  { name: 'greenwood-copy-tree-stone', level: 'surface', area: 'verdant-wilds-greenwood', c: 8, r: 9 },
  { name: 'greenwood-thorn-hedge', level: 'surface', area: 'verdant-wilds-greenwood', c: 100, r: -142 },
  { name: 'greenwood-weaver-canopy', level: 'surface', area: 'verdant-wilds-greenwood', c: 190, r: -80 },
  { name: 'greenwood-root-hole', level: 'surface', area: 'verdant-wilds-greenwood', c: 228, r: -110 },
  { name: 'hollows-3-root-ramp', level: 'root-hollows-3', area: 'verdant-wilds-greenwood', c: 21, r: 19 },
  { name: 'deep-wilds-root-ramp', level: 'surface', area: 'verdant-wilds-deep-wilds', c: -20, r: -52 },
  { name: 'deep-wilds-hart-meadow', level: 'surface', area: 'verdant-wilds-deep-wilds', c: 150, r: 62 },
  { name: 'courts-bell-less-square', level: 'surface', area: 'verdant-wilds-courts', c: 150, r: -28 },
  { name: 'courts-temple-gate', level: 'surface', area: 'verdant-wilds-courts', c: 228, r: -30 },
];

async function open(page: Page, graphics: 'iso' | 'classic', query = '/play?td=1&hour=12'): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1', 'eclipse-td-graphics': graphics, 'preferred-language': 'en', ...purse(1000) });
  await page.goto(query);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  // The tutorial panel (the prologue's goal list) is dismissed: these are photographs of the land, not of the HUD.
  await page.addStyleTag({ content: '.lvl-banner, .glim-say, .area-card, .guide { visibility: hidden !important; }' });
  // A level-1 Keeper in a level-20 zone would not live to the next photograph: the fight is held still for the camera.
  await page.evaluate(() => (window as unknown as { __tdArt: { freeze: (on: boolean) => void } }).__tdArt.freeze(true));
}
const visit = (page: Page, s: Spot) => page.evaluate(v => (window as unknown as { __tdArt: { visit: (l: string, c: number, r: number, k: string) => boolean } }).__tdArt.visit(v.level, v.c, v.r, v.area), s);
type W = { c: number; r: number; ready: boolean };
const tree = (page: Page) => page.evaluate(() => (window as unknown as { __tdReach: { walker: () => W } }).__tdReach.walker());

const VIEWS = [{ g: 'iso', w: 1280, h: 800, tag: 'iso' }, { g: 'classic', w: 1280, h: 800, tag: 'classic' }, { g: 'iso', w: 390, h: 844, tag: 'phone' }] as const;
for (const view of VIEWS) {
  test(`the Wilds' new areas, ${view.tag}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: view.w, height: view.h });
    await open(page, view.g);
    for (const s of SPOTS) {
      expect(await visit(page, s), s.name).toBe(true);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${OUT}/${s.name}-${view.tag}.jpg`, type: 'jpeg', quality: 78 });
    }
  });

  test(`the Walking Tree at night, Glim dimmed beside it; the Deep Wilds in Spore drift, ${view.tag}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: view.w, height: view.h });
    await open(page, view.g, '/play?td=1&hour=23');
    await page.waitForFunction(() => !!(window as unknown as { __tdS8?: unknown }).__tdS8);
    await visit(page, { name: 'glade', level: 'surface', area: 'verdant-wilds-greenwood', c: 60, r: -56 });
    await page.evaluate(() => (window as unknown as { __tdS8: { night: (id: string) => boolean } }).__tdS8.night('walking-tree'));
    for (let i = 0; i < 3; i++) {
      const was = await tree(page);
      await visit(page, { name: 'look', level: 'surface', area: 'verdant-wilds-greenwood', c: was.c + 3, r: was.r + 3 });
      await page.waitForTimeout(1000);
      await visit(page, { name: 'away', level: 'surface', area: 'verdant-wilds-greenwood', c: 20, r: -30 });
      await expect.poll(async () => { const t = await tree(page); return t.c !== was.c || t.r !== was.r; }, { timeout: 6000 }).toBe(true);
    }
    const at = await tree(page);
    await visit(page, { name: 'walker', level: 'surface', area: 'verdant-wilds-greenwood', c: at.c + 4, r: at.r + 3 });
    await expect.poll(async () => (await tree(page)).ready, { timeout: 6000 }).toBe(true);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/walking-tree-glim-${view.tag}.jpg`, type: 'jpeg', quality: 80 });
    await page.goto('/play?td=1&hour=15&weather=spores');
    await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
    await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt);
    await page.addStyleTag({ content: '.lvl-banner, .glim-say, .area-card, .guide { visibility: hidden !important; }' });
    await page.evaluate(() => (window as unknown as { __tdArt: { freeze: (on: boolean) => void } }).__tdArt.freeze(true));
    await visit(page, { name: 'spores', level: 'surface', area: 'verdant-wilds-deep-wilds', c: 40, r: -32 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/deep-wilds-spores-${view.tag}.jpg`, type: 'jpeg', quality: 80 });
  });
}

test('the Wilds\' Atlas on a small phone (360×640)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, 'iso');
  await visit(page, { name: 'net', level: 'surface', area: 'verdant-wilds-shore', c: 8, r: 5 });
  await page.waitForTimeout(600);
  await canvas(page).focus();
  await page.keyboard.press('e');
  await expect(page.locator('.td-atlas')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/atlas-phone-360.jpg`, type: 'jpeg', quality: 80 });
});
