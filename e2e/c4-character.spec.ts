import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const INVENTORY_KEY = 'godforge-inventory';
const CONSENT_KEY = 'xsantcastx_consent';
const EGGS_FOUND_KEY = 'easter-eggs-found';

const SEEDED_BAG = {
  version: 1,
  items: [
    {
      id: 'c4-helm', name: 'Ash Circlet', type: 'artifact', rarity: 'rare',
      stats: { goldPerSec: 2 }, sellValue: 40, equipped: true, slot: 'head',
      foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
    },
    {
      id: 'c4-charm', name: 'Ember Charm', type: 'charm', rarity: 'common',
      stats: { magicFind: 5 }, sellValue: 8, equipped: true, slot: 'charm1',
      foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
    },
    {
      id: 'c4-bag', name: 'Drift Shard', type: 'rune', rarity: 'uncommon',
      stats: { xpBonus: 3 }, sellValue: 15, equipped: false,
      foundAt: '2026-08-02T00:00:00.000Z', soulbound: false,
    },
  ],
  goldFromSales: 0,
  sold: 0,
};

async function openCharacter(page: Page, url = '/character'): Promise<void> {
  await page.addInitScript(
    (state) => {
      for (const [key, value] of Object.entries(state as Record<string, string>)) {
        window.localStorage.setItem(key, value);
      }
      window.sessionStorage.setItem('visit-counted', '1');
    },
    {
      [CONSENT_KEY]: 'denied',
      [EGGS_FOUND_KEY]: JSON.stringify(['forge-self-aware']),
      [INVENTORY_KEY]: JSON.stringify(SEEDED_BAG),
    },
  );
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden')
      || style.visibility === 'hidden'
      || style.opacity === '0';
  }, { timeout: 8000 });
  await page.locator('.ld').waitFor();
}

const shotDir = resolve('test-results/c4-character');

test.describe('C4 Character presentation', () => {
  test('renders the paper doll and bag tiles without equipping on slot click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCharacter(page);
    await expect(page.getByRole('heading', { name: 'What you carry into the dark' })).toBeVisible();
    await expect(page.locator('.ld__slot')).toHaveCount(8);
    await expect(page.locator('.ld__doll-art')).toBeVisible();
    await expect(page.getByText('Requires the future charm system.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Drift Shard/ })).toBeVisible();

    const head = page.getByRole('button', { name: /Head, equipped Ash Circlet/ });
    await head.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    mkdirSync(shotDir, { recursive: true });
    await page.locator('.ld').screenshot({ path: resolve(shotDir, 'desktop-loadout.png') });
  });

  test('normalizes bag query params and filters the tile list', async ({ page }) => {
    await openCharacter(page, '/character?bag=eclipse&sort=hot&rarity=none');
    await expect(page).not.toHaveURL(/bag=eclipse/);
    await expect(page).not.toHaveURL(/sort=hot/);
    await page.locator('.ld__field select').first().selectOption('runes');
    await expect(page).toHaveURL(/bag=runes/);
    await expect(page.getByRole('button', { name: /Drift Shard/ })).toBeVisible();
    await page.locator('.ld__field select').first().selectOption('charms');
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/bag=/);
  });

  test('shows empty-bag paths and a 375px layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      window.localStorage.setItem('xsantcastx_consent', 'denied');
      window.sessionStorage.setItem('visit-counted', '1');
      window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
    });
    await page.goto('/character', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const loader = document.querySelector('.gf-loader');
      if (!loader) return true;
      const style = getComputedStyle(loader);
      return loader.classList.contains('gf-loader--hidden')
        || style.visibility === 'hidden'
        || style.opacity === '0';
    }, { timeout: 8000 });
    await page.locator('.ld').waitFor();
    await expect(page.getByText(/The bag is empty|La bolsa esta vacia/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Market' }).first()).toBeVisible();
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.ld').screenshot({ path: resolve(shotDir, 'mobile-empty.png') });
  });
});
