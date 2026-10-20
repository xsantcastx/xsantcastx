/**
 * td-item-card-shots.spec.ts — the hover card framed by rarity (owner 2026-10-20, docs/design/refs/cozy/top-heroes-items.jpg):
 * a piece of each rarity in the Satchel; hovering one shows its card in that rarity's colour, with its headline stat,
 * its affixes and its worth. Screenshots land in docs/handoff/cozy-ui/item-card-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed } from './play-helpers';

function gear(id: string, definitionId: string, name: string, rarity: string, stats: Record<string, number>, i: number, extra: Record<string, unknown> = {}): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity, soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats, sellValue: 1200 * (i + 1), econ: 3, location: { kind: 'bag' }, ...extra,
  };
}

// Every item is a roll (docs/design/loot-and-combat.md §3): an item level, the slot's implicit and affixes, each
// shown beside the range it could roll ([min–max]); the Starplate's grades are all ≥ 95%, so it reads Perfect.
const ITEMS = [
  gear('i-leg', 'nullthorn-staff', 'Nullthorn Staff', 'legendary', { spellDamage: 21.2, mana: 52, castSpeed: 11.3, critChance: 4.9, manaRegen: 2.1, magicFind: 12 }, 0, { upgradeLevel: 2, itemLevel: 30 }),
  gear('i-epic', 'cindergnaw', 'Cindergnaw', 'epic', { spellDamage: 14.1, critChance: 3.6, mana: 22, castSpeed: 8 }, 1, { itemLevel: 18 }),
  gear('i-rare', 'starplate-cuirass', 'Starplate Cuirass', 'rare', { defense: 18, life: 23, lifeRegen: 1.1, magicFind: 5 }, 2,
    { itemLevel: 12, rollQuality: { defense: 0.97, life: 0.98, lifeRegen: 0.96, magicFind: 0.99 } }),
  gear('i-common', 'voidweave-cowl', 'Voidweave Cowl', 'common', { defense: 6 }, 3, { itemLevel: 4 }),
  // Resists (§6): a legendary ring at item level 30 — Life, three elements and All Resist, each with its range.
  gear('i-res', 'anchor-ring', 'Anchor Ring', 'legendary', { life: 58, fireResist: 17, coldResist: 14, arcaneResist: 15, allResist: 9 }, 4, { itemLevel: 30 }),
];

async function open(page: Page): Promise<void> {
  const base = ledger({ 'cinder-ore': 4 }) as { records: unknown[]; hlc: number };
  await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'godforge-inventory': { ...base, records: [...base.records, ...ITEMS], hlc: base.hlc + 200 } });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}

test('the hover card wears its rarity: legendary orange, epic purple, rare blue, common plain, a material in cream', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await page.keyboard.press('i');
  const pockets = page.locator('button.pocket');
  await expect(pockets.first()).toBeVisible({ timeout: 10000 });
  const names = [['Nullthorn', 'legendary'], ['Cindergnaw', 'epic'], ['Starplate', 'rare'], ['Voidweave', 'common'], ['Cinder Ore', 'material']] as const;
  for (const [name, rarity] of names) {
    const cell = page.locator(`button.pocket[aria-label^="${name}"]`).first();
    await cell.hover();
    const card = page.locator('.d2tip');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-rarity', rarity);
    // Gear shows the range each roll could land in beside it; the material does not.
    if (rarity !== 'material') {
      await expect(card.locator('.d2tip__range').first()).toBeVisible();
      await expect(card).toContainText('[');
    }
    if (rarity === 'rare') await expect(card.locator('.d2tip__tag')).toHaveText(/Perfect/i);
    const box = (await card.boundingBox())!;
    await page.screenshot({ path: `docs/handoff/cozy-ui/item-card-${rarity}.jpg`, type: 'jpeg', quality: 80,
      clip: { x: Math.max(0, box.x - 120), y: Math.max(0, box.y - 60), width: Math.min(1280 - Math.max(0, box.x - 120), box.width + 200), height: Math.min(800 - Math.max(0, box.y - 60), box.height + 100) } });
  }
});

test('a click pins the same small card beside the item, with its actions — never the big panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await page.keyboard.press('i');
  const cell = page.locator('button.pocket[aria-label^="Cindergnaw"]').first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await cell.click();
  const card = page.locator('.d2tip--pinned');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-rarity', 'epic');
  await expect(card.locator('.d2tip__actions button').first()).toBeVisible();
  await expect(page.locator('.slip')).toHaveCount(0);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/item-card-pinned.jpg', type: 'jpeg', quality: 80 });
  await card.locator('.d2tip__close').click();
  await expect(card).toHaveCount(0);
});

test('a resist ring shows each resist in its element\'s pip, with the range it rolled in', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await page.keyboard.press('i');
  const cell = page.locator('button.pocket[aria-label^="Anchor Ring"]').first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await cell.hover();
  const card = page.locator('.d2tip');
  await expect(card).toBeVisible();
  for (const [key, text] of [['fireResist', '+17% Fire Resist'], ['coldResist', '+14% Cold Resist'], ['arcaneResist', '+15% Arcane Resist'], ['allResist', '+9% All Resist']] as const) {
    const row = card.locator(`.d2tip__affixes li[data-stat="${key}"]`);
    await expect(row).toContainText(text);
    await expect(row.locator('.d2tip__range')).toHaveText(key === 'allResist' ? '[8–11]' : '[13–19]');
  }
  const box = (await card.boundingBox())!;
  await page.screenshot({ path: 'docs/handoff/cozy-ui/item-card-resists.jpg', type: 'jpeg', quality: 80,
    clip: { x: Math.max(0, box.x - 120), y: Math.max(0, box.y - 60), width: Math.min(1280 - Math.max(0, box.x - 120), box.width + 200), height: Math.min(800 - Math.max(0, box.y - 60), box.height + 100) } });
});
