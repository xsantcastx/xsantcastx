import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

import { INVENTORY_ERA } from '../src/app/shared/rpg/inventory.model';
import { REALM_ERA_KEY } from '../src/app/shared/save/realm-era';

const INVENTORY_KEY = 'godforge-inventory';

/**
 * The era stamp is not optional dressing. A ledger without it — or with one
 * from a prior era — is emptied on load by applyRealmEra, which is exactly
 * what happened to this seed: every slot came up empty and the failure read
 * as "the off-hand button is gone" rather than "the save was wiped". Both
 * constants are imported rather than written as 55 so the next era bump moves
 * this seed with it.
 */
const SEEDED = {
  version: 2,
  era: INVENTORY_ERA,
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
    ({ key, blob, eraKey, eraValue }) => {
      window.localStorage.setItem('xsantcastx_consent', 'denied');
      window.sessionStorage.setItem('visit-counted', '1');
      window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
      window.localStorage.setItem(key, blob);
      window.localStorage.setItem(eraKey, eraValue);
    },
    {
      key: INVENTORY_KEY,
      blob: JSON.stringify(SEEDED),
      eraKey: REALM_ERA_KEY,
      eraValue: String(INVENTORY_ERA),
    },
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
  await page.locator('.ch, .ld').first().waitFor();
}

async function openPanel(page: Page, tab: 'character' | 'bank'): Promise<void> {
  if (tab === 'bank') await page.locator('.gfpill--bag').click();
  else await page.locator('.gfpill--rank').click();
  await page.locator('.kp').waitFor();
}

test.describe('C5 equipment actions', () => {
  test('migrates off-hand, wears a charm, and equips from an armed tile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await expect(page.getByRole('button', { name: /Off-hand, equipped Off Blade/ })).toBeVisible();
    // Charms used to be retired, with a note where the row is. They have three
    // wells of their own now, and the seeded Old Charm sits in the first.
    const charms = page.locator('.ld').first().locator('.ld__charmrow-slots .ld__charm');
    await expect(charms).toHaveCount(3);
    await expect(charms.filter({ hasText: 'Old Charm' })).toHaveCount(1);

    await openPanel(page, 'bank');
    // Scoped to the panel: the sheet behind it holds its own copy of every bag
    // tile, so an unscoped name match is two elements, not a missing one. The
    // charm is worn now rather than retired to the bank, so the bank is exactly
    // where it should not be.
    await expect(page.locator('.kp').getByRole('button', { name: /Old Charm/ })).toHaveCount(0);
    await page.locator('.kp').getByRole('button', { name: /Crown/ }).click();
    await page.locator('.kp').getByRole('tab', { name: 'Loadout' }).click();
    await expect(page.locator('.kp')).toBeVisible();
    // An armed artifact lights every slot but Feet, which accepts nothing at
    // all. The count was 4 when fewer slots listed 'artifact' in `accepts`.
    await expect(page.locator('.kp .ld__slot--target')).toHaveCount(7);
    await expect(page.locator('.kp').getByRole('button', { name: /Feet, locked/ })).toBeVisible();
    await page.locator('.kp').getByRole('button', { name: /Head, empty/ }).click();
    await expect(page.locator('.kp').getByRole('button', { name: /Head, equipped Crown/ })).toBeVisible();

    // Placing an armed item leaves that slot's picker open, so Unequip is
    // already on screen. Clicking the well a second time — which is what this
    // used to do — toggles the picker shut and takes Unequip with it.
    await expect(page.locator('.kp').getByRole('button', { name: 'Unequip' })).toBeVisible();
    await expect(page.locator('.kp').getByRole('button', { name: /Head, equipped Crown/ })).toBeVisible();

    const shotDir = resolve('test-results/c5-equipment');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.kp').screenshot({ path: resolve(shotDir, 'desktop-equipped.png') });

    await page.locator('.kp').getByRole('button', { name: 'Unequip' }).click();
    await expect(page.locator('.kp').getByRole('button', { name: /Head, empty/ })).toBeVisible();
    await page.locator('.kp').getByRole('tab', { name: 'Bank' }).click();
    await expect(page.locator('.kp').getByRole('button', { name: /Crown/ })).toBeVisible();
  });

  test('keeps the 375px loadout and its charm row readable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page);
    await expect(page.getByRole('button', { name: /Off-hand, equipped Off Blade/ })).toBeVisible();
    await expect(page.locator('.ld').first().locator('.ld__charmrow-slots .ld__charm')).toHaveCount(3);
    const shotDir = resolve('test-results/c5-equipment');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.ld').screenshot({ path: resolve(shotDir, 'mobile-375.png') });
  });
});
