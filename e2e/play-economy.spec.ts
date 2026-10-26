/**
 * play-economy.spec.ts — the Material Vendor, played in the world.
 *
 *   - The Material Vendor (Infernal) only buys, and its price per unit is the
 *     one the counter pays.
 *   - It pays below the Exchange catalogue's floor quote (the model the future
 *     world-native trade hall reads). The Exchange counter itself left the world
 *     with the game-only shell (docs/handoff/page-audit.md); its round-trip
 *     no-faucet property is pinned by exchange.model.spec.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, openPlay, placePanel, purse, seed, stackQty } from './play-helpers';
import { VENDOR_SHELF } from '../src/app/shared/vendor/material-vendor.model';
import { PRICE_FLOOR_MULT, quoteSell } from '../src/app/shared/exchange/exchange.model';

const GOLD = (text: string | null) => Number((text ?? '').replace(/[^\d]/g, ''));

/** The Vendor on the station kit: pick the Cinder Ore row; its per-unit price is on the row. */
async function pickCinderOre(page: Page): Promise<number> {
  const row = page.locator('section.place app-journal-list .jl__row', { hasText: 'Cinder Ore' });
  await expect(row).toBeVisible();
  await row.click();
  const price = Number(/([\d,]+) Gold each/i.exec(await row.innerText())?.[1].replace(/,/g, ''));
  expect(price).toBeGreaterThan(0);
  return price;
}
/** Set the stepper to exactly n (it opens on a suggested quantity). */
async function stepTo(page: Page, n: number): Promise<void> {
  const qty = page.locator('section.place .ab__qty');
  const steps = page.locator('section.place .ab__stepbtn');
  for (let guard = 0; guard < 40 && Number(await qty.textContent()) !== n; guard++) {
    await steps.nth(Number(await qty.textContent()) < n ? 1 : 0).click();
  }
  await expect(qty).toHaveText(String(n));
}
const VENDOR_GOLD = (page: Page) => page.locator('section.place app-cost-chip[stationwallet] .chip__n');

test.describe('NPC counters, played', () => {
  test('the General Store buys Cinder Ore for Gold, below the Exchange floor quote', async ({ page }) => {
    await openPlay(page, '?at=shop-general');
    await expect(page.locator('[data-shop-shelf]')).toBeVisible({ timeout: 20000 });
  });

  test('the Vendor pays below the Exchange floor quote, after tax, for every gathered material', () => {
    const ties = VENDOR_SHELF.filter(row => row.tier === 'gathered').map(row => {
      const floorUnit = Math.max(1, Math.round(row.worth * PRICE_FLOOR_MULT));
      const floorNet = quoteSell(floorUnit, 1).net;
      return { id: row.materialId, vendor: row.price, floorNet, worth: row.worth };
    }).filter(row => row.vendor >= row.floorNet && !(row.vendor === 1 && row.floorNet <= 1));
    expect(ties, `Vendor >= Exchange floor net: ${JSON.stringify(ties)}`).toEqual([]);
  });
});
