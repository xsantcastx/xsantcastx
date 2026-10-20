/**
 * td-bestiary.spec.ts — the Bestiary window in the top-down game: opened from the Map's menu row, a card per creature,
 * "Discovered N of M", the undefeated as dark silhouettes with "???", the defeated with a name and a count.
 * Screenshots: docs/handoff/cozy-ui/bestiary*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const KILLS = { version: 1, kills: { 'ash-wolf': 12, 'rivet-maw': 3 } };

async function open(page: Page): Promise<void> {
  await seed(page, { 'eclipse-td': '1', 'eclipse-bestiary-v1': KILLS });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}

test('the Bestiary: Map menu opens it; known cards show name and count, the rest are silhouettes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await canvas(page).focus();
  await page.keyboard.press('m');
  await expect(page.locator('#places-list.td-map')).toBeVisible();
  await page.locator('.td-map__menu [data-open="bestiary"]').click();
  const best = page.locator('.td-best');
  await expect(best).toBeVisible();
  const total = await best.locator('.td-best__card').count();
  expect(total).toBeGreaterThanOrEqual(16);
  await expect(best.locator('[data-best="summary"]')).toHaveText(`Discovered 2 of ${total}`);
  const wolf = best.locator('[data-creature="ash-wolf"]');
  await expect(wolf.locator('h3')).toHaveText('Ash Wolf');
  await expect(wolf).toContainText('Defeated 12');
  await expect(wolf).toContainText('The Emberwood, Ember Isle');
  const dragon = best.locator('[data-creature="bone-dragon"]');
  await expect(dragon.locator('h3')).toHaveText('???');
  await expect(dragon).toContainText('Lv 25');
  await expect(dragon).toContainText('The Ashen Crypt');
  await expect(dragon).not.toContainText('Ashbone');
  expect(await best.locator('.td-best__card[data-known="false"]').count()).toBe(total - 2);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/bestiary.jpg', type: 'jpeg', quality: 78 });
  await page.keyboard.press('Escape');
  await expect(best).toHaveCount(0);
  // B opens it from the world, and B again folds it.
  await canvas(page).focus();
  await page.keyboard.press('b');
  await expect(best).toBeVisible();
  await page.keyboard.press('b');
  await expect(best).toHaveCount(0);
  await canvas(page).focus();
  await page.keyboard.press('b');
  await best.locator('.places-close').click();
  await expect(best).toHaveCount(0);
});

test('the Bestiary on a phone: two columns, scrolls inside, nothing wider than the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.locator('.td-dock button').last().click();
  await page.locator('.td-map__menu [data-open="bestiary"]').click();
  const best = page.locator('.td-best');
  await expect(best).toBeVisible();
  await page.waitForTimeout(400);
  const box = (await best.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/bestiary-phone.jpg', type: 'jpeg', quality: 78 });
  const cols = await best.locator('.td-best__grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(2);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/bestiary-phone.jpg', type: 'jpeg', quality: 78 });
});
