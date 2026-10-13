/**
 * play-world.spec.ts — travel the five realm towns through the Waystone the way
 * a player does, and check the `?at=` deep links: the right panel opens, Escape
 * closes it, and keyboard focus is back on the game canvas.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, openPlay, placePanel, seed, walkTo } from './play-helpers';

/** Each built town: its Waystone x, its name (the canvas data-area) and one panel station. */
const TOWNS = [
  { realm: 'Luminous', name: 'Heliograph Court', waystone: 1620, station: 'market', title: 'The Market' },
  { realm: 'Umbral', name: 'Nocturne Archive', waystone: 360, station: 'exchange', title: 'The Exchange' },
  { realm: 'Celestial', name: 'Meridian Orrery', waystone: 1220, station: 'codex', title: 'The Codex' },
  { realm: 'Verdant', name: 'Rootglass Canopy', waystone: 380, station: 'quests', title: 'Quest Board' },
  { realm: 'Infernal', name: 'Basalt Seamworks', waystone: 2010, station: 'crafting', title: 'Crafting Bench' },
] as const;

async function focusIsCanvas(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement?.tagName === 'CANVAS');
}

async function closeWithEscape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(placePanel(page)).toBeHidden();
  await expect.poll(() => focusIsCanvas(page), { message: 'focus did not return to the canvas' }).toBe(true);
}

test.describe('Waystone travel and ?at= deep links', () => {
  test('walk to the Waystone, travel to every built town and back', async ({ page }) => {
    test.setTimeout(240000);
    await seed(page);
    await openPlay(page);
    let here: number = TOWNS[TOWNS.length - 1].waystone;
    await walkTo(page, here, 40);
    for (const town of TOWNS) {
      await page.keyboard.press('e');
      await expect(placePanel(page)).toBeVisible();
      await expect(page.locator('#place-title')).toHaveText('The Waystone');
      await expect(page).toHaveURL(/[?&]at=waystone/);
      const road = page.locator('.waystone-road', { hasText: town.realm });
      await expect(road).toBeEnabled();
      await road.click();
      await expect(placePanel(page)).toBeHidden();
      await expect(canvas(page)).toHaveAttribute('data-area', town.name);
      await expect(page.locator('#game-title')).toHaveText(town.name);
      await expect.poll(() => focusIsCanvas(page)).toBe(true);
      // Walk to this town's own Waystone with the keyboard, ready for the next leg.
      here = town.waystone;
      await walkTo(page, here, 40);
      await expect(page.locator('.prompt')).toContainText(/Waystone/i);
    }
  });

  test('?at=waystone opens the stone; Escape closes it and focus returns to the canvas', async ({ page }) => {
    await seed(page);
    await openPlay(page, '?at=waystone');
    await expect(placePanel(page)).toBeVisible();
    await expect(page.locator('#place-title')).toHaveText('The Waystone');
    await expect(page.locator('.waystone-road.here')).toContainText('Infernal');
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
    await seed(page);
    await openPlay(page, '?at=waystone');
    await page.locator('.waystone-road', { hasText: 'Umbral' }).click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Nocturne Archive');
    // The panel folds away for 160 ms with the world still paused: wait for it, as a player would.
    await expect(placePanel(page)).toBeHidden();
    await expect.poll(() => focusIsCanvas(page)).toBe(true);
    await walkTo(page, 1560, 40);
    await page.keyboard.press('e');
    await expect(page.locator('#place-title')).toHaveText('The Exchange');
    await expect(page).toHaveURL(/[?&]at=exchange/);
    // The URL now reads ?at=exchange: a player bookmarks it, or simply reloads.
    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/);
    await expect(placePanel(page)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#place-title')).toHaveText('The Exchange');
  });
});
