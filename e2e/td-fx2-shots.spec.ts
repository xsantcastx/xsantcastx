/**
 * td-fx2-shots.spec.ts — the effects spec's third and fourth passes (docs/design/effects-spec.md): loot on the ground
 * by rarity, and a boss's tell before its breath. Screenshots land in docs/handoff/cozy-ui/fx-loot-*.jpg and
 * fx-tell-*.jpg. Nothing here asserts on a fight's outcome.
 *
 * The loot is the engine's screenshot showcase (`?fxloot=1`, honoured only under an automated browser): one drop of
 * every rung round the Keeper, a second after each arrival, drawn and never pickable.
 */
import { expect, test, type Page } from '@playwright/test';
import { purse, sail, seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();

/** A box round the Keeper (the camera holds him at the canvas's middle, 20 art px above his feet). */
async function around(page: Page, w: number, h: number, dy = 20): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2 + dy;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h };
}

/** Travel by the Places list (reduced motion: instant), as play-top-down.spec.ts does. */
async function go(page: Page, place: RegExp, area: RegExp): Promise<void> {
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button', { hasText: place }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
}

async function open(page: Page, query: string): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1', ...purse(100_000) });
  await page.goto(`/play?td=1&${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}

/** No aura running, so the ground reads on its own. */
async function auraOff(page: Page): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('k');
  const on = page.locator('.spellbook .sb__aura[aria-pressed="true"]');
  if (await on.count()) await on.first().click();
  await page.locator('.spellbook .win-x').click();
  await expect(page.locator('.spellbook')).toHaveCount(0);
  await canvas(page).focus();
}

test('loot on the ground: every rung of the ladder, by day in town and on a dark floor', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, 'hour=12&fxloot=1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await auraOff(page);
  // The floor's title card fades after a few seconds.
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/fx-loot-day.jpg', type: 'jpeg', quality: 85, clip: await around(page, 760, 620, 130) });
  // A dark floor: the Ashen Crypt's first (no creatures by its stair).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sail(page, /pyrehold/i, /pyrehold/i);
  await go(page, /the ashen crypt/i, /ossuary/i);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Each drop lands a second after the arrival, popping in its colour.
  // Caught on the frame it starts (polled per animation frame: the pop lives 0.4 s).
  await page.waitForFunction(() => document.querySelector('canvas')?.getAttribute('data-loot-pop') === 'pop', undefined, { polling: 'raf', timeout: 5000 });
  await page.waitForTimeout(60);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/fx-loot-pop.jpg', type: 'jpeg', quality: 85, clip: await around(page, 760, 620, 130) });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/fx-loot-dark.jpg', type: 'jpeg', quality: 85, clip: await around(page, 760, 620, 130) });
  await page.screenshot({ path: 'docs/handoff/cozy-ui/fx-loot-close.jpg', type: 'jpeg', quality: 90, clip: await around(page, 520, 300, 290) });
});

test('a boss\'s tell: the Ashbone Dragon winds up before its breath', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, 'hour=12');
  await sail(page, /pyrehold/i, /pyrehold/i);
  await go(page, /the ashen crypt/i, /ossuary/i);
  await go(page, /stairs down/i, /bone hall/i);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await auraOff(page);
  await page.waitForTimeout(4000);
  // A few steps into the hall, until the dragon sees the Keeper and winds up (whatever follows is not asserted).
  await page.keyboard.down('s'); await page.waitForTimeout(500); await page.keyboard.up('s');
  await expect(canvas(page)).toHaveAttribute('data-boss-tell', 'breath', { timeout: 25000 });
  await page.screenshot({ path: 'docs/handoff/cozy-ui/fx-tell-early.jpg', type: 'jpeg', quality: 85, clip: await around(page, 900, 900, 220) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/fx-tell-late.jpg', type: 'jpeg', quality: 85, clip: await around(page, 900, 900, 220) });
});
