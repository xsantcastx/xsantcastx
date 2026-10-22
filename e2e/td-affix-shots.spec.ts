/**
 * td-affix-shots.spec.ts — every item belongs to its family, and its card says who it is for (docs/design/loot-and-combat.md
 * §3.6; owner 2026-10-22: "all weapons are giving spell damage? If im a warrior? … consistency in items").
 *
 * One piece of each family in the Satchel; the card names who it is favoured by, and greys the lines the Keeper's own
 * calling cannot use (D2's "unused"). An old sword's Spell Damage (rolled before families) reads as Martial Damage for a
 * fighter. Screenshots land in docs/handoff/cozy-ui/affix-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed } from './play-helpers';

function gear(id: string, definitionId: string, name: string, rarity: string, stats: Record<string, number>, i: number, itemLevel = 30): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity, soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats, sellValue: 1200 * (i + 1), econ: 3, location: { kind: 'bag' }, itemLevel,
  };
}

const ITEMS = [
  gear('a-staff', 'nullthorn-staff', 'Nullthorn Staff', 'legendary', { spellDamage: 21.2, castSpeed: 9.4, skillRanks: 2, mana: 40, critChance: 4.2 }, 0),
  gear('a-mace', 'rootbreaker-mace', 'Rootbreaker Mace', 'epic', { minDamage: 18, maxDamage: 35, attackDamage: 19.6, lifeLeech: 3.2, attackSpeed: 7.5 }, 1),
  gear('a-bow', 'meridian-longbow', 'Meridian Longbow', 'epic', { minDamage: 10, maxDamage: 20, attackDamage: 18.4, pierceChance: 9, critChance: 3.1 }, 2),
  gear('a-quiver', 'warden-quiver', "Canopy Warden's Quiver", 'rare', { attackDamage: 9.8, pierceChance: 8, fireResist: 11 }, 3),
  gear('a-shield', 'rootwall-shield', 'Rootwall Shield', 'rare', { defense: 31, blockChance: 10, coldResist: 12 }, 4),
  gear('a-ring', 'anchor-ring', 'Anchor Ring', 'legendary', { life: 58, spellDamage: 9.8, attackDamage: 10.2, goldFind: 12, allResist: 8 }, 5),
  gear('a-plate', 'starplate-cuirass', 'Starplate Cuirass', 'rare', { defense: 28, life: 30, fireResist: 12 }, 6),
  // Rolled before families (every weapon's implicit was Spell Damage): kept as written, never re-rolled.
  gear('a-old', 'eclipse-edge', 'Eclipse Edge', 'rare', { spellDamage: 17.6, critChance: 4.4 }, 7, 20),
];

async function open(page: Page, vocation: string): Promise<void> {
  const base = ledger({}) as { records: unknown[]; hlc: number };
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Aster', vocation, updatedAt: 1 },
    'godforge-inventory': { ...base, records: [...base.records, ...ITEMS], hlc: base.hlc + 200 },
  });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.keyboard.press('i');
  await expect(page.locator('button.pocket').first()).toBeVisible({ timeout: 10000 });
}

async function card(page: Page, name: string, shot: string) {
  const cell = page.locator(`button.pocket[aria-label^="${name}"]`).first();
  await cell.hover();
  const tip = page.locator('.d2tip');
  await expect(tip).toBeVisible();
  await page.waitForTimeout(250);
  const box = (await tip.boundingBox())!;
  await page.screenshot({ path: `docs/handoff/cozy-ui/affix-${shot}.jpg`, type: 'jpeg', quality: 82,
    clip: { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 44), width: Math.min(1280 - Math.max(0, box.x - 12), box.width + 24), height: Math.min(800 - Math.max(0, box.y - 44), box.height + 56) } });
  return tip;
}

test('an Ashguard reads his own: a blade is favoured by him, a staff greys its spell lines, a ring\'s Spell Damage is unused', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'ashguard');

  let tip = await card(page, 'Rootbreaker Mace', 'martial-mace');
  await expect(tip.locator('[data-tip-calling]')).toHaveText('Favoured by: Ashguard');
  await expect(tip.locator('[data-tip-calling]')).toHaveClass(/mine/);
  await expect(tip.locator('.d2tip__headline')).toContainText('+18–35 Damage');
  await expect(tip.locator('.d2tip__affixes li[data-stat="attackDamage"]')).toContainText('Martial Damage');
  await expect(tip.locator('.dim')).toHaveCount(0);

  tip = await card(page, 'Nullthorn Staff', 'caster-staff-as-ashguard');
  await expect(tip.locator('[data-tip-calling]')).toHaveText('Favoured by: Warlock, Lanternwright');
  await expect(tip.locator('.d2tip__headline')).toHaveClass(/dim/);
  await expect(tip.locator('.d2tip__affixes li[data-stat="castSpeed"]')).toHaveClass(/dim/);
  await expect(tip.locator('.d2tip__affixes li[data-stat="skillRanks"]')).toHaveClass(/dim/);
  await expect(tip.locator('.d2tip__affixes li[data-stat="critChance"]')).not.toHaveClass(/dim/);
  await expect(tip.locator('[data-tip-unused]')).toContainText('unused by your calling');

  tip = await card(page, 'Anchor Ring', 'jewel-ring-as-ashguard');
  await expect(tip.locator('[data-tip-calling]')).toHaveText('Worn by every calling');
  await expect(tip.locator('.d2tip__affixes li[data-stat="spellDamage"]')).toHaveClass(/dim/);
  await expect(tip.locator('.d2tip__affixes li[data-stat="attackDamage"]')).not.toHaveClass(/dim/);

  tip = await card(page, 'Rootwall Shield', 'shield');
  await expect(tip.locator('[data-tip-calling]')).toHaveText('Favoured by: Ashguard');
  await expect(tip.locator('.d2tip__affixes li[data-stat="blockChance"]')).toContainText('Block');

  tip = await card(page, 'Starplate Cuirass', 'armour');
  await expect(tip.locator('[data-tip-calling]')).toHaveText('Worn by every calling');

  // An old sword's Spell Damage (rolled before families) counts as Martial Damage for a fighter, and says so.
  tip = await card(page, 'Eclipse Edge', 'old-sword-as-ashguard');
  await expect(tip.locator('.d2tip__old')).toContainText('counts as Martial Damage for you');
  await expect(tip.locator('.dim')).toHaveCount(0);
});

test('a Thornstrider\'s bow and quiver are his; a Warlock sees the same ring\'s Martial Damage greyed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'thornstrider');
  let tip = await card(page, 'Meridian Longbow', 'bow');
  await expect(tip.locator('[data-tip-calling]')).toHaveText('Favoured by: Thornstrider');
  await expect(tip.locator('.d2tip__headline')).toContainText('+10–20 Damage');
  await expect(tip.locator('.d2tip__headline .d2tip__range')).toHaveText(/^\[\d+–\d+ \/ \d+–\d+\]$/);
  await expect(tip.locator('.dim')).toHaveCount(0);
  tip = await card(page, "Canopy Warden's Quiver", 'quiver');
  await expect(tip.locator('[data-tip-calling]')).toHaveText('Favoured by: Thornstrider');
  await expect(tip.locator('.d2tip__affixes li[data-stat="pierceChance"]')).not.toHaveClass(/dim/);
  // The mace's own damage rides the Ashguard's blade, not his arrow.
  tip = await card(page, 'Rootbreaker Mace', 'martial-mace-as-thornstrider');
  await expect(tip.locator('.d2tip__headline')).toHaveClass(/dim/);
  await expect(tip.locator('.d2tip__affixes li[data-stat="attackDamage"]')).not.toHaveClass(/dim/);

  await open(page, 'warlock');
  tip = await card(page, 'Anchor Ring', 'jewel-ring-as-warlock');
  await expect(tip.locator('.d2tip__affixes li[data-stat="attackDamage"]')).toHaveClass(/dim/);
  await expect(tip.locator('.d2tip__affixes li[data-stat="spellDamage"]')).not.toHaveClass(/dim/);
  tip = await card(page, 'Nullthorn Staff', 'caster-staff');
  await expect(tip.locator('[data-tip-calling]')).toHaveClass(/mine/);
  await expect(tip.locator('.dim')).toHaveCount(0);
  // The old sword is plain Spell Damage for a caster.
  tip = await card(page, 'Eclipse Edge', 'old-sword-as-warlock');
  await expect(tip.locator('.d2tip__old')).toHaveCount(0);
});
