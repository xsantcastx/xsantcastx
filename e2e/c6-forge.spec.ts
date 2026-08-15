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

test.describe('C6 Forge normalization', () => {
  test('keeps /rune-forge and shows a locked Basalt Edge recipe', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/rune-forge');
    await expect(page).toHaveURL(/\/forge\/runes/);
    await expect(page.getByRole('heading', { name: 'Strike the Anvil' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Equipment recipes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Basalt Edge' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Craft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Craft' })).toBeDisabled();
    await expect(page.getByText(/Need/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set the word' }).or(page.getByRole('button', { name: 'Runes missing' }))).toHaveCount(6);
    await page.locator('#rf-equip-title').locator('..').getByRole('button', { name: 'Inspect' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('span[aria-hidden="true"]', { hasText: '6 Cinder Ore + 1 Ember Residue' })).toBeVisible();
    const shotDir = resolve('test-results/c6-forge');
    mkdirSync(shotDir, { recursive: true });
    await page.keyboard.press('Escape');
    await page.locator('.rf').screenshot({ path: resolve(shotDir, 'desktop-forge.png') });
  });

  test('Codex stays the record and links to the Forge', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/codex');
    await expect(page.getByRole('heading', { name: 'The Codex' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open the Forge/ })).toBeVisible();
    const shotDir = resolve('test-results/c6-forge');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.cx-page').screenshot({ path: resolve(shotDir, 'mobile-codex.png') });
  });
});
