import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

/**
 * The Market on the station kit: shelf tabs → journal list → the selected
 * upgrade → ONE Buy button with its price. Search, filters, the Eclipse and
 * the income ledger live in the Details drawer.
 */
async function openMarket(page: Page, url = '/market'): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
  });
  await page.goto(url, { waitUntil: 'load' });
  // The site boot loader is a full-viewport layer; wait it out.
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden')
      || style.visibility === 'hidden'
      || style.opacity === '0';
  }, { timeout: 8000 });
  // An achievement drop can own the screen for its cinematic; it comes down on its own.
  await page.locator('.ad-veil--on').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => { /* never appeared */ });
  await page.locator('.ad--cine').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => { /* as above */ });
  // The town NPC's speech bubble is a site-wide fixed widget; close it so it
  // does not answer a hit test meant for the page.
  const npc = page.locator('.npc__close');
  if (await npc.isVisible().catch(() => false)) await npc.click().catch(() => { /* gone already */ });
}

/** Opens the Details drawer (native <details>) if it is closed. */
async function openDetails(page: Page): Promise<void> {
  const details = page.locator('app-station-shell.mk details').first();
  if (!(await details.evaluate(el => (el as HTMLDetailsElement).open))) {
    await details.locator('summary').click();
  }
  await expect(details).toHaveJSProperty('open', true);
}

/** The detail pane must be the topmost paint at its centre (not under the scene). */
async function assertDetailPaints(page: Page): Promise<void> {
  const detail = page.locator('.mkj-detail');
  await detail.scrollIntoViewIfNeeded();
  await expect(detail).toBeVisible();
  await expect
    .poll(async () => detail.evaluate(el => {
      const r = el.getBoundingClientRect();
      const y = r.y + Math.min(r.height / 2, 60);
      if (y < 0 || y > window.innerHeight) return `off-screen at y=${Math.round(y)}`;
      const hit = document.elementFromPoint(r.x + r.width / 2, y);
      if (!hit) return 'nothing painted there';
      if (hit.closest('.scene')) return `covered by the art scene: ${hit.tagName}`;
      if (hit.closest('.mkj-detail')) return 'detail';
      return `covered by ${hit.tagName}.${(hit as HTMLElement).className}`;
    }), { message: 'the detail must be the topmost paint' })
    .toBe('detail');
}

const shotDir = resolve('test-results/c1-market');

test.describe('C1 Market journal', () => {
  test('first view: shelf tabs, a list, one selected upgrade and ONE Buy with its price', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMarket(page);
    await expect(page.locator('app-station-shell.mk')).toBeVisible();
    const shelves = page.getByRole('navigation', { name: 'Market shelves' }).first();
    await expect(shelves.getByRole('button', { name: /Can buy/ })).toBeVisible();
    await expect(shelves.getByRole('button', { name: 'Hammers' })).toBeVisible();
    await expect(page.locator('.mk__list .jl__row').first()).toBeVisible();
    await expect(page.locator('.mkj-detail app-detail-head')).toBeVisible();
    await expect(page.locator('.mkj-detail .mk__row-effect')).toBeVisible();
    // Exactly one primary action in the journal.
    await expect(page.locator('.mkj-detail .ab__btn')).toHaveCount(1);
    // The Eclipse is not a shelf.
    await expect(shelves.getByRole('button', { name: /Eclipse/ })).toHaveCount(0);
    await assertDetailPaints(page);
    mkdirSync(shotDir, { recursive: true });
    await page.locator('app-station-shell.mk').screenshot({ path: resolve(shotDir, 'desktop-journal.png') });
  });

  // Since the 2026-10-12 rebalance the first rung costs 15 Gold (economy-curve.ts), not free.
  test('a fresh purse sees the Forge Bellows first, priced at 15 Gold', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openMarket(page);
    await expect(page.locator('.mkj-detail')).toContainText('Forge Bellows');
    await expect(page.locator('.mkj-detail .ab__btn')).toContainText(/15\s*Gold/i);
    await assertDetailPaints(page);
    mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: resolve(shotDir, 'mobile-first-view.png') });
  });

  test('search lives in Details; an empty result offers Show everything; Spanish chrome', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openMarket(page);
    await openDetails(page);
    await page.locator('#mk-search').fill('zzzz-no-such-listing');
    await expect(page.getByRole('button', { name: 'Show everything' })).toBeVisible({ timeout: 4000 });

    await page.addInitScript(() => window.localStorage.setItem('preferred-language', 'es'));
    await page.goto('/market', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /Mercado de la Godforge/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Al alcance/ })).toBeVisible();
  });

  test('catalogue error shell, and Retry brings the journal back', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      (window as unknown as { __MK_FORCE_ERROR?: boolean }).__MK_FORCE_ERROR = true;
    });
    await openMarket(page);
    await expect(page.locator('.mk__error')).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.mkj-detail')).toBeVisible();
  });

  test('the Eclipse is a panel in Details, not a shelf or a filter', async ({ page }) => {
    await openMarket(page);
    await openDetails(page);
    await expect(page.locator('.mk__eclipse')).toBeVisible();
    await expect(page).not.toHaveURL(/category=eclipse/);
  });
});
