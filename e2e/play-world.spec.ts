/**
 * play-world.spec.ts — travel the five realm towns the way a player does, and
 * check the `?at=` deep links: the right panel opens, Escape closes it, and
 * keyboard focus is back on the game canvas.
 *
 * One World (the P2 flip): every Waystone opens the Travel map. The Seamworks'
 * town stone is Sera's trunk line: the four other realms' towns (their scenes
 * as they are until P3) are rows on it, and each of their stones lists the
 * Seamworks stone to come home by.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, openPlay, placePanel, seed, walkTo } from './play-helpers';

/** Each other built town: its world (the Travel map row `<world>:town`), its Waystone x, its name (the canvas data-area). */
const TOWNS = [
  { world: 'prism', name: 'Heliograph Court', waystone: 1620 },
  { world: 'ink', name: 'Nocturne Archive', waystone: 360 },
  { world: 'orrery', name: 'Meridian Orrery', waystone: 1220 },
  { world: 'root', name: 'Rootglass Canopy', waystone: 380 },
] as const;

async function focusIsCanvas(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement?.tagName === 'CANVAS');
}

async function closeWithEscape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(placePanel(page)).toBeHidden();
  await expect.poll(() => focusIsCanvas(page), { message: 'focus did not return to the canvas' }).toBe(true);
}

/** On the open Travel map: pick a row and travel (the channel, then the step). */
async function travel(page: Page, row: string): Promise<void> {
  await page.locator(`[data-row="${row}"]`).click();
  await page.locator('[data-act="travel"]').click();
  await expect(placePanel(page)).toBeHidden({ timeout: 10000 });
}

test.describe('Waystone travel and ?at= deep links', () => {
  test('from the Seamworks stone to every other town, each town\'s stone, and home again', async ({ page }) => {
    test.setTimeout(240000);
    await seed(page, { 'preferred-language': 'en' });
    for (const town of TOWNS) {
      await openPlay(page, '?at=waystone');
      await expect(placePanel(page)).toBeVisible();
      await expect(page.locator('#place-title')).toHaveText('Travel');
      await expect(page).toHaveURL(/[?&]at=waystone/);
      await travel(page, `${town.world}:town`);
      await expect(canvas(page)).toHaveAttribute('data-area', town.name);
      await expect(page.locator('#game-title')).toHaveText(town.name);
      await expect.poll(() => focusIsCanvas(page)).toBe(true);
      // That town's own Waystone, walked to with the keyboard: the same Travel map, the Seamworks stone on it.
      await walkTo(page, town.waystone, 40);
      await expect(page.locator('.prompt')).toContainText(/Waystone/i);
      await page.keyboard.press('e');
      await expect(page.locator('#place-title')).toHaveText('Travel');
      await travel(page, 'ember:town');
      await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
      await expect(canvas(page)).toHaveAttribute('data-world', 'ember');
    }
  });

  test('?at=waystone opens the town stone\'s Travel map; Escape closes it and focus returns to the canvas', async ({ page }) => {
    await seed(page, { 'preferred-language': 'en' });
    await openPlay(page, '?at=waystone');
    await expect(placePanel(page)).toBeVisible();
    await expect(page.locator('#place-title')).toHaveText('Travel');
    await expect(page.locator('[data-row="ember:town"]')).toContainText('You are here');
    await closeWithEscape(page);
    await expect(page).not.toHaveURL(/[?&]at=/);
  });

  for (const at of [
    { id: 'crafting', title: 'Crafting Bench' },
    { id: 'enchanting', title: 'Enchanting Table' },
    { id: 'runes', title: 'Rune Forge' },
    { id: 'vendor', title: 'Material Vendor' },
  ]) {
    test(`?at=${at.id} opens ${at.title} in the Infernal town`, async ({ page }) => {
      await seed(page);
      await openPlay(page, `?at=${at.id}`);
      await expect(placePanel(page)).toBeVisible();
      await expect(page.locator('#place-title')).toHaveText(at.title);
      await expect(page.locator('section.place .place-body')).not.toContainText('could not be reached');
      await closeWithEscape(page);
    });
  }

  // Was playtest-findings.md P-2: the town the Keeper travelled to is now saved
  // (`eclipse-play-world-v1`) and restored on load; a `?at=` link still wins.
  test('a deep link copied in another town reopens that place after a reload', async ({ page }) => {
    await seed(page, { 'preferred-language': 'en' });
    await openPlay(page, '?at=waystone');
    await travel(page, 'ink:town');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Nocturne Archive');
    await expect.poll(() => focusIsCanvas(page)).toBe(true);
    await walkTo(page, 1235, 40);
    await page.keyboard.press('e');
    await expect(page.locator('#place-title')).toHaveText('Seam Sweeper');
    await expect(page).toHaveURL(/[?&]at=seam-sweeper/);
    // The URL now reads ?at=seam-sweeper: a player bookmarks it, or simply reloads.
    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/);
    await expect(placePanel(page)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#place-title')).toHaveText('Seam Sweeper');
  });
});
