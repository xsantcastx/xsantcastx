import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

/**
 * The Gambler and the Grand Exchange on the station kit: tabs → list → the
 * selected thing → ONE action row. Everything else is in Details.
 */
async function open(page: Page, url: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden') || style.visibility === 'hidden' || style.opacity === '0';
  }, { timeout: 8000 });
}

const shotDir = resolve('test-results/station-trade');

/** A purse: merged over a fresh ledger on read, so gold alone is a valid seed. */
async function seedGold(page: Page, gold: number): Promise<void> {
  await page.addInitScript(g => {
    window.localStorage.setItem('godforge-economy', JSON.stringify({ version: 2, gold: g }));
  }, gold);
}

async function closeNpc(page: Page): Promise<void> {
  const npc = page.locator('.npc__close');
  if (await npc.isVisible().catch(() => false)) await npc.click().catch(() => { /* gone */ });
}

test.describe('Gambler journal', () => {
  test('boxes list, odds and one Open with its price; a refused Open says why', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/gambler');
    await expect(page.locator('app-station-shell.gb')).toBeVisible();
    await expect(page.locator('app-journal-list .jl__row')).toHaveCount(5);
    await expect(page.locator('.gbj-odds .gb__odd').first()).toBeVisible();
    const action = page.locator('.gb__buy .ab__btn');
    await expect(action).toHaveCount(1);
    await expect(action).toContainText('Open');
    // A fresh purse cannot pay 5,000 Gold: the button says why instead of greying out,
    // and pressing it anyway opens nothing.
    await expect(page.locator('.gb__buy .ab__why')).toContainText(/Need .* more Gold/);
    await expect(action).toHaveAttribute('aria-disabled', 'true');
    await action.dispatchEvent('click');
    await expect(page.locator('.gb-reveal')).toHaveCount(0);
    mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: resolve(shotDir, 'gambler-mobile.png') });
  });

  test('Open plays the altar reveal over the page; Open ×N reveals the best of the batch', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedGold(page, 1_000_000);
    await open(page, '/gambler');
    await closeNpc(page);
    // A full purse selects the dearest affordable box by default.
    await page.locator('app-journal-list .jl__row', { hasText: 'Iron Chest' }).click();
    const action = page.locator('.gb__buy .ab__btn');
    await expect(action).not.toHaveAttribute('aria-disabled', 'true');
    await action.click();
    const reveal = page.locator('.gb-reveal');
    await expect(reveal).toBeVisible();
    // The reveal is the topmost paint at the viewport centre (the routed host's
    // transform must not trap it below the fold).
    await expect.poll(() => page.evaluate(() =>
      !!document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.gb-reveal'))).toBe(true);
    await page.keyboard.press('Escape'); // skip
    await expect(reveal).toHaveAttribute('data-phase', 'revealed');
    await page.locator('.gb-reveal__done').click();
    await expect(reveal).toHaveCount(0);

    const many = page.locator('.gb__buy .ab__all');
    await expect(many).toContainText('×5');
    await many.click();
    await expect(reveal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.gb-reveal__more')).toContainText('best of 5');
    await expect(page.locator('.gb-reveal .gb-pulls__tile')).toHaveCount(6);
    mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: resolve(shotDir, 'gambler-reveal-many.png') });
  });

  test('the Sell tab and the Details drawer hold the till', async ({ page }) => {
    await open(page, '/gambler');
    await page.getByRole('button', { name: /^Sell/ }).first().click();
    await expect(page.locator('app-journal-list')).toBeVisible();
    await page.locator('app-station-shell.gb details summary').first().click();
    await expect(page.locator('.gb__till')).toBeVisible();
  });
});

test.describe('Exchange journal', () => {
  test('Buy/Sell tabs, a list, the selected line with a stepper and one Buy', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/exchange');
    await expect(page.locator('app-station-shell.ge')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buy', exact: true }).first()).toBeVisible();
    await expect(page.locator('app-journal-list .jl__row').first()).toBeVisible();
    await expect(page.locator('.gej-detail app-detail-head')).toBeVisible();
    await expect(page.locator('.ge__confirm .ab__btn')).toHaveCount(1);
    await expect(page.locator('.ge__confirm .ab__step')).toBeVisible();
    mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: resolve(shotDir, 'exchange-mobile.png') });
  });

  test('Buy ×3 pops the goods and the Sell tab then lists them', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedGold(page, 1_000_000);
    await open(page, '/exchange');
    await closeNpc(page);
    await page.locator('app-journal-list .jl__row', { hasText: 'Cinder Ore' }).first().click();
    await expect(page.locator('.gej-detail app-detail-head')).toContainText('Cinder Ore');
    const more = page.locator('.ge__confirm .ab__stepbtn').nth(1);
    await more.click();
    await more.click();
    await expect(page.locator('.gej-detail app-detail-head')).toContainText('Buy 3 Cinder Ore');
    await page.locator('.ge__confirm .ab__btn').click();
    await expect(page.locator('app-reward-pop .rp')).toContainText('3 × Cinder Ore');
    await page.getByRole('button', { name: 'Sell', exact: true }).first().click();
    await expect(page.locator('app-journal-list .jl__row', { hasText: 'Cinder Ore' })).toContainText('You hold 3');
  });

  test('the chart lives in Details', async ({ page }) => {
    await open(page, '/exchange');
    await page.locator('app-station-shell.ge details summary').first().click();
    await expect(page.locator('.ge__chartbox')).toBeVisible();
  });
});
