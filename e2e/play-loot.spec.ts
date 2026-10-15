/**
 * play-loot.spec.ts — loot & combat, played (docs/design/loot-and-combat.md):
 * a kill drops a seeded rare that shines with its rung's beam and name plate,
 * and a tap on the plate picks it up; a worn aura word puts its ring under the
 * Keeper and marks the creatures inside it; the loot filter hides commons.
 * Desktop and phone sizes.
 *
 *   PW_PORT=4541 npx playwright test e2e/play-loot.spec.ts --project=chromium
 *   LOOT_SHOTS=1 …  also writes the handoff screenshots to output/loot-and-combat/
 *
 * The loot seed is the player's own (godforge-loot): the spec finds, with the
 * game's own pure roller, a seed whose first kill drops what it wants, and
 * seeds the save with it — nothing in the game is mocked.
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import { blob, canvas, ERA, focusWorld, openPlay, playerX, seed, walkTo } from './play-helpers';
import { INVENTORY_ERA } from '../src/app/shared/rpg/inventory.model';
import { rollCreatureLoot, type LootDrop } from '../src/app/shared/loot/drop-tables';
import { hashSeed, seededRandom } from '../src/app/shared/loot/champions';
import { RUNE_TIERS } from '../src/app/shared/rune-forge/rune.model';
import type { DifficultyTier } from '../src/app/shared/loot/difficulty.model';

const SHOTS = process.env['LOOT_SHOTS'] ? 'output/loot-and-combat' : '';
async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

const BEACON_LIT = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };

/** The first loot seed whose first kill of a Rivet Maw (at `level`, on `tier`) drops what `want` asks. */
function seedFor(want: (drops: LootDrop[]) => boolean, tier: DifficultyTier = 'normal', level = 1): number {
  for (let s = 1; s < 200_000; s++) {
    const drops = rollCreatureLoot({ creature: 'rivet-maw', level, tier, magicFind: 0, rank: 'normal' }, seededRandom(hashSeed(`${s}|kill|1`)));
    if (want(drops)) return s;
  }
  throw new Error('no seed');
}

function lootBlob(seedValue: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { 'godforge-loot': { version: 1, filter: 'all', aura: null, tier: 'normal', unlocked: ['normal'], seed: seedValue, purse: null, rolls: 0, updatedAt: 1, purseAt: 0, ...extra } };
}

/** An inventory with gear worn: each piece an instance record in its slot. */
function wornGear(pieces: { id: string; definitionId: string; name: string; rarity: string; slotId: string; stats: Record<string, number>; sockets?: string[] }[]): Record<string, unknown> {
  return {
    'godforge-realm-era': String(ERA),
    'godforge-inventory': {
      version: 2, era: INVENTORY_ERA,
      records: pieces.map((g, i) => ({
        id: g.id, definitionId: g.definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: g.rarity, soulbound: false,
        acquiredAt: '2026-10-14T00:00:00.000Z', revision: { hlc: 1, deviceId: 'e2e', sequence: i + 1 }, source: 'inventory',
        name: g.name, type: 'artifact', stats: g.stats, sellValue: 50, location: { kind: 'equipped', slotId: g.slotId },
        ...(g.sockets ? { sockets: g.sockets } : {}),
      })),
      tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
    },
  };
}

async function toQuarry(page: Page, blobs: Record<string, unknown>): Promise<void> {
  await seed(page, { ...BEACON_LIT, ...blobs });
  await openPlay(page);
  await page.getByRole('button', { name: 'Places' }).first().click();
  await page.locator('#places-list button', { hasText: 'East Passage' }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry', { timeout: 60000 });
  await page.waitForTimeout(500);
  await focusWorld(page);
}

/** Kills this session (the canvas's data-kills: the satchel tally is folded away on a phone). */
async function kills(page: Page): Promise<number> {
  return Number((await canvas(page).getAttribute('data-kills')) ?? 0);
}

/** Swing until the first Maw falls (stepping when the swings stop landing). */
async function huntOne(page: Page): Promise<void> {
  await walkTo(page, 1100, 40);
  let dir: 'd' | 'a' = 'd', moves = 0;
  for (let i = 0; i < 260 && (await kills(page)) === 0; i++) {
    await page.keyboard.press('j');
    await page.waitForTimeout(160);
    if (i % 4 === 3) {
      await page.keyboard.down(dir); await page.waitForTimeout(150); await page.keyboard.up(dir);
      if (++moves % 12 === 0) dir = dir === 'd' ? 'a' : 'd';
    }
  }
  expect(await kills(page), 'the Maw never fell').toBeGreaterThanOrEqual(1);
}

const drops = (page: Page) => canvas(page).getAttribute('data-loot-drops').then(v => v ?? '');

for (const size of ['desktop', 'phone'] as const) {
  test.describe(`Loot & combat (${size})`, () => {
    test.describe.configure({ timeout: 240000 });
    if (size === 'phone') test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => { if (!localStorage.getItem('preferred-language')) localStorage.setItem('preferred-language', 'en'); });
    });

    test('a kill drops a seeded rare: its beam and plate shine blue, and a tap on the plate picks it up', async ({ page }) => {
      const s = seedFor(d => d.some(x => x.kind === 'item' && x.rarity === 'rare'));
      await toQuarry(page, lootBlob(s));
      await huntOne(page);
      await expect.poll(() => drops(page), { timeout: 8000 }).toMatch(/(rare|unique):1/);
      const rare = RUNE_TIERS.rare.color;
      await expect.poll(async () => (await canvas(page).getAttribute('data-loot-labels')) ?? '', { timeout: 8000 }).toContain(rare);
      // Step back from it (gear waits to be taken; walking over it does not), then look.
      await walkTo(page, (await playerX(page)) - 240, 40);
      await page.waitForTimeout(600);
      expect(await drops(page)).toMatch(/(rare|unique):1/);
      await shot(page, `beam-rare-${size}`);
      // Tap the blue plate: out of reach, the Keeper walks to it and takes it.
      const labels = (await canvas(page).getAttribute('data-loot-labels')) ?? '';
      const at = labels.split(' ').find(l => l.startsWith(rare))!.split('@')[1].split(',').map(Number);
      const box = (await canvas(page).boundingBox())!;
      await page.mouse.click(box.x + at[0], box.y + at[1]);
      await expect.poll(() => drops(page), { timeout: 20000 }).not.toMatch(/rare:1/);
      const want = rollCreatureLoot({ creature: 'rivet-maw', level: 1, tier: 'normal', magicFind: 0, rank: 'normal' }, seededRandom(hashSeed(`${s}|kill|1`)))
        .find(x => x.kind === 'item' && x.rarity === 'rare') as Extract<LootDrop, { kind: 'item' }>;
      await expect.poll(async () => {
        const inv = await blob<{ records: { definitionId?: string; rarity?: string }[] }>(page, 'godforge-inventory');
        return inv?.records.some(r => r.definitionId === want.definitionId && r.rarity === 'rare') ?? false;
      }, { timeout: 8000 }).toBe(true);
    });

    test('a worn aura word puts Conviction under the Keeper and marks the creatures inside it', async ({ page }) => {
      await toQuarry(page, {
        ...lootBlob(1),
        ...wornGear([{ id: 'verdict-blade', definitionId: 'eclipse-longblade', name: 'Eclipse Longblade', rarity: 'rare', slotId: 'weapon', stats: { strikePower: 1 }, sockets: ['hollow', 'sigil'] }]),
      });
      await expect(canvas(page)).toHaveAttribute('data-aura', 'conviction:3', { timeout: 15000 });
      await walkTo(page, 1100, 40);
      await expect.poll(async () => Number(await canvas(page).getAttribute('data-aura-debuffed')), { timeout: 20000 }).toBeGreaterThanOrEqual(1);
      await shot(page, `aura-conviction-${size}`);
    });

    test('the loot filter hides commons (coins and gear still show)', async ({ page }) => {
      const s = seedFor(d => d.length === 0);
      await toQuarry(page, lootBlob(s));
      await page.getByRole('button', { name: 'Places' }).first().click();
      await page.locator('[data-open="loot"]').click();
      await page.locator('.ls [data-filter="hide-common"]').click();
      await expect(page.locator('.ls')).toHaveAttribute('data-loot-filter', 'hide-common');
      await page.locator('.ls__done').click();
      await focusWorld(page);
      await huntOne(page);
      await expect.poll(() => drops(page), { timeout: 8000 }).toMatch(/common:0/);
      expect(await drops(page)).toMatch(/coins:1/);
      const saved = await blob<{ filter: string }>(page, 'godforge-loot');
      expect(saved?.filter).toBe('hide-common');
    });
  });
}

// Handoff screenshots only: each rung's beam (a Hell kill shifts the ladder up), and two more auras.
test.describe('Loot & combat — handoff screenshots', () => {
  test.skip(!SHOTS, 'LOOT_SHOTS=1 only');
  test.describe.configure({ timeout: 300000 });
  const STRONG = (sockets: string[]) => wornGear([
    { id: 'shot-blade', definitionId: 'eclipse-longblade', name: 'Eclipse Longblade', rarity: 'rare', slotId: 'weapon', stats: { strikePower: 5 }, sockets },
    { id: 'shot-cuirass', definitionId: 'infernal-cuirass', name: 'Infernal Cuirass', rarity: 'epic', slotId: 'chest', stats: { ward: 15 } },
  ]);
  for (const tier of ['epic', 'legendary', 'mythic'] as const) {
    test(`a ${tier} beam`, async ({ page }) => {
      const s = seedFor(d => d.some(x => x.rarity === tier), 'hell', 41);
      await toQuarry(page, { ...lootBlob(s, { tier: 'hell', unlocked: ['normal', 'nightmare', 'hell'] }), ...STRONG(['hollow', 'sigil']) });
      await huntOne(page);
      await expect.poll(() => drops(page), { timeout: 8000 }).toMatch(new RegExp(`${tier}:1`));
      // Step back so the Keeper does not stand in front of the beam.
      await walkTo(page, (await playerX(page)) - 280, 40);
      await page.waitForTimeout(900);
      await shot(page, `beam-${tier}`);
    });
  }
  for (const [sockets, aura] of [[['thorn', 'scorch'], 'might'], [['glint', 'pulse'], 'holy-shock']] as const) {
    test(`the ${aura} ring`, async ({ page }) => {
      await toQuarry(page, { ...lootBlob(1), ...STRONG([...sockets]) });
      await expect(canvas(page)).toHaveAttribute('data-aura', new RegExp(`^${aura}:`), { timeout: 15000 });
      await walkTo(page, 1000, 40);
      await page.waitForTimeout(1200);
      await shot(page, `aura-${aura}`);
    });
  }
});
