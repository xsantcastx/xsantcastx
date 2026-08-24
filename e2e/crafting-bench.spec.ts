/**
 * crafting-bench.spec.ts — the bench, end to end.
 *
 * Three things are worth driving through a real browser rather than a unit
 * test, because all three are failures the unit tests cannot see:
 *
 *   1. The catalogue reaches the screen. A recipe wall built from pure data at
 *      construction is only useful if it survives SSR, hydration and the route
 *      chunk actually loading.
 *   2. The anvil gate holds. `Strike` must be disabled until every slot is
 *      loaded, and loading is what the drag-and-drop and the Load buttons both
 *      end in.
 *   3. A craft settles across four ledgers. The materials leave the bag, the
 *      Gold leaves the ledger, the item arrives with a rolled grade and the
 *      crafting level moves — and the only place all four are observable at
 *      once is the running app.
 *
 * The bag is seeded the way c9-first-loop.spec.ts seeds it, including the era
 * stamp: `applyRealmEra()` deletes `godforge-inventory` outright at boot unless
 * the stamp is already current, so a seed without it is wiped before the app
 * ever reads it. Keep `era` in step with INVENTORY_ERA in inventory.model.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

/** Craft the cheapest recipe on the bench: 6 Thornroot, 3 Verdant Sap, 2 Bark. */
const RECIPE_NAME = 'Briarvein Kris';
const INPUTS: readonly { key: string; quantity: number }[] = [
  { key: 'thornroot', quantity: 24 },
  { key: 'verdant-sap', quantity: 12 },
  { key: 'world-root-bark', quantity: 8 },
];

const LEDGER = {
  version: 2,
  records: INPUTS.map((row, i) => ({
    id: `stack:${row.key}`, definitionId: row.key, kind: 'stack',
    category: 'materials', tags: ['material', row.key], soulbound: false,
    acquiredAt: '2026-08-24T00:00:00.000Z',
    revision: { hlc: i + 1, deviceId: 'e2e', sequence: i + 1 },
    source: 'inventory', stackKey: row.key, location: { kind: 'bag' },
  })),
  tombstones: [],
  stackOps: INPUTS.map((row, i) => ({
    id: `seed:${row.key}`, stackKey: row.key, kind: 'grant', quantity: row.quantity,
    hlc: i + 1, deviceId: 'e2e', sequence: i + 1,
  })),
  goldFromSales: 0,
  sold: 0,
  hlc: INPUTS.length,
  legacyBackup: null,
  era: 55,
};

/** Enough Gold to pay the bench several times over. */
const ECONOMY = { version: 1, gold: 3_000_000, totalGoldEarned: 3_000_000, runGoldEarned: 3_000_000 };

async function open(page: Page): Promise<void> {
  await page.addInitScript(({ ledger, economy }) => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
    window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
    window.localStorage.setItem('godforge-realm-era', '55');
    window.localStorage.setItem('godforge-inventory', JSON.stringify(ledger));
    window.localStorage.setItem('godforge-economy', JSON.stringify(economy));
  }, { ledger: LEDGER, economy: ECONOMY });
  await page.goto('/forge/crafting', { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden')
      || style.visibility === 'hidden'
      || style.opacity === '0';
  }, { timeout: 8000 });
  await expect(page.locator('.cb-anvil')).toBeVisible();
}

test.describe('the crafting bench', () => {
  test('shows the whole catalogue, locked recipes included', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);

    // Every recipe is on the wall, including the ones the level gate refuses —
    // you cannot work toward something you cannot see.
    const cards = page.locator('.cb-card');
    await expect(cards).toHaveCount(await cards.count());
    expect(await cards.count()).toBeGreaterThanOrEqual(30);
    await expect(page.locator('.cb-card.is-locked').first()).toBeVisible();
    await expect(page.locator('.cb-card__lock').first()).toContainText(/Lvl/i);

    // Search narrows the wall.
    await page.getByPlaceholder('Search recipes and materials').fill('voidweave');
    await expect(cards).toHaveCount(1);
    await page.getByPlaceholder('Search recipes and materials').fill('');
    expect(await cards.count()).toBeGreaterThanOrEqual(30);
  });

  test('will not strike an anvil that has not been loaded', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);

    const strike = page.getByRole('button', { name: /Strike the anvil/ });
    await expect(strike).toBeDisabled();
    await expect(page.locator('.cb-blocker')).toContainText('Load every slot before you strike.');

    await page.getByRole('button', { name: 'Load the anvil' }).click();
    await expect(page.locator('.cb-slot.is-loaded')).toHaveCount(3);
    await expect(strike).toBeEnabled();

    // Clearing puts it back.
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(strike).toBeDisabled();
  });

  test('crafts, consumes, pays and moves the ladder', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);

    await expect(page.locator('.cb-out__name')).toHaveText(RECIPE_NAME);
    await expect(page.locator('.cb-ladder__stats')).toContainText('0 / 52');

    await page.getByRole('button', { name: 'Load the anvil' }).click();
    await page.getByRole('button', { name: /Strike the anvil/ }).click();

    // Briarvein Kris carries a three-second anvil beat, so the result panel is
    // the thing to wait on rather than a fixed timeout.
    const result = page.locator('.cb-result');
    await expect(result).toBeVisible({ timeout: 15_000 });
    await expect(result).toContainText(RECIPE_NAME);
    await expect(result).toContainText('It is in your bag.');

    // 24 - 6, 12 - 3, 8 - 2.
    await expect(page.locator('.cb-slot__count').nth(0)).toHaveText('18 / 6');
    await expect(page.locator('.cb-slot__count').nth(1)).toHaveText('9 / 3');
    await expect(page.locator('.cb-slot__count').nth(2)).toHaveText('6 / 2');

    // One craft, one recipe known, XP on the board, mastery counting.
    await expect(page.locator('.cb-ladder__stats')).toContainText('1 / 52');
    await expect(page.locator('.cb-ladder__stats')).toContainText('30');
    await expect(page.locator('.cb-mastery__line')).toContainText('1 / 10');

    const shotDir = resolve('test-results/crafting-bench');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.cb-anvil').screenshot({ path: resolve(shotDir, 'desktop-crafted.png') });
  });

  test('the ladder survives a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Load the anvil' }).click();
    await page.getByRole('button', { name: /Strike the anvil/ }).click();
    await expect(page.locator('.cb-result')).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('.cb-anvil')).toBeVisible();
    await expect(page.locator('.cb-ladder__stats')).toContainText('1 / 52');
  });

  test('375px and reduced motion stay usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);

    // No horizontal overflow, which is the site's hard rule for this width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Every standalone control clears the 44px minimum.
    const small = await page.evaluate(() =>
      Array.prototype.slice.call(document.querySelectorAll('.cb button, .cb select, .cb input, .cb a'))
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
        })
        .map(el => el.className || el.tagName),
    );
    expect(small).toEqual([]);

    await page.getByRole('button', { name: 'Load the anvil' }).click();
    await expect(page.getByRole('button', { name: /Strike the anvil/ })).toBeEnabled();

    const shotDir = resolve('test-results/crafting-bench');
    mkdirSync(shotDir, { recursive: true });
    await page.locator('.cb-anvil').screenshot({ path: resolve(shotDir, 'mobile-anvil.png') });
  });
});
