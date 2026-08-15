import { expect, test, type Page } from '@playwright/test';

const INVENTORY = {
  version: 2,
  records: [
    {
      id: 'stack:cinder-ore', definitionId: 'cinder-ore', kind: 'stack',
      category: 'materials', tags: ['material', 'cinder-ore'], soulbound: false,
      acquiredAt: '2026-08-15T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'e2e', sequence: 1 },
      source: 'inventory', stackKey: 'cinder-ore', location: { kind: 'bag' },
    },
  ],
  tombstones: [],
  stackOps: [
    { id: 'ore:1', stackKey: 'cinder-ore', kind: 'grant', quantity: 4, hlc: 1, deviceId: 'e2e', sequence: 1 },
  ],
  goldFromSales: 0,
  sold: 0,
  hlc: 1,
  legacyBackup: null,
};

const RUNES = {
  version: 1,
  runes: { ash: 3, ember: 1 },
  firstFound: { ash: 1, ember: 1 },
  strikes: 4,
  goldSpent: 0,
};

async function open(page: Page, url: string): Promise<void> {
  await page.addInitScript(({ inventory, runes }) => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
    window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
    window.localStorage.setItem('godforge-inventory', JSON.stringify(inventory));
    window.localStorage.setItem('godforge-runes', JSON.stringify(runes));
  }, { inventory: INVENTORY, runes: RUNES });
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

test.describe('Character hub', () => {
  test('Bank shows Cinder Ore stacks and rune ledger rows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/character?tab=bank');
    await expect(page.getByRole('tab', { name: 'Bank' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /Cinder Ore/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cinder Ore/ })).toContainText('×4');
    await expect(page.getByRole('button', { name: /^Ash / })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ash / })).toContainText('×3');
  });

  test('375px hub tabs stay usable and the Bank drawer closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/character?tab=bank');
    await expect(page.getByRole('tab', { name: 'Bank' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /Cinder Ore/ })).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/world');
    await page.getByRole('button', { name: 'Bank' }).click();
    await expect(page.getByRole('dialog', { name: 'Bank' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Bank' })).toHaveCount(0);
  });
});
