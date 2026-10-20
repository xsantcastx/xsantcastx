/**
 * td-gold-drop.spec.ts — Gold from the hunt (owner 2026-10-21: "monsters drop more gold like in d2"): Gold piles lie on
 * the ground in pixel art (a few coins, a pile, a heap, each with its "N Gold" plate); walking up, the Keeper's pull
 * takes them in, each floats "+N Gold", and the purse grows by exactly their sum. The piles are the engine's screenshot
 * hook (`?fxgold=1`, honoured only under an automated browser) — real drops, picked up through the real loot path.
 * Screenshots: docs/handoff/cozy-ui/gold-drop.jpg (on the ground) and gold-drop-pickup.jpg (taken in).
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const savedGold = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-economy') || '{}');
  const ledger = raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
  return Number(ledger?.gold ?? 0);
});

/** A wide strip from the Keeper eastward, where the piles lie. */
async function eastClip(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2 + 20;
  const x = Math.max(box.x, Math.round(cx - 160)), y = Math.max(box.y, Math.round(cy - 200));
  return { x, y, width: Math.min(900, Math.round(box.x + box.width - x)), height: 400 };
}

test('Gold piles on the ground, walked over: +N Gold each, into the purse', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12&fxgold=1');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await expect(canvas(page)).toHaveAttribute('data-gold-piles', '3', { timeout: 10000 });
  // The goal card stands over the strip east of the Keeper: hide it for the pictures.
  await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
  await page.waitForTimeout(2500);
  const before = await savedGold(page);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/gold-drop.jpg', type: 'jpeg', quality: 88, clip: await eastClip(page) });

  // Walk east into them: the pull takes them in, one "+N Gold" each.
  await canvas(page).focus();
  await page.keyboard.down('ArrowRight');
  await expect(canvas(page)).not.toHaveAttribute('data-gold-piles', '3', { timeout: 15000 });
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: 'docs/handoff/cozy-ui/gold-drop-pickup.jpg', type: 'jpeg', quality: 88, clip: await eastClip(page) });
  await page.keyboard.down('ArrowRight');
  await expect(canvas(page)).toHaveAttribute('data-gold-piles', '0', { timeout: 15000 });
  await page.keyboard.up('ArrowRight');

  // The same wallet the rest of the game uses: exactly the three piles' sum.
  await expect.poll(() => savedGold(page), { timeout: 10000 }).toBe(before + 12 + 64 + 640);
});
