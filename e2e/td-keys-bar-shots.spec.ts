/**
 * td-keys-bar-shots.spec.ts — the bottom HUD bar (play/hud-bar): the life and mana orbs, the XP strip, the small menu
 * buttons, eight skill slots and the potion belt in one panel. Screenshots land in docs/handoff/cozy-ui/keys-bar-*.jpg
 * (SHOT=before|after picks the file name). Also the Menu with its keycaps and the Controls list (keys-*.jpg).
 */
import { expect, test } from '@playwright/test';
import { focusWorld, seed } from './play-helpers';

const SHOT = process.env['SHOT'] ?? 'after';

for (const [w, h] of [[1280, 800], [1920, 1080]] as const) {
  test(`the HUD at ${w}×${h} (${SHOT})`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: w, height: h });
    await seed(page, { 'eclipse-td': '1' });
    await page.goto('/play?td=1&hour=12');
    await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `docs/handoff/cozy-ui/keys-bar-${SHOT}-${w}.jpg`, type: 'jpeg', quality: 88 });
    if (SHOT !== 'after') return;
    await focusWorld(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#game-menu')).toBeVisible();
    await page.screenshot({ path: `docs/handoff/cozy-ui/keys-menu-${w}.jpg`, type: 'jpeg', quality: 88 });
    await page.locator('#game-menu [data-open="controls"]').click();
    await expect(page.locator('[data-controls]')).toBeVisible();
    await page.screenshot({ path: `docs/handoff/cozy-ui/keys-controls-${w}.jpg`, type: 'jpeg', quality: 88 });
  });
}
