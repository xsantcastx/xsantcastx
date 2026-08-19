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
  await tile.scrollIntoViewIfNeeded();
  await expect(tile).toBeVisible();
  const box = await tile.boundingBox();
  expect(box, `tile ${index} should have a box`).toBeTruthy();
  expect(box!.width).toBeGreaterThan(160);
  expect(box!.height).toBeGreaterThan(60);
  const opacity = await tile.evaluate(el => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);
  // Read the rect and hit-test it inside one evaluate, and poll: <html> carries
  // scroll-behavior: smooth, so a point taken from an earlier boundingBox() can
  // be stale by the time it is used, and on a 375px viewport a tall flat card
  // scrolled that way is still off-screen on the first frame — where
  // elementFromPoint returns null and the failure reads as a paint bug.
  await expect
    .poll(async () => tile.evaluate(el => {
      const r = el.getBoundingClientRect();
      const y = r.y + r.height / 2;
      if (y < 0 || y > window.innerHeight) return `off-screen at y=${Math.round(y)}`;
      const hit = document.elementFromPoint(r.x + r.width / 2, y);
      if (!hit) return 'nothing painted there';
      if (hit.closest('.scene')) return `covered by the art scene: ${hit.tagName}.${(hit as HTMLElement).className}`;
      if (hit.closest('.mk__tile')) return 'tile';
      return `covered by ${hit.tagName}.${(hit as HTMLElement).className}`;
    }), { message: `tile ${index} must be the topmost paint at its centre` })
    .toBe('tile');
}

const shotDir = resolve('test-results/c1-market');

test.describe('C1 Market presentation', () => {
  test('renders flat item tiles above the scene, each with its own buy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMarket(page);
    await page.locator('.mk__tiles').scrollIntoViewIfNeeded();
    // A page of the catalogue. The tile used to be a disclosure button you
    // clicked to find out what a listing did and clicked again to buy; it is a
    // flat card now, so price, effect and Buy are all on it from the start.
    await expect(page.locator('.mk__tile')).toHaveCount(8);
    await expect(page.locator('.mk__tile-trigger')).toHaveCount(0);
    await expect(page.locator('.mk__buy')).toHaveCount(8);
    await expect(page.locator('.mk__tile').first().locator('.mk__row-effect')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Catalogue picks' })).toBeVisible();
    await expect(page.locator('.mk')).not.toContainText(/Most forged|what the realms are buying/i);
    for (let i = 0; i < 4; i++) await assertTilePaints(page, i);

    mkdirSync(shotDir, { recursive: true });
    await page.locator('.mk__tiles').screenshot({ path: resolve(shotDir, 'desktop-tiles.png') });
    await page.locator('.mk__tile').first().screenshot({ path: resolve(shotDir, 'desktop-tile.png') });
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
    await expect(page.locator('.mk__tile').first()).toBeVisible();
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

  test('Inspect opens from a tile and Escape hands focus back to it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMarket(page);
    const tile = page.locator('.mk__tile').filter({ hasText: 'Forge Bellows' }).first();
    await expect(tile).toBeVisible();
    const inspect = tile.locator('app-inspect-button button');
    await inspect.click();
    await expect(page).toHaveURL(/inspect=market-listing:forge-bellows/);
    await expect(page.locator('.qi')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.qi')).toHaveCount(0);
    await expect(page).not.toHaveURL(/inspect=/);
    // The tile never collapsed, because there is nothing left to collapse.
    await expect(tile).toBeVisible();
    await expect(inspect).toBeFocused();
  });

  test('catalogue error shell and reduced-motion market chrome', async ({ page }) => {
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
    const tile = page.locator('.mk__tile').first();
    await tile.scrollIntoViewIfNeeded();
    await expect(tile).toBeVisible();
    // The market sigil is the page's one always-running animation, so it is
    // what proves the reduce path is live rather than merely unexercised.
    await expect.poll(async () =>
      page.locator('.mk__sigil').first().evaluate(el => getComputedStyle(el).animationName),
    ).toBe('none');
    mkdirSync(shotDir, { recursive: true });
    await tile.screenshot({ path: resolve(shotDir, 'mobile-tile.png') });
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
