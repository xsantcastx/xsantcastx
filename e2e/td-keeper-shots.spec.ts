/**
 * td-keeper-shots.spec.ts — the Keeper close up after the shading pass (docs/design/ui-pass-top-heroes.md,
 * "Characters"): light from the top-left, shade on the right, the hood's depth, the staff's bands. The screenshot is
 * a zoomed crop round the Keeper (docs/handoff/cozy-ui/keeper-closeup.jpg).
 */
import { expect, test } from '@playwright/test';
import { seed } from './play-helpers';

test('the Keeper close up: a shaded, hooded Warlock with the staff', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  const c = page.locator('canvas').first();
  await expect(c).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/keeper-closeup.jpg', type: 'jpeg', quality: 90, clip: { x: 560, y: 300, width: 160, height: 200 } });
  await expect(page.locator('.hearth-pill')).toHaveCount(0);
});
