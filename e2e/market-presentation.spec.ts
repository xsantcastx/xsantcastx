import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

async function openMarket(page: Page, url = '/market'): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('.mk__floor').scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.querySelectorAll('[data-reveal]').forEach(node => {
      node.classList.add('mk-in');
      node.removeAttribute('data-reveal');
    });
  });
}

const shotDir = resolve('e2e/artifacts/c1-market');

test.describe('C1 Market presentation', () => {
  test('renders item tiles and keeps buy off the closed tile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMarket(page);
    await expect(page.locator('.mk__tiles')).toBeVisible();
    await expect(page.locator('.mk__tile-trigger').first()).toBeVisible();
    await expect(page.locator('.mk__buy')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Catalogue picks' })).toBeVisible();
    await expect(page.locator('.mk')).not.toContainText(/Most forged|what the realms are buying/i);
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__floor').screenshot({ path: resolve(shotDir, 'desktop-ready.png') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.mk__floor').screenshot({ path: resolve(shotDir, 'desktop-reduced-motion.png') });
  });

  test('normalizes invalid query values and writes filters to the URL', async ({ page }) => {
    await openMarket(page, '/market?category=eclipse&sort=hot&page=0');
    await expect(page).toHaveURL(/\/market/);
    await expect(page).not.toHaveURL(/category=eclipse/);
    await expect(page).not.toHaveURL(/sort=hot/);
    await expect(page).not.toHaveURL(/page=0/);
    await page.getByRole('tab', { name: 'Hammers' }).click();
    await expect(page).toHaveURL(/category=hammer/);
    await page.getByLabel('Sort').selectOption('price-asc');
    await expect(page).toHaveURL(/sort=price-asc/);
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__floor').screenshot({ path: resolve(shotDir, 'desktop-filtered.png') });
  });

  test('search empty state and Spanish chrome', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openMarket(page);
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__main').screenshot({ path: resolve(shotDir, 'mobile-ready.png') });
    await page.locator('#mk-search').fill('zzzz-no-such-listing');
    await expect(page.locator('.mk__empty')).toBeVisible({ timeout: 4000 });
    await expect(page.getByRole('button', { name: 'Show everything' })).toBeVisible();
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__main').screenshot({ path: resolve(shotDir, 'mobile-empty.png') });

    await page.addInitScript(() => window.localStorage.setItem('preferred-language', 'es'));
    await page.goto('/market', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /Todo lo que la forja/i })).toBeVisible();
    await page.locator('#mk-search').fill('zzzz-no-such-listing');
    await expect(page.getByRole('button', { name: 'Mostrar todo' })).toBeVisible({ timeout: 4000 });
  });

  test('expand then Inspect, Escape collapses the tile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMarket(page);
    const trigger = page.getByRole('button', { name: /Open Forge Bellows/i });
    await trigger.click();
    await expect(page.locator('#mk-exp-forge-bellows')).toBeVisible();
    await expect(page.locator('.mk__buy')).toHaveCount(1);
    await page.locator('app-inspect-button').first().click();
    await expect(page).toHaveURL(/inspect=market-listing:forge-bellows/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.qi')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#mk-exp-forge-bellows')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('catalogue error shell and reduced-motion tile state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      (window as unknown as { __MK_FORCE_ERROR?: boolean }).__MK_FORCE_ERROR = true;
    });
    await openMarket(page);
    await expect(page.locator('.mk__error')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__main').screenshot({ path: resolve(shotDir, 'mobile-error.png') });

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.mk__tiles')).toBeVisible();
    const trigger = page.locator('.mk__tile-trigger').first();
    await trigger.click();
    await expect(page.locator('.mk__tile-exp').first()).toBeVisible();
    await expect.poll(async () =>
      page.locator('.mk__tile-exp').first().evaluate(el => getComputedStyle(el).animationName),
    ).toBe('none');
    await page.locator('.mk__tile--open').screenshot({ path: resolve(shotDir, 'mobile-expanded-reduced-motion.png') });
  });

  test('Eclipse is a dedicated panel, not a category filter', async ({ page }) => {
    await openMarket(page);
    await expect(page.locator('.mk__facet-list').getByRole('button', { name: 'The Eclipse' })).toHaveCount(0);
    await page.getByRole('button', { name: 'The Eclipse' }).first().click();
    await expect(page.locator('.mk__eclipse')).toBeVisible();
    await expect(page).not.toHaveURL(/category=eclipse/);
  });
});
