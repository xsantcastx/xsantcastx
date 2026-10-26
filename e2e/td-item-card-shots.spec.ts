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

async function open(page: Page, items: unknown[] = ITEMS, stacks: Record<string, number> = { 'cinder-ore': 4 }): Promise<void> {
  const base = ledger(stacks) as { records: unknown[]; hlc: number };
  await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'godforge-inventory': { ...base, records: [...base.records, ...items], hlc: base.hlc + 200 } });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}

// A loot pile across the bases, rarities and realms (owner 2026-10-21: "they all are looking the same"): each piece is
// painted from its base, realm, rarity and its own instance id (src/app/shared/art/gear-icons.ts).
const PILE = [
  gear('p-staff', 'nullthorn-staff', 'Nullthorn Staff', 'legendary', { spellDamage: 20 }, 0, { itemLevel: 30 }),
  gear('p-dagger', 'cindergnaw', 'Cindergnaw', 'epic', { spellDamage: 12 }, 1, { itemLevel: 18 }),
  gear('p-plate', 'starplate-cuirass', 'Starplate Cuirass', 'rare', { defense: 18 }, 2, { itemLevel: 12 }),
  gear('p-hood', 'voidweave-cowl', 'Voidweave Cowl', 'common', { defense: 6 }, 3, { itemLevel: 4 }),
  gear('p-ring', 'anchor-ring', 'Anchor Ring', 'legendary', { life: 50 }, 4, { itemLevel: 30 }),
  gear('p-great', 'dawnrender', 'Dawnrender', 'mythic', { strikePower: 30 }, 5, { itemLevel: 40 }),
  gear('p-mace', 'rootbreaker-mace', 'Rootbreaker Mace', 'uncommon', { strikePower: 9 }, 6, { itemLevel: 8 }),
  gear('p-bow', 'meridian-longbow', 'Meridian Longbow', 'rare', { strikePower: 14 }, 7, { itemLevel: 14 }),
  gear('p-helm', 'forgeborn-warhelm', 'Forgeborn Warhelm', 'epic', { defense: 15 }, 8, { itemLevel: 20 }),
  gear('p-crown', 'crown-of-the-first-dawn', 'Crown of the First Dawn', 'legendary', { defense: 12 }, 9, { itemLevel: 26 }),
  gear('p-boots', 'astral-striders', 'Astral Striders', 'uncommon', { moveSpeed: 4 }, 10, { itemLevel: 9 }),
  gear('p-shield', 'rootwall-shield', 'Rootwall Shield', 'rare', { defense: 14 }, 11, { itemLevel: 15 }),
  gear('p-spear', 'radiant-halberd', 'Radiant Halberd', 'epic', { strikePower: 22 }, 12, { itemLevel: 22 }),
  gear('p-axe', 'unique-worldsplitter', 'Worldsplitter', 'singular', { strikePower: 40 }, 13, { itemLevel: 45 }),
  gear('p-amulet', 'astral-pendant', 'Astral Pendant', 'epic', { mana: 30 }, 14, { itemLevel: 24 }),
];

test('a loot pile reads as a loot game: every base its own picture, dressed by its rarity and realm', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, PILE, {});
  await page.keyboard.press('i');
  // The pile, in the grid or on its no-room strip (15 big pieces and the starter tools overfill a 10×6 satchel).
  const pockets = page.locator('#satchel-book button.pocket[data-ids^="p-"]');
  await expect(pockets).toHaveCount(15, { timeout: 10000 });
  // Every cell shows a 32-px painted icon, and no two cells share one.
  const srcs = await page.locator('#satchel-book button.pocket[data-ids^="p-"] img').evaluateAll(imgs => imgs.map(i => (i as HTMLImageElement).src));
  expect(srcs.length).toBe(15);
  expect(new Set(srcs).size).toBe(15);
  for (const src of srcs) expect(decodeURIComponent(src)).toContain('viewBox="0 0 32 32"');
  // Let the window finish opening (it fades in over the world) before the picture.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(900);
  const grid = (await page.locator('.satchel-grid').first().boundingBox())!;
  await page.screenshot({ path: 'docs/handoff/cozy-ui/item-icons-grid.jpg', type: 'jpeg', quality: 85,
    clip: { x: grid.x - 6, y: grid.y - 6, width: grid.width + 12, height: grid.height + 12 } });
});

test('a piece above the Keeper says what it needs in red, and Equip is shut with the reason', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, PILE, {});
  await page.keyboard.press('i');
  const cell = page.locator('button.pocket[aria-label^="Nullthorn"]').first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await cell.hover();
  const tip = page.locator('.d2tip');
  await expect(tip.locator('.d2tip__reqs p.unmet').first()).toHaveText('Requires Level 27');
  await expect(tip.locator('.d2tip__reqs p.unmet').nth(1)).toHaveText('Requires 13 Spirit');
  await cell.click();
  const card = page.locator('.d2tip--pinned');
  await expect(card).toBeVisible();
  const equip = card.locator('.d2tip__actions button.wear').first();
  await expect(equip).toBeDisabled();
  await expect(card.locator('.d2tip__why')).toContainText('level 27');
  // The paper doll is untouched.
  await expect(page.locator('button.pocket[aria-label^="Nullthorn"]')).toHaveCount(1);
  const box = (await card.boundingBox())!;
  await page.screenshot({ path: 'docs/handoff/cozy-ui/item-card-req.jpg', type: 'jpeg', quality: 85,
    clip: { x: Math.max(0, box.x - 140), y: Math.max(0, box.y - 40), width: Math.min(1280 - Math.max(0, box.x - 140), box.width + 180), height: Math.min(800 - Math.max(0, box.y - 40), box.height + 80) } });
});

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

test('on a phone, a long item card keeps Equip on screen: a bottom sheet that scrolls, the actions stuck to its foot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.keyboard.press('i');
  const cell = page.locator('button.pocket[aria-label^="Nullthorn"]').first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await cell.click();
  const card = page.locator('.d2tip--pinned');
  await expect(card).toBeVisible();
  const equip = card.locator('.d2tip__actions button').first();
  await expect(equip).toBeInViewport();
  const box = (await equip.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.d2tip__actions') != null, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit, 'the Equip button takes its own tap').toBe(true);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/item-card-phone.jpg', type: 'jpeg', quality: 80 });
});
