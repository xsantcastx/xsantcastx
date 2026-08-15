import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const LEDGER = {
  version: 2,
  records: [
    {
      id: 'stack:cinder-ore', definitionId: 'cinder-ore', kind: 'stack',
      category: 'materials', tags: ['material', 'cinder-ore'], soulbound: false,
      acquiredAt: '2026-08-15T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'e2e', sequence: 1 },
      source: 'inventory', stackKey: 'cinder-ore', location: { kind: 'bag' },
    },
    {
      id: 'stack:ember-residue', definitionId: 'ember-residue', kind: 'stack',
      category: 'materials', tags: ['material', 'ember-residue'], soulbound: false,
      acquiredAt: '2026-08-15T00:00:00.000Z',
      revision: { hlc: 2, deviceId: 'e2e', sequence: 2 },
      source: 'inventory', stackKey: 'ember-residue', location: { kind: 'bag' },
    },
  ],
  tombstones: [],
  stackOps: [
    { id: 'ore:1', stackKey: 'cinder-ore', kind: 'grant', quantity: 6, hlc: 1, deviceId: 'e2e', sequence: 1 },
    { id: 'ember:1', stackKey: 'ember-residue', kind: 'grant', quantity: 1, hlc: 2, deviceId: 'e2e', sequence: 2 },
  ],
  goldFromSales: 0,
  sold: 0,
  hlc: 2,
  legacyBackup: null,
};

async function open(page: Page, url: string): Promise<void> {
  await page.addInitScript(ledger => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
    window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
    window.localStorage.setItem('godforge-inventory', JSON.stringify(ledger));
  }, LEDGER);
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

test.describe('C9 first loop craft and equip', () => {
  test('crafts Basalt Edge, inspects it, and equips the weapon', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/forge/runes');
    const craft = page.getByRole('button', { name: 'Craft' });
    await expect(craft).toBeEnabled();
    await craft.click();
    await expect(page.getByText('Basalt Edge is in the bag.')).toBeVisible();
    await page.locator('.rf-word__result').getByRole('button', { name: 'Inspect' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Basalt Edge' })).toBeVisible();
    await page.getByRole('button', { name: 'Equip weapon' }).click();
    await expect(page.getByRole('button', { name: 'Already equipped' })).toBeDisabled();
    const shotDir = resolve('test-results/c9-first-loop');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.qi').screenshot({ path: resolve(shotDir, 'desktop-inspect-equip.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Open in bag' }).click();
    await expect(page).toHaveURL(/\/character/);
    await expect(page.getByText('Basalt Edge').first()).toBeVisible();
    await page.locator('.ch, .ld').first().screenshot({ path: resolve(shotDir, 'desktop-bag.png') });
  });

  test('375px missing-input and reduced-motion craft stay readable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      window.localStorage.setItem('xsantcastx_consent', 'denied');
      window.sessionStorage.setItem('visit-counted', '1');
      window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
    });
    await page.goto('/forge/runes', { waitUntil: 'load' });
    await expect(page.getByRole('button', { name: 'Craft' })).toBeDisabled();
    await expect(page.getByText(/Need/)).toBeVisible();
    const shotDir = resolve('test-results/c9-first-loop');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('#rf-equip-title').locator('..').screenshot({
      path: resolve(shotDir, 'mobile-missing.png'),
    });
  });
});
