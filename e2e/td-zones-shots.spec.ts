/**
 * td-zones-shots.spec.ts — D2's fixed zone levels on screen (owner 2026-10-21: "each zone should have a level of
 * difficulty"): the area card's band, the berry "Dangerous for your level" tint, the Map's zone list, and creature
 * name plates coloured by the level gap. Screenshots: docs/handoff/cozy-ui/zones-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
type Zones = { to(c: number, r: number): boolean; foe(type: string, level: number, dx?: number, dy?: number): number | null; zone(): { id: string; band: [number, number]; safe: boolean } | null };
const zones = (page: Page, fn: (z: Zones) => unknown) => page.evaluate(f => new Function('z', `return (${f})(z)`)((window as unknown as { __tdZones: Zones }).__tdZones), fn.toString());

test('zones: the area card shows the zone\'s fixed band, berry and warned where it is well above the Keeper', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown }).__tdZones);

  // Name plates by the gap (Tibia), held still on the square: even, +3 yellow, +6 orange, +10 red with a skull.
  await page.waitForTimeout(4000);
  await zones(page, z => { z.foe('ash-wolf', 1, -60, 30); z.foe('cinder-imp', 4, -20, 40); z.foe('cinder-bailiff', 7, 20, 40); z.foe('bone-walker', 11, 60, 30); return true; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/zones-gap-plates.jpg', type: 'jpeg', quality: 80, clip: { x: 340, y: 300, width: 600, height: 260 } });

  // The Emberwood (2–4): a fresh Keeper's own ground — the band, no warning.
  await zones(page, z => z.to(60, 60));
  await expect.poll(() => zones(page, z => z.zone()?.id)).toBe('ember-isle:f');
  const card = page.locator('.area-card');
  await expect(card).toHaveAttribute('data-zone-lv', 'Lv 2–4', { timeout: 10000 });
  await expect(card.locator('.area-card__danger')).toHaveCount(0);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/zones-plate.jpg', type: 'jpeg', quality: 80 });

  // The Ashfields (7–10), six levels over a level-1 Keeper: the berry card and its warning.
  await zones(page, z => z.to(104, 44));
  await expect.poll(() => zones(page, z => z.zone()?.id)).toBe('ember-isle:v');
  await expect(card).toHaveAttribute('data-zone-lv', 'Lv 7–10', { timeout: 10000 });
  await expect(card).toHaveClass(/area-card--danger/);
  await expect(card.locator('.area-card__danger')).toHaveText('Dangerous for your level');
  await page.screenshot({ path: 'docs/handoff/cozy-ui/zones-danger.jpg', type: 'jpeg', quality: 80 });

  // The Map: the continent's zones by band, the Ashfields and the Hushed Barrow in berry for a level-1 Keeper.
  await canvas(page).focus();
  await page.keyboard.press('m');
  const map = page.locator('#places-list.td-map');
  await expect(map).toBeVisible();
  const list = map.locator('[data-zone-list] li');
  expect(await list.count()).toBeGreaterThan(3);
  await expect(map.locator('[data-zone="ember-isle:v"]')).toHaveClass(/td-map__zone--danger/);
  await expect(map.locator('[data-zone="ember-isle:f"] .td-map__lv')).toHaveText('Lv 2–4');
  await expect(map.locator('.td-map__key button', { hasText: /slagstone cave/i }).locator('.td-map__lv')).toHaveText('Lv 3–5');
  await map.locator('[data-zone-list]').evaluate(el => el.scrollIntoView({ block: 'end' }));
  await page.screenshot({ path: 'docs/handoff/cozy-ui/zones-map.jpg', type: 'jpeg', quality: 80 });
});
