import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

async function openMarket(page: Page, url = '/market'): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
  });
  await page.goto(url, { waitUntil: 'load' });
  // The site boot loader is a full-viewport X. Screenshots taken before it
  // dismisses look like a blank Market. Wait it out; do not treat the scene
  // as covering the tiles.
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden')
      || style.visibility === 'hidden'
      || style.opacity === '0';
  }, { timeout: 8000 });
}

async function assertTilePaints(page: Page, index = 0): Promise<void> {
  const tile = page.locator('.mk__tile').nth(index);
  await tile.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await expect(tile).toBeVisible();
  const box = await tile.boundingBox();
  expect(box, `tile ${index} should have a box`).toBeTruthy();
  expect(box!.width).toBeGreaterThan(160);
  expect(box!.height).toBeGreaterThan(60);
  const opacity = await tile.evaluate(el => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return {
      tag: el?.tagName ?? null,
      cls: (el as HTMLElement | null)?.className ?? '',
      tile: !!el?.closest('.mk__tile'),
      scene: !!el?.closest('.scene'),
    };
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });
  expect(hit.scene, `tile ${index} must not be covered by the art scene (${hit.tag}.${hit.cls})`).toBe(false);
  expect(hit.tile, `tile ${index} must be the topmost paint at its center (${hit.tag}.${hit.cls})`).toBe(true);
}

const shotDir = resolve('test-results/c1-market');

test.describe('C1 Market presentation', () => {
  test('renders item tiles above the scene and keeps buy off the closed tile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMarket(page);
    await page.locator('.mk__tiles').scrollIntoViewIfNeeded();
    await expect(page.locator('.mk__tile-trigger')).toHaveCount(8);
    await expect(page.locator('.mk__buy')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Catalogue picks' })).toBeVisible();
    await expect(page.locator('.mk')).not.toContainText(/Most forged|what the realms are buying/i);
    for (let i = 0; i < 4; i++) await assertTilePaints(page, i);

    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__tiles').screenshot({ path: resolve(shotDir, 'desktop-tiles.png') });
    await page.locator('.mk__tile-trigger').first().click();
    await expect(page.locator('.mk__tile-exp').first()).toBeVisible();
    await expect(page.locator('.mk__buy')).toHaveCount(1);
    await page.locator('.mk__tile--open').screenshot({ path: resolve(shotDir, 'desktop-expanded.png') });
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
  });

  test('clamps an out-of-range page onto the last real page', async ({ page }) => {
    await openMarket(page, '/market?page=999');
    await expect(page).not.toHaveURL(/page=999/);
    await expect(page.locator('.mk__pager-at')).toContainText(/Page 5 of 5|5 of 5/);
    await expect(page).toHaveURL(/page=5/);
    await expect(page.locator('.mk__tile-trigger').first()).toBeVisible();
  });

  test('search empty state and Spanish chrome', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openMarket(page);
    await page.locator('.mk__tiles').scrollIntoViewIfNeeded();
    await assertTilePaints(page, 0);
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__tiles').screenshot({ path: resolve(shotDir, 'mobile-tiles.png') });

    await page.locator('#mk-search').fill('zzzz-no-such-listing');
    await expect(page.locator('.mk__empty')).toBeVisible({ timeout: 4000 });
    await expect(page.getByRole('button', { name: 'Show everything' })).toBeVisible();

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

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.mk__tiles')).toBeVisible();
    const trigger = page.locator('.mk__tile-trigger').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(page.locator('.mk__tile-exp').first()).toBeVisible();
    await expect.poll(async () =>
      page.locator('.mk__tile-exp').first().evaluate(el => getComputedStyle(el).animationName),
    ).toBe('none');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__tile--open').screenshot({ path: resolve(shotDir, 'mobile-expanded.png') });
  });

  test('Eclipse is a dedicated panel, not a category filter or tab', async ({ page }) => {
    await openMarket(page);
    const shelves = page.getByRole('tablist', { name: 'Market shelves' });
    await expect(shelves.getByRole('tab')).toHaveCount(9);
    await expect(shelves.getByRole('button', { name: 'The Eclipse' })).toHaveCount(0);
    await expect(page.locator('.mk__facet-list').getByRole('button', { name: 'The Eclipse' })).toHaveCount(0);
    await page.getByRole('button', { name: 'The Eclipse' }).first().click();
    await expect(page.locator('.mk__eclipse')).toBeVisible();
    await expect(page).not.toHaveURL(/category=eclipse/);
  });
});
