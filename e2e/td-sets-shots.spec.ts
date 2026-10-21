/**
 * td-sets-shots.spec.ts — the four item sets (design-bible §7.4): a piece's card lists the set, each piece (greyed when
 * not worn) and each tier (lit when the worn count wakes it). Screenshots land in docs/handoff/cozy-ui/sets-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

const canvas = (page: Page) => page.locator('canvas').first();
const OUT = 'docs/handoff/cozy-ui';

type Piece = [id: string, name: string, slot: string, stats: Record<string, number>];
const SETS: Record<string, Piece[]> = {
  ossuary: [
    ['set-ossuary-helm', 'Ossuary Helm', 'head', { defense: 21, life: 26, fireResist: 8, castSpeed: 3, magicFind: 6 }],
    ['set-ossuary-hauberk', 'Ossuary Hauberk', 'chest', { defense: 34, life: 40, coldResist: 9, lifeRegen: 1.2, allResist: 3 }],
    ['set-ossuary-bulwark', 'Ossuary Bulwark', 'off-hand', { defense: 29, fireResist: 14, life: 22, manaRegen: 0.8, critChance: 1.5 }],
    ['set-ossuary-boots', 'Ossuary Boots', 'feet', { defense: 18, moveSpeed: 9, life: 17, coldResist: 6, mana: 9 }],
  ],
  abbey: [
    ['set-abbey-hood', 'Abbey Hood', 'head', { spellDamage: 14, mana: 28, arcaneResist: 9, defense: 12, castSpeed: 4 }],
    ['set-abbey-robe', 'Drowned Robe', 'chest', { spellDamage: 17, manaRegen: 1.6, defense: 22, life: 30, arcaneResist: 12 }],
    ['set-abbey-censer-chain', 'Censer-Chain', 'trinket', { mana: 36, allResist: 7, life: 24, manaRegen: 1.1, xpBonus: 3 }],
    ['set-abbey-sandals', 'Abbey Sandals', 'feet', { moveSpeed: 8, mana: 21, defense: 11, coldResist: 7, lifeRegen: 0.7 }],
  ],
  rootcradle: [
    ['set-rootcradle-circlet', 'Rootcradle Circlet', 'head', { life: 34, lifeRegen: 1.3, defense: 15, coldResist: 8, mana: 12 }],
    ['set-rootcradle-wrap', 'Rootcradle Wrap', 'chest', { life: 48, defense: 28, lifeRegen: 1.1, fireResist: 10, allResist: 3 }],
    ['set-rootcradle-bracers', 'Rootcradle Bracers', 'hands', { castSpeed: 8, lifeRegen: 1.4, defense: 13, life: 22, critChance: 2.2 }],
    ['set-rootcradle-greaves', 'Rootcradle Greaves', 'legs', { life: 36, defense: 24, coldResist: 11, lifeRegen: 0.9, moveSpeed: 3 }],
  ],
  lamplighter: [
    ['set-lamplighter-lantern', "Lamplighter's Lantern", 'off-hand', { mana: 32, manaRegen: 1.8, defense: 14, life: 20, magicFind: 9 }],
    ['set-lamplighter-coat', "Lamplighter's Coat", 'chest', { defense: 26, life: 38, arcaneResist: 10, lifeRegen: 1.0, xpBonus: 4 }],
    ['set-lamplighter-gloves', "Lamplighter's Gloves", 'hands', { castSpeed: 7, critChance: 3.1, defense: 12, mana: 18, spellDamage: 6 }],
    ['set-lamplighter-signet', "Lamplighter's Ring", 'trinket', { allResist: 8, life: 30, mana: 19, magicFind: 7, goldFind: 5 }],
  ],
};
/** How many of each set the Keeper wears; the rest wait in the satchel. */
const WORN: Record<string, number> = { ossuary: 2, abbey: 3, rootcradle: 4, lamplighter: 1 };

function row(p: Piece, n: number, worn: boolean): unknown {
  return {
    id: `set-${p[0]}`, definitionId: p[0], kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'mythic', soulbound: false,
    acquiredAt: '2026-10-21T00:00:00.000Z', revision: { hlc: 500 + n, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name: p[1], type: 'artifact', stats: p[3], sellValue: 9000 + 100 * n, econ: 4,
    location: worn ? { kind: 'equipped', slotId: p[2] } : { kind: 'bag' }, itemLevel: 40,
  };
}

async function open(page: Page, items: unknown[]): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 1400 });
  const base = ledger({}) as { records: unknown[]; hlc: number };
  await seed(page, {
    'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), ...activity({ hunting: xpForLevel(40) }),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, bar: ['drain-life', 'ember-curse', 'hellfire-nova', 'dark-ward'], aura: 'aura-embers', tree: { spent: {}, free: [], at: 1 } },
    'godforge-inventory': { ...base, records: [...base.records, ...items], hlc: base.hlc + 600 },
  });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}

async function lineup(page: Page, shots: Buffer[], cols: number, path: string): Promise<void> {
  const cells = shots.map(b => `<figure><img src="data:image/png;base64,${b.toString('base64')}"></figure>`).join('');
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.setContent(`<!doctype html><style>
    body { margin: 0; background: #1a1220; } main { display: grid; grid-template-columns: repeat(${cols}, max-content); gap: 14px; padding: 16px; align-items: start; }
    figure { margin: 0; } img { display: block; }
  </style><main>${cells}</main>`);
  await page.waitForLoadState('load');
  const box = (await page.locator('main').boundingBox())!;
  await page.screenshot({ path, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: Math.ceil(box.width), height: Math.ceil(box.height) } });
}

test('the four sets: each card lists its pieces (grey unless worn) and lights the tiers the worn count wakes', async ({ page }) => {
  test.setTimeout(240000);
  const shots: Buffer[] = [];
  // One Keeper per set (a slot holds one piece, so two sets cannot be worn at once): its pieces, `WORN` of them on.
  for (const [key, pieces] of Object.entries(SETS)) {
    const p = await page.context().newPage();
    const errors: string[] = [];
    p.on('pageerror', e => errors.push(e.message));
    await open(p, pieces.map((pc, i) => row(pc, i, i < WORN[key])));
    await p.waitForTimeout(1500);
    await canvas(p).focus();
    await p.keyboard.press('i');
    // The first piece in the satchel (or, for a full set, the first worn one) shows the card.
    const worn = WORN[key], pick = worn >= pieces.length ? pieces[0] : pieces[worn];
    const target = worn >= pieces.length ? p.locator(`button.well[data-slot="${pick[2]}"]`).first() : p.locator(`button.pocket[aria-label^="${pick[1]}"]`).first();
    await expect(target).toBeVisible({ timeout: 10000 });
    await target.hover();
    const card = p.locator('.d2tip').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-rarity', 'mythic');
    const set = card.locator('[data-tip-set]');
    await expect(set).toContainText(`(${worn}/${pieces.length})`);
    await expect(set.locator('li[data-piece].on')).toHaveCount(worn);
    // Tiers lit: none at one piece, 2 at two, 2 and 3 at three, all three at the full set.
    await expect(set.locator('[data-tier].on')).toHaveCount(worn < 2 ? 0 : worn === 2 ? 1 : worn === 3 ? 2 : 3);
    await expect(set).toContainText('Found in:');
    await expect(set).toContainText('Used for:');
    await p.waitForTimeout(150);
    shots.push(await card.screenshot());
    expect(errors).toEqual([]);
    await p.close();
  }
  await lineup(page, shots, 4, `${OUT}/sets-cards.jpg`);
});
