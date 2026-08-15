import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

async function open(page: Page, url: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
    window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden')
      || style.visibility === 'hidden'
      || style.opacity === '0';
  }, { timeout: 8000 });
}

test.describe('C8 Infernal chapter and Basalt Seamworks', () => {
  test('plays the Infernal choice and lands on Seamworks Mine', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/world/realms/infernal');
    await expect(page.getByRole('heading', { name: 'The Price of a Seam' })).toBeVisible();
    const shotDir = resolve('test-results/c8-infernal-seamworks');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.ic').screenshot({ path: resolve(shotDir, 'desktop-infernal-chapter.png') });
    await page.getByRole('button', { name: 'Meet who waits here' }).click();
    await page.getByRole('button', { name: 'Inspect the evidence' }).click();
    await page.getByRole('button', { name: 'Choose a brace' }).click();
    await page.getByRole('button', { name: /Emergency central brace/ }).click();
    await expect(page.getByText(/Witness Rune: Ash/)).toBeVisible();
    await page.getByRole('link', { name: 'Go to Basalt Seamworks' }).click();
    await expect(page).toHaveURL(/\/world\/realms\/infernal\/basalt-seamworks/);
    await expect(page.getByRole('heading', { name: 'Basalt Seamworks', exact: true })).toBeVisible();
    const mine = page.getByRole('button', { name: /^Mine$/ });
    await expect(mine).toBeVisible();
    await mine.click();
    await expect(page.getByText('Bag: +1 Cinder Ore.')).toBeVisible();
    await expect(page.getByText('Mining +2 XP.')).toBeVisible();
    await expect(page.locator('.sw__mine')).toBeDisabled();
    await expect(page.locator('.sw__sr')).toContainText('Recovering');
    await page.locator('.sw').screenshot({ path: resolve(shotDir, 'desktop-seamworks.png') });
  });

  test('375px Current Work tile and reduced-motion Mine stay readable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/world');
    await expect(page.getByRole('button', { name: /Current Work/ })).toBeVisible();
    const shotDir = resolve('test-results/c8-infernal-seamworks');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.gfh__welcome app-current-work-tile').screenshot({ path: resolve(shotDir, 'mobile-current-work.png') });
    await open(page, '/world/realms/infernal');
    await page.locator('.ic').screenshot({ path: resolve(shotDir, 'mobile-infernal-chapter.png') });
    await open(page, '/world/realms/infernal/basalt-seamworks');
    await expect(page.getByRole('button', { name: /^Mine$/ })).toBeVisible();
    await expect(page.getByText('Leaving this place awards nothing')).toBeVisible();
    await page.locator('.sw').screenshot({ path: resolve(shotDir, 'mobile-seamworks.png') });
  });
});
