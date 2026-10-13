/**
 * play-vault.spec.ts — the 40-slot satchel and the Vault (inventory spec S5).
 *
 * A full satchel never drops anything: an arrival goes to the Vault with a
 * message. Then the Vault's station in the Basalt Seamworks: Take out (refused
 * while the satchel is full, with the reason), Send to Vault, buy 8 satchel
 * slots with Gold, sort and search. Desktop and the Terraria-style phone HUD.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ERA, blob, focusWorld, messageLine, openPlay, placePanel, playerX, purse, seed, walkTo } from './play-helpers';
import { STORAGE_CURVE } from '../src/app/shared/economy/economy-curve';

const ROW_PRICE = STORAGE_CURVE.satchelRows[0];

function gear(id: string, name: string, i: number, location: unknown = { kind: 'bag' }, definitionId = `artifact:${name}`): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: i + 1, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: { ward: 2 }, rollQuality: { ward: 0.5 }, sellValue: 100 + i, econ: 3, location,
  };
}

/** 37 helms + the three starter tools = a full 40-slot satchel; one Cometfall Helm already in the Vault. */
function fullSatchel(): Record<string, unknown> {
  const records = [
    ...Array.from({ length: 37 }, (_, i) => gear(`e2e-helm-${i}`, 'Ashen Helm', i)),
    gear('starter-pickaxe:v1', 'Worn Pickaxe', 40, { kind: 'bag' }, 'starter-pickaxe'),
    gear('starter-axe:v1', 'Worn Axe', 41, { kind: 'bag' }, 'starter-axe'),
    gear('starter-sickle:v1', 'Worn Sickle', 42, { kind: 'bag' }, 'starter-sickle'),
    gear('e2e-comet', 'Cometfall Helm', 43, { kind: 'explorer', explorerId: 'vault:general-1' }),
  ];
  return {
    'godforge-realm-era': String(ERA),
    'godforge-inventory': { version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 50, legacyBackup: null, era: ERA },
    ...purse(1_000_000),
  };
}

const vault = (page: Page) => placePanel(page);
const tab = (page: Page, name: string) => vault(page).locator('.tab', { hasText: new RegExp(`^\\s*${name}\\b`) }).first();
const row = (page: Page, name: string) => vault(page).locator('.jl__row', { hasText: name }).first();
const primary = (page: Page) => vault(page).locator('.ab__btn').first();
const clasp = (page: Page) => page.locator('.satchel .clasp');

async function goldNow(page: Page): Promise<number> {
  return ((await blob<{ gold: number }>(page, 'godforge-economy'))?.gold) ?? -1;
}

async function tapSize(target: Locator): Promise<{ w: number; h: number }> {
  const box = (await target.boundingBox())!;
  return { w: box.width, h: box.height };
}

for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`the Vault at ${size.width}×${size.height}`, () => {
    test.describe.configure({ timeout: 150000 });

    test('a full satchel routes to the Vault; take out, buy a row, sort and search at the station', async ({ page }) => {
      await page.setViewportSize(size);
      await seed(page, fullSatchel());
      await openPlay(page);

      // The satchel shows its limit, plainly.
      await expect(clasp(page)).toHaveAttribute('aria-label', /Satchel, 40 of 40 slots/);
      await expect(clasp(page)).toContainText('40/40');

      // Mine the seam with a full satchel: the ore goes to the Vault, and the line says so.
      await walkTo(page, 480);
      await expect.poll(async () => {
        if (/sent to the Vault/.test(await messageLine(page).textContent() ?? '')) return true;
        await focusWorld(page);
        await page.keyboard.press('e');
        return false;
      }, { timeout: 45000, intervals: [700] }).toBe(true);
      await expect(messageLine(page)).toContainText('Satchel full — Cinder Ore sent to the Vault: General I tab.');
      await expect(clasp(page)).toContainText('40/40');

      // Walk to the Vault (west of the seam) and open it at its station.
      await walkTo(page, 330, 20);
      expect(Math.abs(await playerX(page) - 330)).toBeLessThanOrEqual(40);
      await focusWorld(page);
      await page.keyboard.press('e');
      await expect(vault(page)).toBeVisible({ timeout: 10000 });
      await expect(vault(page)).toContainText('Keep what you don\'t carry.');

      // General I holds the routed ore and the helm. Take out is refused while the satchel is full.
      await tab(page, 'General I').click();
      await expect(row(page, 'Cinder Ore')).toBeVisible();
      await row(page, 'Cometfall Helm').click();
      await expect(primary(page)).toContainText('Take out');
      await expect(primary(page)).toHaveAttribute('aria-disabled', 'true');
      await expect(vault(page).locator('.ab__why')).toContainText('Satchel full — make room first');

      // Make room: send a helm from the satchel to the Vault.
      await tab(page, 'Satchel').click();
      await row(page, 'Ashen Helm').click();
      await expect(primary(page)).toContainText('Send to Vault');
      await primary(page).click();
      await expect(vault(page).locator('.vs-announce')).toContainText('Ashen Helm went to your Vault');
      // The freed slot is taken straight back by the routed ore: stacks fill what instances leave.
      await expect(clasp(page)).toContainText('40/40');

      // Now Take out works.
      await tab(page, 'General I').click();
      await row(page, 'Cometfall Helm').click();
      await expect(primary(page)).not.toHaveAttribute('aria-disabled', 'true');
      await primary(page).click();
      await expect(vault(page).locator('.vs-announce')).toContainText('Cometfall Helm is back in your satchel.');
      await expect(clasp(page)).toContainText('40/40');

      // Buy 8 slots with Gold: the Satchel tab's one button, with its price.
      const before = await goldNow(page);
      await tab(page, 'Satchel').click();
      await expect(primary(page)).toContainText('Add 8 slots');
      await expect(primary(page)).toHaveAttribute('aria-label', /Add 8 slots — 200K Gold/);
      await primary(page).click();
      await expect(vault(page).locator('.vs-announce')).toContainText('Your satchel now holds 48.');
      // 40 pieces of gear, and the ore comes back out of the Vault into the new row.
      await expect(clasp(page)).toContainText('41/48');
      await expect.poll(() => goldNow(page)).toBeLessThanOrEqual(before - ROW_PRICE + 5_000);

      // Sort and search, on the satchel tab.
      await vault(page).locator('.vs-sort select').selectOption('name');
      // Stacks lead (the ore), then gear A→Z: Ashen Helm first, Worn Sickle last.
      await expect(vault(page).locator('.jl__row').first()).toContainText('Cinder Ore');
      await expect(vault(page).locator('.jl__row').nth(1)).toContainText('Ashen Helm');
      await expect(vault(page).locator('.jl__row').last()).toContainText('Worn Sickle');
      await vault(page).locator('.vs-search').fill('comet');
      await expect(vault(page).locator('.jl__row')).toHaveCount(1);
      await expect(vault(page).locator('.jl__row').first()).toContainText('Cometfall Helm');

      // Every control a thumb uses is at least 44 px.
      for (const target of [primary(page), tab(page, 'Satchel'), vault(page).locator('.vs-search'), vault(page).locator('.vs-sort select')]) {
        const { h } = await tapSize(target);
        expect(h, 'tap height').toBeGreaterThanOrEqual(44);
      }
      // Nothing was lost on the way: 37 helms + 3 tools + the Comet, the ore counted.
      type Ledger = { records: { kind: string; id: string; location?: { kind: string; explorerId?: string } }[] };
      const ledger = (await blob<Ledger>(page, 'godforge-inventory'))!;
      expect(ledger.records.filter(r => r.kind === 'instance')).toHaveLength(41);
      await page.screenshot({ path: `output/vault/vault-${size.width}x${size.height}.png` });
    });
  });
}
