import { expect, test, type Page } from '@playwright/test';

/**
 * Equipping used to be a two-surface gesture: find the item in the Bank tab,
 * arm it, return to the Loadout, click the well. You had to already know which
 * of your items was a helm. Clicking the slot now asks the bag instead.
 */

const HELM = {
  id: 'seed-helm', definitionId: 'astral-helm', kind: 'instance',
  category: 'equipment', tags: ['artifact'], rarity: 'rare', soulbound: false,
  acquiredAt: '2026-08-18T00:00:00.000Z',
  revision: { hlc: 1, deviceId: 'e2e', sequence: 1 },
  source: 'inventory', name: 'Astral Helm', type: 'artifact',
  stats: { goldPerSec: 0.6 }, sellValue: 90, location: { kind: 'bag' },
};

const SECOND_HELM = {
  ...HELM,
  id: 'seed-cowl', definitionId: 'keepers-cowl', name: "Keeper's Cowl",
  revision: { hlc: 2, deviceId: 'e2e', sequence: 2 },
  stats: { magicFind: 1.5 }, sellValue: 40,
};

const LEDGER = {
  version: 2,
  records: [HELM, SECOND_HELM],
  tombstones: [],
  stackOps: [],
  goldFromSales: 0,
  sold: 0,
  hlc: 2,
  legacyBackup: null,
  // Must match INVENTORY_ERA, or applyRealmEra() drops the seed at boot.
  era: 55,
};

async function open(page: Page): Promise<void> {
  await page.addInitScript(ledger => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
    window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
    window.localStorage.setItem('godforge-realm-era', '55');
    window.localStorage.setItem('godforge-inventory', JSON.stringify(ledger));
  }, LEDGER);
  await page.goto('/character', { waitUntil: 'load' });
  await page.locator('.ld__slot').first().waitFor();
}

test.describe('loadout slot picker', () => {
  test('clicking a slot lists what fits it and equips in one click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page);

    const head = page.getByRole('button', { name: /^Head,/ }).first();
    await head.click();

    const picker = page.locator('.ld__picker');
    await expect(picker).toBeVisible();

    // Both seeded helms fit the head slot; neither is a weapon.
    const options = picker.locator('.ld__pick');
    await expect(options).toHaveCount(2);
    await expect(picker).toContainText('Astral Helm');
    await expect(picker).toContainText("Keeper's Cowl");

    await options.filter({ hasText: 'Astral Helm' }).click();

    // The well now reports it as worn, without a trip to the Bank tab.
    await expect(page.getByRole('button', { name: /Head, equipped Astral Helm/ }).first()).toBeVisible();
  });

  test('a slot nothing fits says so rather than showing an empty list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page);

    await page.getByRole('button', { name: /^Weapon,/ }).first().click();
    await expect(page.locator('.ld__picker')).toContainText(/Nothing in your bag fits/);
  });
});
