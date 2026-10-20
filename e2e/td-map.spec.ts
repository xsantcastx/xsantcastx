/**
 * td-map.spec.ts — the Map replaces the Places list in the top-down game (owner 2026-10-20: "take that Places UI out,
 * create the map and pin point the stuff"): the level painted from its ground, a pin per place, the Keeper's mark, a
 * small key; a pin travels. Screenshots: docs/handoff/cozy-ui/map-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();

test('the Map: M opens it, pins and the key go places, on an island, a continent and a dungeon floor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await canvas(page).focus();
  await page.keyboard.press('m');
  const map = page.locator('#places-list.td-map');
  await expect(map).toBeVisible();
  await expect(map.locator('.td-map__view img')).toBeVisible();
  expect(await map.locator('.td-map__pin').count()).toBeGreaterThan(3);
  await expect(map.locator('.td-map__me')).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/map-ember-isle.jpg', type: 'jpeg', quality: 78 });
  // A pin itself travels (the ship to Pyrehold).
  await map.locator('.td-map__pin[title="Ship To Pyrehold"]').click();
  await expect(canvas(page)).toHaveAttribute('data-area', /pyrehold/i, { timeout: 30000 });
  await page.keyboard.press('m');
  await expect(map).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/map-infernal-reach.jpg', type: 'jpeg', quality: 78 });
  // The key travels too: into the Molten Deep, whose floor is a map of its own.
  await map.locator('.td-map__key button', { hasText: /the molten deep/i }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', /scorched throat/i, { timeout: 30000 });
  await page.keyboard.press('m');
  await expect(map).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/map-molten-deep.jpg', type: 'jpeg', quality: 78 });
  await page.keyboard.press('Escape');
  await expect(map).toHaveCount(0);
});

test('the Map on a phone: the map above, the key below, everything reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.locator('.td-dock button').last().click();
  const map = page.locator('#places-list.td-map');
  await expect(map).toBeVisible();
  await page.waitForTimeout(500);
  const box = (await map.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/map-phone.jpg', type: 'jpeg', quality: 78 });
});
