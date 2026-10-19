/**
 * play-top-down.spec.ts — the top-down Seamworks square (docs/design/top-down.md, Phase 1),
 * behind the `?td=1` gate: the Keeper walks 8 ways, keepers stand at their stalls, E opens
 * the stall in reach through the same panels the side view used, and the side view's arrow
 * and jump buttons give way to the drag joystick.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const px = async (page: Page) => Number(await canvas(page).getAttribute('data-player-x'));
const py = async (page: Page) => Number(await canvas(page).getAttribute('data-player-y'));

async function openTopDown(page: Page): Promise<void> {
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  // The top-down engine reports a position inside the square (the side view starts on its floor at y 610).
  await expect.poll(() => py(page), { timeout: 20000 }).toBeLessThan(560);
}

for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`top-down square at ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test('the Keeper walks with the keys, both axes', async ({ page }) => {
      await openTopDown(page);
      const x0 = await px(page), y0 = await py(page);
      await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(700); await page.keyboard.up('ArrowLeft');
      await expect.poll(() => px(page)).toBeLessThan(x0 - 10);
      await page.keyboard.down('ArrowDown'); await page.waitForTimeout(500); await page.keyboard.up('ArrowDown');
      await expect.poll(() => py(page)).toBeGreaterThan(y0 + 5);
    });

    test('E opens the stall in reach (the Material Vendor) through its usual panel', async ({ page }) => {
      await openTopDown(page);
      await page.keyboard.press('e');
      await expect(page).toHaveURL(/[?&]at=vendor/, { timeout: 10000 });
    });

    test('the side view\'s arrow and jump buttons are not shown', async ({ page }) => {
      await openTopDown(page);
      await expect(page.locator('.tb--left')).toHaveCount(0);
      await expect(page.locator('.tb--jump')).toHaveCount(0);
    });
  });
}

test('without the gate the side view is unchanged', async ({ page }) => {
  await seed(page, {});
  await page.goto('/play?td=0');
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
  await expect(page.locator('.tb--jump')).toHaveCount(1);
});
