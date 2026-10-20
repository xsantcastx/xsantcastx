/**
 * td-character-shots.spec.ts — the character art pass (docs/design/ui-pass-top-heroes.md, "Characters"; the owner's
 * queue item 3): the 28×40 front/back sprites with a big head, two-tone shading, the outline and a four-frame walk.
 * Zoomed crops of the Keeper idle, walking toward the camera and away from it, the townsfolk in the square, and the
 * Satchel's doll land in docs/handoff/cozy-ui/char-*.jpg.
 */
import { expect, test } from '@playwright/test';
import { focusWorld, seed } from './play-helpers';

test.use({ deviceScaleFactor: 2 });

test('the character sprites close up: idle, walking down and up, the townsfolk, the doll', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForTimeout(900);
  // The player stands at the centre of the view (feet ~60 CSS px below it, 3 CSS px per art px).
  const box = (await canvas.boundingBox())!;
  const cx = Math.round(box.x + box.width / 2), cy = Math.round(box.y + box.height / 2);
  const keeper = { x: cx - 90, y: cy - 80, width: 180, height: 170 };
  await page.screenshot({ path: 'docs/handoff/cozy-ui/char-keeper-idle.jpg', type: 'jpeg', quality: 92, clip: keeper });

  await focusWorld(page);
  for (const [key, name] of [['ArrowDown', 'walk-down'], ['ArrowUp', 'walk-up']] as const) {
    await page.keyboard.down(key);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `docs/handoff/cozy-ui/char-keeper-${name}.jpg`, type: 'jpeg', quality: 92, clip: keeper });
    await page.keyboard.up(key);
    await page.waitForTimeout(150);
  }
  const y = Number(await canvas.getAttribute('data-player-y'));
  expect(Number.isFinite(y)).toBe(true);

  // Up into the square, with whoever is about.
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1600);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/char-townsfolk.jpg', type: 'jpeg', quality: 90, clip: { x: cx - 320, y: cy - 200, width: 640, height: 400 } });

  // The Satchel's doll: the same front sprite, ×4, whole pixels.
  await page.keyboard.press('i');
  const doll = page.locator('.doll-figure img');
  await expect(doll).toBeVisible({ timeout: 10000 });
  await doll.screenshot({ path: 'docs/handoff/cozy-ui/char-doll.jpg', type: 'jpeg', quality: 92 });
});
