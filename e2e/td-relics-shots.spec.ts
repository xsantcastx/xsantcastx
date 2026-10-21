/**
 * td-relics-shots.spec.ts — the bosses' own uniques and the two common spells (design-bible §4.6, §5.5, §7.2; roadmap
 * §10 items 6 and 9): every boss unique's card says what it does and where it is found; the Seek points with Glim's
 * words and pixel arrows (desktop and a phone); Light widens the Keeper's own light at night. Screenshots land in
 * docs/handoff/cozy-ui/relics-*.jpg. Nothing here asserts on a fight's outcome.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

const canvas = (page: Page) => page.locator('canvas').first();
const OUT = 'docs/handoff/cozy-ui';

// The eight, as a boss leaves them (gold, at the boss's level), with a roll of the slot's affixes each.
const RELICS: [string, string, number, Record<string, number>][] = [
  ['unique-wardens-last-ember', "Warden's Last Ember", 8, { life: 14, fireResist: 9, allResist: 4, mana: 8, critChance: 2.1 }],
  ['unique-tyrants-crucible', "Tyrant's Crucible", 20, { defense: 22, spellDamage: 9.4, fireResist: 12, life: 19, manaRegen: 1.1 }],
  ['unique-hammer-first-watch', 'Hammer of the First Watch', 18, { spellDamage: 13.2, critChance: 3.4, castSpeed: 6.1, mana: 21, magicFind: 7 }],
  ['unique-ashbone-phylactery', 'Ashbone Phylactery', 25, { life: 38, allResist: 7, coldResist: 11, lifeRegen: 1.4, xpBonus: 3 }],
  ['unique-crown-banked-coal', 'Crown of the Banked Coal', 30, { defense: 31, spellDamage: 12.8, fireResist: 15, life: 33, critChance: 2.8 }],
  ['unique-mossbound-heart', 'Mossbound Heart', 34, { defense: 40, life: 52, lifeRegen: 2.2, coldResist: 14, magicFind: 8 }],
  ['unique-splinterbow-rootcradle', 'Splinterbow of the Rootcradle', 40, { spellDamage: 19.6, castSpeed: 8.2, critChance: 4.1, mana: 37, xpBonus: 5 }],
  ['unique-abbess-censer', "The Abbess's Censer", 50, { defense: 48, spellDamage: 21, manaRegen: 2.6, arcaneResist: 17, life: 61 }],
];

function relic(i: number): unknown {
  const [definitionId, name, itemLevel, stats] = RELICS[i];
  return {
    id: `relic-${i}`, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'legendary', soulbound: false,
    acquiredAt: '2026-10-21T00:00:00.000Z', revision: { hlc: 300 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats, sellValue: 4000 + 500 * i, econ: 3, location: { kind: 'bag' }, itemLevel,
  };
}

/** Underground: the Ember Mine's first floor by its ladder (dark: lit only by torches, the Keeper and Glim). */
const IN_MINE = { 'eclipse-play-world-v1': { td: { continent: 'ember-isle', level: 'ember-mine-1', x: 184, y: 250 } } };

/** A Keeper at level 13 who knows the Seek (and Light, free) with both on the bar, in the square at `hour`. */
async function open(page: Page, size: { width: number; height: number }, hour = 12, items: unknown[] = [], extra: Record<string, unknown> = {}): Promise<void> {
  await page.setViewportSize(size);
  const base = ledger({}) as { records: unknown[]; hlc: number };
  await seed(page, {
    'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), ...activity({ hunting: xpForLevel(13) }),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, bar: ['seek', 'light', 'drain-life', 'hellfire-nova'], aura: 'aura-embers', tree: { spent: {}, free: ['seek'], at: 1 } },
    ...(items.length ? { 'godforge-inventory': { ...base, records: [...base.records, ...items], hlc: base.hlc + 400 } } : {}),
    ...extra,
  });
  await page.goto(`/play?td=1&hour=${hour}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}

/** Lay screenshots side by side on a plain page and photograph the row (a lineup, a before/after). */
async function lineup(page: Page, shots: Buffer[], cols: number, path: string, labels: string[] = []): Promise<void> {
  const cells = shots.map((b, i) => `<figure><img src="data:image/png;base64,${b.toString('base64')}">${labels[i] ? `<figcaption>${labels[i]}</figcaption>` : ''}</figure>`).join('');
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.setContent(`<!doctype html><style>
    body { margin: 0; background: #1a1220; font: 600 14px/1.3 system-ui, sans-serif; color: #f3e7cf; }
    main { display: grid; grid-template-columns: repeat(${cols}, max-content); gap: 14px; padding: 16px; align-items: start; }
    figure { margin: 0; } img { display: block; } figcaption { padding: 6px 2px 0; text-align: center; }
  </style><main>${cells}</main>`);
  await page.waitForLoadState('load');
  const box = (await page.locator('main').boundingBox())!;
  await page.screenshot({ path, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: Math.ceil(box.width), height: Math.ceil(box.height) } });
}

test('the eight boss uniques: each card names its signature (Used for) and its boss and odds (Found in)', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page, { width: 1280, height: 1400 }, 12, RELICS.map((_, i) => relic(i)));
  await page.waitForTimeout(1500);
  await canvas(page).focus();
  await page.keyboard.press('i');
  const shots: Buffer[] = [];
  for (const [, name] of RELICS) {
    const cell = page.locator(`button.pocket[aria-label^="${name}"]`).first();
    await expect(cell).toBeVisible({ timeout: 10000 });
    await cell.hover();
    const card = page.locator('.d2tip').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-rarity', 'legendary');
    await expect(card.locator('.d2tip__special')).toContainText('Used for:');
    await expect(card.locator('.d2tip__special')).toContainText('Found in:');
    await expect(card.locator('.d2tip__special')).toContainText(/\(1 in (6|7|8|9|10)\)/);
    await page.waitForTimeout(150);
    shots.push(await card.screenshot());
  }
  expect(errors).toEqual([]);
  await lineup(page, shots, 4, `${OUT}/relics-uniques.jpg`);
});

for (const [name, size] of Object.entries({ desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } })) {
  test(`the Seek: Glim points at the nearest boss with words and pixel arrows (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, size, 12);
    await page.waitForTimeout(6000);   // the place's title card fades
    await canvas(page).focus();
    // The bar: the Seek on key 1 (its words, lum vesh, are the same spell typed).
    await expect(page.locator('.td-skill').first()).toHaveAttribute('aria-label', /Seek/);
    await page.keyboard.press('1');
    // From the Seamworks square the nearest boss is the Ember Warden, three floors down the mine; Glim has not met it.
    const toast = page.locator('.td-toast');
    await expect(toast).toContainText('Glim:', { timeout: 5000 });
    await expect(toast).toContainText(/Something great is (near|far|very far) to the (north|south|east|west|north-east|north-west|south-east|south-west), below you\./);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/relics-seek-${name}.jpg`, type: 'jpeg', quality: 85 });
    // Spent: the key cools.
    await expect(page.locator('.td-skill').first()).toHaveClass(/td-skill--cool/);
    expect(errors).toEqual([]);
  });
}

test('Light: the Keeper\'s own light reaches further in the dark (the Ember Mine)', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page, { width: 1280, height: 800 }, 23, [], IN_MINE);
  await expect(canvas(page)).toHaveAttribute('data-area', /Ember Mine/i, { timeout: 15000 });
  await page.waitForTimeout(6000);
  await canvas(page).focus();
  const box = (await canvas(page).boundingBox())!;
  const clip = { x: Math.round(box.x + box.width / 2 - 260), y: Math.round(box.y + box.height / 2 - 200), width: 520, height: 360 };
  const before = await page.screenshot({ clip });
  await expect(page.locator('.td-skill').nth(1)).toHaveAttribute('aria-label', /Light/);
  await page.keyboard.press('2');
  await expect(page.locator('.td-skill').nth(1)).toHaveClass(/td-skill--cool/, { timeout: 3000 });
  await page.waitForTimeout(1600);   // the pillar of the cast settles
  const after = await page.screenshot({ clip });
  expect(after.equals(before)).toBe(false);
  expect(errors).toEqual([]);
  await lineup(page, [before, after], 2, `${OUT}/relics-light.jpg`, ['The Ember Mine, no Light', 'Light (lum): +3 tiles for 5 minutes']);
});
