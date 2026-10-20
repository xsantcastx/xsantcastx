/**
 * td-elite-shots.spec.ts — elite packs in the top-down world (design-bible §5.7, roadmap §10 item 3): a champion pack
 * (blue aura, blue name, framed bars) and a named unique leader with its affixes under the name and its minions.
 *
 * The packs are the engine's screenshot hook (`?fxelite=1`, honoured only under an automated browser): real MobSystem
 * packs laid either side of the Keeper, standing calm so the picture holds. Screenshots:
 * docs/handoff/cozy-ui/elite-desktop.jpg, elite-champion.jpg, elite-unique.jpg and elite-phone.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();

/** A box round the Keeper, `dx` art-screen px to one side (the camera holds him at the canvas's middle). */
async function around(page: Page, w: number, h: number, dx = 0, dy = 10): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2 + dx, cy = box.y + box.height / 2 + dy;
  const x = Math.max(box.x, Math.round(cx - w / 2)), y = Math.max(box.y, Math.round(cy - h / 2));
  return { x, y, width: Math.min(w, Math.round(box.x + box.width - x)), height: Math.min(h, Math.round(box.y + box.height - y)) };
}

async function open(page: Page, w: number, h: number): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12&fxelite=1');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  // Three champions (the leader and two copies), one unique leader and its three minions.
  await expect(canvas(page)).toHaveAttribute('data-elites', 'champion:3,unique:1,minion:3', { timeout: 15000 });
  // The goal card and the arrival title stand over the square: hide the one, wait out the other.
  await page.addStyleTag({ content: '.guide, .glim-say { visibility: hidden !important; }' });
  await page.waitForTimeout(6000);
}

test('elite packs: a blue champion pack and a gold unique with its affixes (desktop)', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 1400, 900);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/elite-desktop.jpg', type: 'jpeg', quality: 88, clip: await around(page, 1100, 460) });
  // Close-ups: the packs stand 84 art px either side of the Keeper; a canvas 1100+ CSS px wide draws 3 CSS px per art px.
  const k = 3;
  await page.screenshot({ path: 'docs/handoff/cozy-ui/elite-champion.jpg', type: 'jpeg', quality: 88, clip: await around(page, Math.round(130 * k), Math.round(110 * k), Math.round(84 * k), -Math.round(18 * k)) });
  await page.screenshot({ path: 'docs/handoff/cozy-ui/elite-unique.jpg', type: 'jpeg', quality: 88, clip: await around(page, Math.round(150 * k), Math.round(110 * k), -Math.round(84 * k), -Math.round(18 * k)) });
  // Calm: nothing has hurt the Keeper, the packs are still all there.
  await expect(canvas(page)).toHaveAttribute('data-elites', 'champion:3,unique:1,minion:3');
});

test('elite packs on a phone', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 390, 844);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/elite-phone.jpg', type: 'jpeg', quality: 88 });
});
