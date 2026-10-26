/**
 * td-peer-tap.spec.ts — a tap on another Keeper standing beside an NPC is the Keeper's (owner's backlog 2026-10-21:
 * "tapping another Keeper sometimes walks you into a nearby NPC's dialogue"). A thumb is wide and Keepers glide between
 * packets, so a tap that lands a little off a Keeper used to fall through to the giver's stall box, which is much
 * bigger than a body. Now whatever lies under the finger is weighed by distance, as the stall pick already does for
 * feet: the Keeper nearest the point wins, and one the thumb only just missed still beats a giver that is farther.
 *
 * `?fxpeer=1` (honoured only under an automated browser) stands a Keeper beside the first task giver of the town.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('.viewport canvas');
type PeerHook = { lay: (name: string, dx: number) => { giver: string } | null; page: (name: string, dx: number) => { x: number; y: number } | null };
const hook = <T>(page: Page, fn: (h: PeerHook) => T) => page.evaluate(`(${fn.toString()})(window.__tdPeer)`) as Promise<T>;

async function stage(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12&fxpeer=1');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdPeer?: unknown }).__tdPeer);
  await page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
  const laid = await hook(page, h => h.lay('Wick', 14));
  expect(laid, 'a task giver stands in this town').not.toBeNull();
  // The camera follows the Keeper to the giver.
  await expect.poll(() => hook(page, h => h.page('Wick', 0)).then(p => !!p && p.x > 0 && p.x < 1280 && p.y > 0 && p.y < 800)).toBe(true);
  await page.waitForTimeout(700);
}

test('a tap just off a Keeper beside a giver opens the Keeper card, not the giver\'s talk', async ({ page }) => {
  test.setTimeout(90_000);
  await stage(page);
  // 12 art px to the right of their middle: off the body (it is 10 wide each side), nearer them than the giver.
  const at = (await hook(page, h => h.page('Wick', 12)))!;
  await page.mouse.click(at.x, at.y);
  const card = page.locator('[data-peer-card]');
  await expect(card.locator('h2')).toHaveText('Wick', { timeout: 5000 });
  await page.screenshot({ path: 'test-results/peer-tap-card.png' });
  const x1 = Number(await canvas(page).getAttribute('data-player-x'));
  // No walk to the giver and no talk: a moment later the Keeper has not moved and no dialogue is up.
  await page.waitForTimeout(1500);
  await expect(page.locator('.td-talk')).toHaveCount(0);
  expect(Math.abs(Number(await canvas(page).getAttribute('data-player-x')) - x1)).toBeLessThan(4);
});

test('a tap on the Keeper\'s own body opens the card too', async ({ page }) => {
  test.setTimeout(90_000);
  await stage(page);
  const at = (await hook(page, h => h.page('Wick', 0)))!;
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('[data-peer-card] h2')).toHaveText('Wick', { timeout: 5000 });
  await expect(page.locator('.td-talk')).toHaveCount(0);
});

test('a tap on the giver\'s own body still goes to the giver, not the Keeper beside them', async ({ page }) => {
  test.setTimeout(90_000);
  await stage(page);
  // The giver stands 14 px to the Keeper's left; the point is on their body, nearer them than the Keeper.
  const at = (await hook(page, h => h.page('Wick', -14)))!;
  const x0 = Number(await canvas(page).getAttribute('data-player-x'));
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(400);
  await expect(page.locator('[data-peer-card]')).toHaveCount(0);
  // The Keeper sets off toward the giver.
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-x')), { timeout: 8000 }).toBeGreaterThan(x0 + 6);
});

// Owner 2026-10-26: "Keepers walk through each other, Tibia-style". A second tap on a Keeper whose card is up walks
// there, and the Keeper ends up standing on the very spot the other one stands on (no collision between Keepers).
test('Keepers never block: a second tap on a Keeper walks onto their spot', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12&fxpeer=1');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdPeer?: unknown }).__tdPeer);
  await page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
  // Wick stands 40 px to the Keeper's left, clear of the giver (who is 70 px to the right).
  const laid = await page.evaluate(() => (window as unknown as { __tdPeer: { lay: (n: string, dx: number) => { gx: number; gy: number } | null } }).__tdPeer.lay('Wick', -110));
  expect(laid).not.toBeNull();
  await page.waitForTimeout(700);
  const wickX = laid!.gx - 110;
  const first = (await hook(page, h => h.page('Wick', 0)))!;
  await page.mouse.click(first.x, first.y);
  await expect(page.locator('[data-peer-card] h2')).toHaveText('Wick', { timeout: 5000 });
  const again = (await hook(page, h => h.page('Wick', 0)))!;
  await page.mouse.click(again.x, again.y);
  await expect.poll(async () => Math.abs(Number(await canvas(page).getAttribute('data-player-x')) - wickX), { timeout: 8000 }).toBeLessThan(6);
});
