/**
 * td-hud-shots.spec.ts — the top-down HUD after the Top Heroes reference (docs/design/ui-pass-top-heroes.md): the
 * Keeper's portrait with the level badge, life and mana beside it, and the resource strip. Screenshots land in
 * docs/handoff/cozy-ui/hud-*.jpg.
 */
import { expect, test } from '@playwright/test';
import { seed } from './play-helpers';

for (const size of [{ width: 1280, height: 800, name: 'desktop' }, { width: 390, height: 844, name: 'phone' }]) {
  test(`the HUD at ${size.name}: portrait, level badge, bars, resource strip`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await seed(page, { 'eclipse-td': '1' });
    await page.goto('/play?td=1&hour=12');
    await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    // The portrait is desktop's for now; phones keep their compact HUD until the goal list moves (step 2).
    if (size.name === 'desktop') {
      await expect(page.locator('.hero-face img')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.hero-lv')).toHaveText(/\d+/);
      await expect(page.locator('.satchel .coin-count')).toBeVisible();
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: `docs/handoff/cozy-ui/hud-${size.name}.jpg`, type: 'jpeg', quality: 78 });
  });
}
