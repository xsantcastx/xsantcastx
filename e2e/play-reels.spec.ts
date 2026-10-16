/**
 * play-reels.spec.ts — the Croupier's Reels in the Nocturne Archive.
 *
 * Walk (desktop) or deep-link (phone) to the Reels, spin with a pinned seed so
 * the outcome is known, see the payout land in the purse, then reload: the
 * play is stored with its mutation id, so nothing is paid twice. A second test
 * plays a pinned Eclipse Round. Screenshots go to output/reels/ (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { blob, focusWorld, openPlay, placePanel, purse, seed, walkTo, canvas } from './play-helpers';
import { playReels } from '../src/app/shared/reels/reels.model';
import { seededRng } from '../src/app/shared/games/seeded-rng';

const SHOTS = resolve('output/reels');
/** Pinned saves: the next play's seed is `secret:0`. */
const LINE_WIN = 'e2e-reels-0';
const ROUND = 'e2e-reels-1539';
const START = 1_000;

function pinned(secret: string): Record<string, unknown> {
  return { ...purse(START), 'godforge-games': { version: 1, secret, nonce: 0, plays: {}, totals: {} } };
}

async function gold(page: Page): Promise<number> {
  return ((await blob<{ gold: number }>(page, 'godforge-economy'))?.gold) ?? -1;
}

async function plays(page: Page): Promise<number> {
  return Object.keys((await blob<{ plays: Record<string, unknown> }>(page, 'godforge-games'))?.plays ?? {}).length;
}

const reels = (page: Page) => placePanel(page).locator('app-reels');
const spin = (page: Page) => reels(page).locator('.rl-spin .ab__btn');

for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const phone = size.width < 768;
  test.describe(`the Reels at ${size.width}×${size.height}`, () => {
    test.describe.configure({ timeout: 150000 });

    test('reach the Croupier\'s Reels, spin a pinned line win, and a reload never re-pays', async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize(size);
      await seed(page, pinned(LINE_WIN));
      const expected = playReels(seededRng(`${LINE_WIN}:0`), 10);
      expect(expected.win).toBeGreaterThan(0);

      if (phone) {
        await openPlay(page, '?at=reels');
      } else {
        // Travel to Umbral by the Waystone, then walk to the Reels beside the Croupier.
        await openPlay(page, '?at=waystone');
        await page.locator('.waystone-road', { hasText: 'Umbral' }).click();
        await expect(canvas(page)).toHaveAttribute('data-area', 'Nocturne Archive');
        await expect(placePanel(page)).toBeHidden();
        await focusWorld(page);
        await walkTo(page, 975, 40);
        await page.keyboard.press('e');
      }
      await expect(placePanel(page)).toBeVisible();
      await expect(page.locator('#place-title')).toHaveText('The Reels');
      await expect(page).toHaveURL(/[?&]at=reels/);

      // One primary button with its price, and a ≥44px bet stepper.
      await expect(spin(page)).toHaveCount(1);
      await expect(spin(page)).toContainText('Spin');
      // Measured once the panel's open transition (a scale-in) has settled.
      for (const b of await reels(page).locator('.rl-bet__btn').all()) {
        await expect.poll(async () => Math.min((await b.boundingBox())!.height, (await b.boundingBox())!.width)).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: resolve(SHOTS, `reels-${size.width}-ready.png`) });

      await spin(page).click();
      await expect(reels(page).locator('.rl-result')).toContainText(`You won ${expected.win.toLocaleString('en-US')} Gold.`, { timeout: 10000 });
      await expect.poll(() => gold(page), { timeout: 10000 }).toBe(START - 10 + expected.win);
      expect(await plays(page)).toBe(1);
      // A Big Win (≥10×) raises its banner; collect it.
      if (expected.win >= 100) {
        await expect(reels(page).locator('.wc__banner')).toBeVisible();
        await page.screenshot({ path: resolve(SHOTS, `reels-${size.width}-win.png`) });
        await reels(page).locator('.wc__done').click();
      }

      // Details: the pay table and the odds, with the stated return.
      await reels(page).locator('.ss__help, app-details-drawer summary').first().click();
      await expect(reels(page).locator('.rl-pay li')).toHaveCount(6);
      await expect(reels(page).locator('.rl-proof')).toContainText('92.8%');

      // Reload: the panel reopens from ?at=reels, the purse is unchanged, one play on record.
      const after = await gold(page);
      await page.reload();
      await expect(placePanel(page)).toBeVisible({ timeout: 15000 });
      await expect(reels(page).locator('.rl-result')).toContainText('Last spin');
      await page.waitForTimeout(1000);
      expect(await gold(page)).toBe(after);
      expect(await plays(page)).toBe(1);
    });

    test('a pinned Eclipse Round: free spins, sticky orbs, paid once at the end', async ({ page }) => {
      await page.setViewportSize(size);
      await seed(page, pinned(ROUND));
      const expected = playReels(seededRng(`${ROUND}:0`), 10);
      expect(expected.bonus).not.toBeNull();

      await openPlay(page, '?at=reels');
      await expect(placePanel(page)).toBeVisible();
      await spin(page).click();
      await expect(reels(page).locator('.rl-roundline')).toBeVisible({ timeout: 10000 });
      await expect(reels(page).locator('.rl-result')).toContainText(/Free spin|Eclipse Round/);
      await page.screenshot({ path: resolve(SHOTS, `reels-${size.width}-round.png`) });
      // Skip to the settled result (the outcome was decided before the reels moved).
      await reels(page).locator('.rl-skip').click();
      await expect(reels(page).locator('.rl-result')).toContainText(`You won ${expected.win.toLocaleString('en-US')} Gold.`);
      await expect(reels(page).locator('.rl-round__mult')).toHaveText(`×${Math.max(1, expected.bonus!.orbSum)}`);
      await page.screenshot({ path: resolve(SHOTS, `reels-${size.width}-round-paid.png`) });
      await expect.poll(() => gold(page), { timeout: 10000 }).toBe(START - 10 + expected.win);
    });
  });
}
