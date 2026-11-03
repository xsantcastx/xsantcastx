/**
 * td-reach-shots.spec.ts — photographs of S7's new areas (the Reach as an act) for the Director's review: each in
 * Isometric (the default) and Classic at 1280×800, and Isometric on a phone (390×844), plus the Waystones' Atlas on a
 * small phone. Written to output/s7reach/ (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { purse, seed } from './play-helpers';

const OUT = 'output/s7reach';
const canvas = (page: Page) => page.locator('canvas').first();
const SPOTS: readonly { name: string; level: string; area: string; c: number; r: number }[] = [
  { name: 'pyrehold-north-gate', level: 'surface', area: 'infernal-reach-pyrehold', c: 23, r: -9 },
  { name: 'steppe-watch-cairn', level: 'surface', area: 'infernal-reach-steppe', c: 8, r: 9 },
  { name: 'steppe-south-gate', level: 'surface', area: 'infernal-reach-steppe', c: 52, r: 72 },
  { name: 'charwood-kiln-mouth', level: 'surface', area: 'infernal-reach-charwood', c: -74, r: -76 },
  { name: 'kiln-tunnels', level: 'kiln-tunnels-1', area: 'infernal-reach-charwood', c: 32, r: 7 },
  { name: 'deep-charwood-kettle-camp', level: 'surface', area: 'infernal-reach-deep-charwood', c: 100, r: -34 },
  { name: 'badlands-scorch-rings', level: 'surface', area: 'infernal-reach-badlands', c: 164, r: 62 },
  { name: 'glass-throat-mirror-hall', level: 'glass-throat-2', area: 'infernal-reach-badlands', c: 24, r: 9 },
  { name: 'molten-fields-drake-stone', level: 'surface', area: 'infernal-reach-molten-fields', c: 8, r: 9 },
  { name: 'pyre-peaks-ring-of-pyres', level: 'surface', area: 'infernal-reach-pyre-peaks', c: 36, r: 28 },
  { name: 'cinderport', level: 'surface', area: 'infernal-reach-cinderport', c: 14, r: 7 },
];

async function open(page: Page, graphics: 'iso' | 'classic'): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1', 'eclipse-td-graphics': graphics, 'preferred-language': 'en', ...purse(1000) });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  // The tutorial panel (the prologue's goal list) is dismissed: these are photographs of the land, not of the HUD.
  await page.addStyleTag({ content: '.lvl-banner, .glim-say, .area-card, .guide { visibility: hidden !important; }' });
  // A level-1 Keeper in a level-20 zone would not live to the next photograph: the fight is held still for the camera.
  await page.evaluate(() => (window as unknown as { __tdArt: { freeze: (on: boolean) => void } }).__tdArt.freeze(true));
}
const visit = (page: Page, s: typeof SPOTS[number]) => page.evaluate(v => (window as unknown as { __tdArt: { visit: (l: string, c: number, r: number, k: string) => boolean } }).__tdArt.visit(v.level, v.c, v.r, v.area), s);

for (const view of [{ g: 'iso', w: 1280, h: 800, tag: 'iso' }, { g: 'classic', w: 1280, h: 800, tag: 'classic' }, { g: 'iso', w: 390, h: 844, tag: 'phone' }] as const) {
  test(`the Reach's new areas, ${view.tag}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: view.w, height: view.h });
    await open(page, view.g);
    for (const s of SPOTS) {
      expect(await visit(page, s), s.name).toBe(true);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${OUT}/${s.name}-${view.tag}.jpg`, type: 'jpeg', quality: 78 });
    }
  });
}

test('the Waystones\' Atlas on a small phone (360×640)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, 'iso');
  await visit(page, { name: 'cairn', level: 'surface', area: 'infernal-reach-steppe', c: 8, r: 5 });
  await page.waitForTimeout(600);
  await canvas(page).focus();
  await page.keyboard.press('e');
  await expect(page.locator('.td-atlas')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/atlas-phone-360.jpg`, type: 'jpeg', quality: 80 });
});
