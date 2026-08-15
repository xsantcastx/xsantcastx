import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const INVENTORY_KEY = 'godforge-inventory';

const SEEDED = {
  version: 2,
  records: [
    {
      id: 'c5-off', definitionId: 'artifact:Off Blade', kind: 'instance',
      category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
      acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
      name: 'Off Blade', type: 'artifact', stats: { goldPerSec: 1 }, sellValue: 20,
      location: { kind: 'equipped', slotId: 'offhand' },
    },
    {
      id: 'c5-charm', definitionId: 'charm:Old Charm', kind: 'instance',
      category: 'equipment', tags: ['charm'], rarity: 'common', soulbound: false,
      acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'e2e', sequence: 2 }, source: 'inventory',
      name: 'Old Charm', type: 'charm', stats: { goldPerSec: 4 }, sellValue: 8,
      location: { kind: 'equipped', slotId: 'charm1' },
    },
    {
      id: 'c5-bag', definitionId: 'artifact:Crown', kind: 'instance',
      category: 'artifacts', tags: ['artifact'], rarity: 'uncommon', soulbound: false,
      acquiredAt: '2026-08-02T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'e2e', sequence: 3 }, source: 'inventory',
      name: 'Crown', type: 'artifact', stats: { goldPerSec: 2 }, sellValue: 15,
      location: { kind: 'bag' },
    },
  ],
  tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
};

async function open(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, blob }) => {
      window.localStorage.setItem('xsantcastx_consent', 'denied');
      window.sessionStorage.setItem('visit-counted', '1');
      window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
      window.localStorage.setItem(key, blob);
    },
    { key: INVENTORY_KEY, blob: JSON.stringify(SEEDED) },
  );
  await page.goto('/character', { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden')
      || style.visibility === 'hidden'
      || style.opacity === '0';
  }, { timeout: 8000 });
  await page.locator('.ch, .ld').waitFor();
}

async function openPanel(page: Page, tab: 'character' | 'bank'): Promise<void> {
  if (tab === 'bank') await page.locator('.gfpill--bag').click();
  else await page.locator('.gfpill--rank').click();
  await page.locator('.kp').waitFor();
}

test.describe('C5 equipment actions', () => {
  test('migrates off-hand, retires charms, and equips from an armed tile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await expect(page.getByRole('button', { name: /Off-hand, equipped Off Blade/ })).toBeVisible();
    await expect(page.locator('.ld__charms-note')).toBeVisible();

    await openPanel(page, 'bank');
    await expect(page.getByRole('button', { name: /Old Charm/ })).toBeVisible();
    await page.getByRole('button', { name: /Crown/ }).click();
    await page.locator('.kp').getByRole('tab', { name: 'Loadout' }).click();
    await expect(page.locator('.kp')).toBeVisible();
    await expect(page.locator('.kp .ld__slot--target')).toHaveCount(4);
    await page.locator('.kp').getByRole('button', { name: /Head, empty/ }).click();
    await expect(page.locator('.kp').getByRole('button', { name: /Head, equipped Crown/ })).toBeVisible();

    await page.locator('.kp').getByRole('button', { name: /Head, equipped Crown/ }).click();
    await expect(page.locator('.kp').getByRole('button', { name: 'Unequip' })).toBeVisible();
    await expect(page.locator('.kp').getByRole('button', { name: /Head, equipped Crown/ })).toBeVisible();

    const shotDir = resolve('test-results/c5-equipment');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.kp').screenshot({ path: resolve(shotDir, 'desktop-equipped.png') });

    await page.locator('.kp').getByRole('button', { name: 'Unequip' }).click();
    await expect(page.locator('.kp').getByRole('button', { name: /Head, empty/ })).toBeVisible();
    await page.locator('.kp__tab', { hasText: 'Bank' }).click();
    await expect(page.getByRole('button', { name: /Crown/ })).toBeVisible();
  });

  test('keeps the 375px loadout readable after charm retirement', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page);
    await expect(page.getByRole('button', { name: /Off-hand, equipped Off Blade/ })).toBeVisible();
    await expect(page.locator('.ld__charms-note')).toBeVisible();
    const shotDir = resolve('test-results/c5-equipment');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.ld').screenshot({ path: resolve(shotDir, 'mobile-375.png') });
  });
});
