/**
 * play-economy.spec.ts — the two NPC trade counters, played in the world.
 *
 *   - The Material Vendor (Infernal) only buys, and pays below what the
 *     Exchange (Umbral) pays for the same material.
 *   - The Exchange is not a faucet: buying N and selling the same N straight
 *     back never ends with more Gold than it started with.
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, canvas, focusWorld, openPlay, placePanel, purse, seed, stackQty, walkTo } from './play-helpers';
import { VENDOR_SHELF } from '../src/app/shared/vendor/material-vendor.model';
import { PRICE_FLOOR_MULT, quoteSell } from '../src/app/shared/exchange/exchange.model';

const GOLD = (text: string | null) => Number((text ?? '').replace(/[^\d]/g, ''));

/** Gold as saved. The ledger writes behind a throttle, so let it settle first. */
async function savedGold(page: Page): Promise<number> {
  await page.waitForTimeout(6000);
  return page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold));
}

async function travelToExchange(page: Page): Promise<void> {
  await openPlay(page, '?at=waystone');
  await page.locator('.waystone-road', { hasText: 'Umbral' }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Nocturne Archive');
  await expect(placePanel(page)).toBeHidden();
  await focusWorld(page);
  await walkTo(page, 1140, 40);
  await page.keyboard.press('e');
  await expect(page.locator('#place-title')).toHaveText('The Exchange');
  await expect(page.locator('app-station-shell.ge.ge--hydrated')).toBeVisible({ timeout: 15000 });
}

async function exchangeSide(page: Page, side: 'Buy' | 'Sell'): Promise<void> {
  await page.locator('section.place app-station-tabs').getByRole('button', { name: new RegExp(`^${side}`) }).first().click();
}

async function pickRow(page: Page, name: string): Promise<void> {
  await page.locator('section.place app-journal-list .jl__row', { hasText: name }).first().click();
  await expect(page.locator('section.place .gej-detail app-detail-head')).toContainText(name);
}

async function receipt(page: Page): Promise<number> {
  return GOLD(await page.locator('section.place .gej-receipt strong').first().textContent());
}

async function setQty(page: Page, n: number): Promise<void> {
  const more = page.locator('section.place .ge__confirm .ab__stepbtn').nth(1);
  for (let i = 1; i < n; i++) await more.click();
}

test.describe('NPC counters, played', () => {
  test('Material Vendor buys Cinder Ore for Gold, below what the Exchange pays', async ({ page }) => {
    test.setTimeout(120000);
    await seed(page, { ...bag({ 'cinder-ore': 20 }), ...purse(10_000) });
    await openPlay(page, '?at=vendor');
    await expect(page.locator('#place-title')).toHaveText('Material Vendor');
    const card = page.locator('section.place .mv-card[data-material="cinder-ore"]');
    await expect(card).toBeVisible();
    await card.click();
    const label = (await card.getAttribute('aria-label')) ?? '';
    const vendorPrice = Number(/pays ([\d,]+) Gold each/.exec(label)?.[1].replace(/,/g, ''));
    expect(vendorPrice).toBeGreaterThan(0);
    // The Vendor sells nothing: no Buy anywhere on its counter.
    await expect(page.locator('section.place').getByRole('button', { name: /^Buy\b/ })).toHaveCount(0);
    const before = GOLD(await page.locator('section.place .mv-purse__gold').textContent());
    // The counter opens on a suggested quantity; type the one we want.
    const qty = page.locator('#mv-qty-input');
    await qty.fill('5');
    await qty.press('Enter');
    const sellButton = page.locator('section.place .mv-buy__btn');
    await expect(sellButton).toContainText(`Sell 5 Cinder Ore · ${5 * vendorPrice} Gold`);
    await sellButton.click();
    await expect.poll(async () => GOLD(await page.locator('section.place .mv-purse__gold').textContent()))
      .toBeGreaterThanOrEqual(before + 5 * vendorPrice);
    await expect.poll(() => stackQty(page, 'cinder-ore')).toBe(15);
    await page.keyboard.press('Escape');
    await expect(placePanel(page)).toBeHidden();

    // Now carry the rest to the Exchange and ask what it would pay for one.
    await page.waitForTimeout(1500);
    await travelToExchange(page);
    await exchangeSide(page, 'Sell');
    await pickRow(page, 'Cinder Ore');
    const exchangeNet = await receipt(page);
    test.info().annotations.push({ type: 'prices', description: `cinder-ore: vendor ${vendorPrice} vs exchange net ${exchangeNet} per unit` });
    expect(vendorPrice).toBeLessThan(exchangeNet);
  });

  // BUG (playtest-findings.md P-1): a buy is charged at the pre-trade unit price for every
  // unit, then the player's own buy pressure lifts the quote, and the sale is paid at that
  // lifted (rounded) price. Max-buy then Max-sell prints Gold. Unfixme when the round trip loses.
  test.fixme('buying N and selling the same N back on the Exchange is never a profit', async ({ page }) => {
    test.setTimeout(120000);
    await seed(page, purse(100_000));
    await travelToExchange(page);
    const start = await savedGold(page);
    expect(start).toBe(100_000);
    // Small lot first: 10 in, 10 out.
    await exchangeSide(page, 'Buy');
    await pickRow(page, 'Cinder Ore');
    await setQty(page, 10);
    const paid = await receipt(page);
    await page.locator('section.place .ge__confirm .ab__btn').click();
    await expect(page.locator('section.place app-reward-pop .rp')).toContainText('Cinder Ore');
    await expect.poll(() => stackQty(page, 'cinder-ore')).toBe(10);
    await exchangeSide(page, 'Sell');
    await pickRow(page, 'Cinder Ore');
    await setQty(page, 10);
    const received = await receipt(page);
    await page.locator('section.place .ge__confirm .ab__btn').click();
    await expect.poll(() => stackQty(page, 'cinder-ore')).toBe(0);
    const afterSmall = await savedGold(page);
    // Then the whole purse: Max in, Max out.
    await exchangeSide(page, 'Buy');
    await pickRow(page, 'Cinder Ore');
    await page.locator('section.place .ge__confirm .ab__all').click();
    await expect.poll(() => stackQty(page, 'cinder-ore')).toBeGreaterThan(100);
    const bought = await stackQty(page, 'cinder-ore');
    await exchangeSide(page, 'Sell');
    await pickRow(page, 'Cinder Ore');
    await page.locator('section.place .ge__confirm .ab__all').click();
    await expect.poll(() => stackQty(page, 'cinder-ore')).toBe(0);
    const end = await savedGold(page);
    test.info().annotations.push({ type: 'round trip', description: `round trip 10: paid ${paid}, received ${received}; wallet ${start} -> ${afterSmall}; max lot ${bought}: -> ${end}` });
    expect(received, 'selling 10 back paid more than buying them').toBeLessThanOrEqual(paid);
    expect(end, 'a Max buy + Max sell round trip grew the purse').toBeLessThanOrEqual(start);
  });

  // The model claim behind the counter: "8% of base worth is under even the Exchange's
  // floor quote". Checked against what a player is actually handed at the floor: the
  // Exchange's floor price, after its 5% sale tax.
  // BUG (playtest-findings.md P-5): for Slag Fragment and Cinder Ore the Vendor pays exactly
  // the Exchange's floor quote net of tax (1 = 1, 2 = 2): the whole-Gold rounding eats the
  // 2-point margin. Unfixme when the Vendor is strictly below.
  test.fixme('the Vendor pays below the Exchange floor quote, after tax, for every gathered material', () => {
    const ties = VENDOR_SHELF.filter(row => row.tier === 'gathered').map(row => {
      const floorUnit = Math.max(1, Math.round(row.worth * PRICE_FLOOR_MULT));
      const floorNet = quoteSell(floorUnit, 1).net;
      return { id: row.materialId, vendor: row.price, floorNet, worth: row.worth };
    }).filter(row => row.vendor >= row.floorNet);
    expect(ties, `Vendor >= Exchange floor net: ${JSON.stringify(ties)}`).toEqual([]);
  });
});
