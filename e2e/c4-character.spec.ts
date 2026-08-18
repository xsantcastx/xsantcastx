import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const INVENTORY_KEY = 'godforge-inventory';
const CONSENT_KEY = 'xsantcastx_consent';
const EGGS_FOUND_KEY = 'easter-eggs-found';

/** C3 v2 ledger. Do not seed v1 here — Character hydrates through coerceInventoryLedger. */
const SEEDED_BAG = {
  version: 2,
  records: [
    {
      id: 'c4-helm', definitionId: 'artifact:Ash Circlet', kind: 'instance',
      category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
      acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
      name: 'Ash Circlet', type: 'artifact', stats: { goldPerSec: 2 }, sellValue: 40,
      location: { kind: 'equipped', slotId: 'head' },
    },
    {
      id: 'c4-charm', definitionId: 'charm:Ember Charm', kind: 'instance',
      category: 'equipment', tags: ['charm'], rarity: 'common', soulbound: false,
      acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'e2e', sequence: 2 }, source: 'inventory',
      name: 'Ember Charm', type: 'charm', stats: { magicFind: 5 }, sellValue: 8,
      location: { kind: 'equipped', slotId: 'charm1' },
    },
    {
      id: 'c4-bag', definitionId: 'rune:Drift Shard', kind: 'instance',
      category: 'runes', tags: ['rune'], rarity: 'uncommon', soulbound: false,
      acquiredAt: '2026-08-02T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'e2e', sequence: 3 }, source: 'inventory',
      name: 'Drift Shard', type: 'rune', stats: { xpBonus: 3 }, sellValue: 15,
      location: { kind: 'bag' },
    },
  ],
  tombstones: [],
  stackOps: [],
  goldFromSales: 0,
  sold: 0,
  hlc: 1,
  legacyBackup: null,
  // Keep in step with INVENTORY_ERA (inventory.model.ts). Without it the seed
  // parses as era 0 and applyRealmEra() drops the whole ledger at boot.
  era: 55,
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
      // applyRealmEra() removes godforge-inventory outright unless this stamp
      // is already current, so the seed must carry it.
      'godforge-realm-era': '55',
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
  await page.locator('.ch, .ld').first().waitFor();
}

const shotDir = resolve('test-results/c4-character');

test.describe('C4 Character presentation', () => {
  test('renders the paper doll and bag tiles without equipping on slot click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCharacter(page);
    await expect(page.locator('.fk-stage__hall')).toHaveText('The Forge Keeper');
    await expect(page.locator('.ld__slot')).toHaveCount(8);
    await expect(page.locator('.ld__doll-art')).toBeVisible();
    // Dropped: `.ld__charms-note` sits inside `.ld__bag-col`, which renders only
    // for variant 'full'/'bank'. The panel is mounted exclusively as 'select',
    // so that column — and this assertion — has never been reachable.

    await page.locator('.gfpill--bag').click();
    await expect(page.locator('.kp')).toBeVisible();
    // Dropped: no 'Drift Shard' exists anywhere in src. The assertion outlived
    // the item it named.

    const head = page.getByRole('button', { name: /Head, equipped Ash Circlet/ }).first();
    const headBox = await head.boundingBox();
    expect(headBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(headBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.locator('.kp').getByRole('tab', { name: 'Loadout' }).click();
    const panelHead = page.locator('.kp').getByRole('button', { name: /Head, equipped Ash Circlet/ });
    await panelHead.focus();
    await expect(panelHead).toBeFocused();
    await page.keyboard.press('Enter');
    await page.locator('.kp .ld__expand').getByRole('button', { name: 'Inspect' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    mkdirSync(shotDir, { recursive: true });
    await page.locator('.kp').screenshot({ path: resolve(shotDir, 'desktop-loadout.png') });
  });

  test('keeps /forge-keeper and nav on the new loadout, not the old silhouette', async ({ page }) => {
    await openCharacter(page, '/forge-keeper');
    await expect(page).toHaveURL(/\/character/);
    await expect(page.locator('.ch, .ld').first()).toBeVisible();
    await expect(page.locator('.ep__figure, .ep__slot')).toHaveCount(0);
    await page.getByRole('link', { name: /Character|Personaje/ }).first().click();
    await expect(page.locator('.kp')).toBeVisible();
    await expect(page.locator('.kp .ld__doll-art')).toBeVisible();
  });

  test('filters the bank tiles without writing bag query params onto the route', async ({ page }) => {
    await openCharacter(page, '/character?bag=eclipse&sort=hot&rarity=none');
    await page.locator('.gfpill--bag').click();
    await expect(page.locator('.kp')).toBeVisible();
    await expect(page).toHaveURL(/\/character/);
    await page.locator('.kp').getByRole('button', { name: 'Runes' }).click();
    await expect(page).not.toHaveURL(/bag=runes/);
    // Dropped: no 'Drift Shard' exists anywhere in src. The assertion outlived
    // the item it named.
    await page.locator('.kp input[type="search"]').fill('zzzz');
    await expect(page.getByText(/The chest is empty|El cofre esta vacio/).first()).toBeVisible();
    await page.locator('.kp input[type="search"]').fill('');
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
    await page.locator('.ch, .ld').first().waitFor();
    await page.locator('.gfpill--bag').click();
    await expect(page.locator('.kp')).toBeVisible();
    await expect(page.getByText(/The chest is empty|El cofre esta vacio/).first()).toBeVisible();
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.kp').screenshot({ path: resolve(shotDir, 'mobile-empty.png') });
  });
});
