/**
 * play-inventory-stacks.spec.ts — forging runes no longer buries the satchel.
 *
 * Every rune find used to mint its own empty-stat "<Rune> Sigil" record, and
 * at 250 records the bag silently deleted the cheapest thing in it — gear
 * before sigils. Sigil items are gone (inventory spec, Shipped): a find is a
 * count in the Rune Forge ledger. This forges a few hundred runes on a save
 * holding one helm, then opens the satchel book and finds the helm.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, blob, openPlay, purse, seed } from './play-helpers';

const HELM = {
  id: 'e2e-ashen-helm', definitionId: 'artifact:Ashen Helm', kind: 'instance', category: 'artifacts',
  tags: ['artifact'], rarity: 'rare', soulbound: false, acquiredAt: '2026-10-01T00:00:00.000Z',
  revision: { hlc: 1, deviceId: 'e2e', sequence: 1 }, source: 'inventory', name: 'Ashen Helm',
  type: 'artifact', stats: { ward: 2 }, rollQuality: { ward: 0.8 }, sellValue: 0, econ: 3,
  location: { kind: 'bag' },
};

async function strikeBulk(page: Page, label: string): Promise<void> {
  await page.locator('.rf-acts__btn', { hasText: label }).first().click();
  await expect(page.locator('.rf-acts__btn--again')).toBeVisible({ timeout: 60000 });
}

test.describe('rune finds stack instead of filling the satchel', () => {
  test.describe.configure({ timeout: 180000 });

  test('forge 300 runes, then find the helm in the satchel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seed(page, {
      'godforge-realm-era': String(ERA),
      ...purse(400_000_000),
      'godforge-inventory': {
        version: 2, records: [HELM], tombstones: [], stackOps: [], goldFromSales: 0, sold: 0,
        hlc: 1, legacyBackup: null, era: ERA,
      },
    });

    await page.goto('/forge/runes', { waitUntil: 'load' });
    await page.getByRole('button', { name: /^Strike the forge/ }).click();
    await expect(page.locator('.rf-acts__btn--again')).toBeVisible();
    for (let i = 0; i < 3; i++) await strikeBulk(page, '×100');

    type Ledger = { records: { kind: string; type?: string; name?: string }[] };
    const ledger = (await blob<Ledger>(page, 'godforge-inventory'))!;
    // No Sigil anything; the only instances are the helm and any charm a find turned up.
    expect(ledger.records.filter(r => r.type === 'rune')).toHaveLength(0);
    expect(ledger.records.some(r => r.name === 'Ashen Helm')).toBe(true);
    expect(ledger.records.filter(r => r.kind === 'instance').length).toBeLessThanOrEqual(4);
    // What was found is in the Forge ledger, which the Forge's library reads.
    type Runes = { runes: Record<string, number> };
    const held = Object.values((await blob<Runes>(page, 'godforge-runes'))!.runes).reduce((a, b) => a + b, 0);
    expect(held).toBeGreaterThanOrEqual(301);

    await openPlay(page);
    await page.keyboard.press('i');
    await expect(page.locator('#satchel-book')).toBeVisible();
    await expect(page.locator('.pocket[aria-label="Ashen Helm"]')).toBeVisible();
    await expect(page.locator('.pocket[aria-label*="Sigil"]')).toHaveCount(0);
  });
});
