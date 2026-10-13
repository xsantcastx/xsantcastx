/**
 * play-delve-extras.spec.ts — the Delve extras merged without a visual check
 * (docs/handoff/delve-building.md, "Delve extras"), played in a real browser:
 * loose rock and supports, blasting charges, the four new inscriptions and the
 * Archivist's count, and gear in chests.
 *
 * Getting deep: the Delve save is built by the game's own pure code
 * (play-delve-fixtures.ts) as "this player dug a gallery and pitched a camp
 * here", then the Keeper takes the shaft's real "Descend to your camp". The
 * production build has no `ng` global, so that is the closest a spec can get to
 * driving the services: the same generator, diff and encoder the service uses.
 * Everything after the descent is played with keys and clicks.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  bag, blob, canvas, focusWorld, hotbarCount, messageLine, openPlay, placePanel, playerX, purse, seed, stackQty, walkTo,
} from './play-helpers';
import {
  activity, CELL, colX, DelveFixture, isLoose, SPEC, TERRAIN_NODE_LIST, xpForLevel,
} from './play-delve-fixtures';
import { blastCells } from '../src/app/play/engine/terrain';
import { decodeCells } from '../src/app/shared/delve/delve-save.model';
import { inscriptionById } from '../src/app/shared/delve/delve-lore.model';

const panel = (page: Page) => page.locator('section.place');

// ── Shared moves ─────────────────────────────────────────────────────────────

/** From town: walk to the shaft and take "Descend to your camp". */
async function descend(page: Page): Promise<void> {
  await openPlay(page);
  await walkTo(page, 590, 30);
  const button = page.getByRole('button', { name: /Descend to your camp/ });
  await expect(button).toBeVisible();
  await button.click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await expect(messageLine(page)).toContainText('climb down the ropes to your camp');
  // Let the vertical camera settle on the camp and the arrival grace (1.5 s) run out.
  await page.waitForTimeout(1800);
  await focusWorld(page);
}

async function keeperHp(page: Page): Promise<number> {
  return Number(await page.locator('.vitals .vital').first().locator('label b').textContent());
}

async function delveDiff(page: Page): Promise<Map<number, number>> {
  const save = await blob<{ areas?: Record<string, { cells: string }> }>(page, 'godforge-delve');
  return decodeCells(save?.areas?.['ember-delve']?.cells ?? '');
}

async function xp(page: Page, discipline: string): Promise<number> {
  return page.evaluate(d => Number(JSON.parse(localStorage.getItem('godforge-activity') || '{}')?.progress?.xpByDiscipline?.[d] ?? 0), discipline);
}

/**
 * Click a terrain cell the way a player would. World → client uses the
 * engine's own camera rule (render(): x follows at 0.38 of the view, y at 0.58
 * of 720, both clamped), with the Keeper's known feet.
 */
async function clickCell(page: Page, col: number, row: number, feetY: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const px = await playerX(page);
  const at = await canvas(page).evaluate((c, a) => {
    const rect = c.getBoundingClientRect();
    const parent = c.parentElement!;
    const w = Math.max(320, parent.clientWidth || rect.width), h = Math.max(300, parent.clientHeight || rect.height);
    const scale = h / 720, viewport = w / scale;
    const camera = Math.max(0, Math.min(a.areaWidth - viewport, a.px - viewport * .38));
    const cameraY = Math.max(0, Math.min(a.bottom + 40 - 720, a.feetY - 720 * .58));
    return {
      x: rect.left + (a.wx - camera) * scale * (rect.width / w),
      y: rect.top + (a.wy - cameraY) * scale * (rect.height / h),
    };
  }, { px, feetY, wx: (col + .5) * CELL, wy: SPEC.top + (row + .5) * CELL, areaWidth: SPEC.cols * CELL, bottom: SPEC.top + SPEC.rows * CELL });
  await page.mouse.click(at.x, at.y, { button });
}

async function chooseSlot(page: Page, key: string, name: string): Promise<void> {
  await focusWorld(page);
  await page.keyboard.press(key);
  await expect(messageLine(page)).toContainText(`${name} ready`);
}

/** A card title, not a longer one that starts with it ("Staff I", not "Staff II"). */
const exactName = (name: string) => new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`);

/** Craft one recipe at the Crafting Bench (search, pick, make; the anvil is skipped when it shows). */
async function craft(page: Page, search: string, name: string): Promise<void> {
  await openPlay(page, '?at=crafting');
  await expect(panel(page).locator('.cb-hero')).toBeVisible({ timeout: 15000 });
  await panel(page).getByText('Details', { exact: true }).click();
  await panel(page).getByPlaceholder('Search recipes and materials').fill(search);
  await panel(page).locator('.cb-card', { hasText: exactName(name) }).first().click();
  await expect(panel(page).locator('.cb-hero .dh__name')).toHaveText(name);
  const make = panel(page).locator('.cb-hero .ab__btn');
  await expect(make).not.toHaveAttribute('aria-disabled', 'true');
  await make.click();
  const skip = panel(page).locator('app-anvil-game .mg__skip');
  const reward = panel(page).locator('app-reward-pop .rp');
  await expect(skip.or(reward)).toBeVisible({ timeout: 15000 });
  if (await skip.isVisible()) await skip.click();
  await expect(reward).toContainText(name, { timeout: 20000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500); // the ledger write lands before the next navigation
}

/** Why the bench refuses a recipe ('' when it can be made). */
async function benchWhy(page: Page, search: string, name: string): Promise<{ why: string; disabled: boolean }> {
  await openPlay(page, '?at=crafting');
  await expect(panel(page).locator('.cb-hero')).toBeVisible({ timeout: 15000 });
  await panel(page).getByText('Details', { exact: true }).click();
  await panel(page).getByPlaceholder('Search recipes and materials').fill(search);
  await panel(page).locator('.cb-card', { hasText: exactName(name) }).first().click();
  await expect(panel(page).locator('.cb-hero .dh__name')).toHaveText(name);
  const why = panel(page).locator('.cb-hero .ab__why');
  return {
    why: (await why.count()) ? (await why.textContent()) ?? '' : '',
    disabled: (await panel(page).locator('.cb-hero .ab__btn').getAttribute('aria-disabled')) === 'true',
  };
}

/** Let the 1.5 s debounced delve write land, then reload into town (no ?at). */
async function saveAndReload(page: Page): Promise<void> {
  await page.waitForTimeout(2500);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
  await page.waitForTimeout(400);
  if ((await canvas(page).getAttribute('data-area')) === 'Ember Delve') {
    await page.getByRole('button', { name: 'Return to camp', exact: true }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
  }
}

// ── 1. Loose rock and supports ──────────────────────────────────────────────

/**
 * A gallery under a Magma Halls ceiling: rows 42–44 dug open from col 1 to 88,
 * a bedrock floor where row 45 was open (the Maws' hall lies below), the camp
 * at its west end. Row 41 above is the generated scorched basalt, about one
 * cell in five of it loose.
 */
const CEIL = 41;
const GALLERY_FEET = SPEC.top + (CEIL + 4) * CELL;
function gallery(): { f: DelveFixture; loose: number[] } {
  const f = new DelveFixture().carve(1, 88, CEIL + 1, CEIL + 3).floor(1, 88, CEIL + 4).camp(2, CEIL + 3);
  const loose: number[] = [];
  for (let col = 4; col <= 87; col++) if (isLoose(f.t, col, CEIL)) loose.push(col);
  return { f, loose };
}

/** Pickaxe I does 1 of scorched basalt's 4 HP per swing. */
const ROCK_SWINGS = 4;

/**
 * Wall time between clicks so each one is a swing. The swing cooldown is 0.52 s
 * of *game* time, and the engine caps a frame at 0.1 s: a headless page that
 * drops to ~9 fps runs game time slower than the wall clock, and clicks at
 * 0.62 s then land inside the cooldown and are ignored. That, not the seam,
 * is what made the old "swing until open" loop need 5-7 clicks under load.
 */
const SWING_GAP = 1000;

/** One click on a gallery ceiling cell, then let the swing's cooldown run out. */
async function swingAt(page: Page, col: number, gap = SWING_GAP): Promise<void> {
  await clickCell(page, col, CEIL, GALLERY_FEET);
  if (gap) await page.waitForTimeout(gap);
}

async function cellOpen(page: Page, col: number): Promise<boolean> {
  return (await delveDiff(page)).get(col + CEIL * SPEC.cols) === 0;
}

/** Swing `n` times at a ceiling cell, then check (after the 1.5 s save) that it still stands. */
async function crack(page: Page, col: number, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await swingAt(page, col);
  await page.waitForTimeout(1700); // a cell that broke early would be in the save by now
  expect(await cellOpen(page, col), `${col},${CEIL} still stands after ${n} swings`).toBe(false);
}

/**
 * Dig the ceiling cell straight overhead by clicking it: exactly four Pickaxe I
 * swings, whatever the Mining seam's 2.5 s recovery is doing (owner call
 * 2026-10-13: in the Delve digging is never blocked, only the reward is
 * rate-limited). Three swings leave it standing; the fourth opens it.
 */
async function digOverhead(page: Page, col: number): Promise<void> {
  // Stand right under it: falling rock only hits within 23 px of the Keeper's
  // centre, and a walk slides up to ~20 px past where it stops. Each click on
  // the open air at that column is a shorter, slower walk back, so it settles.
  await walkTo(page, colX(col), 6);
  for (let i = 0; i < 5 && Math.abs((await playerX(page)) - colX(col)) > 8; i++) {
    await clickCell(page, col, CEIL + 2, GALLERY_FEET);
    await page.waitForTimeout(700);
  }
  expect(Math.abs((await playerX(page)) - colX(col)), `the Keeper stands under ${col},${CEIL}`).toBeLessThanOrEqual(12);
  await crack(page, col, ROCK_SWINGS - 1);
  await swingAt(page, col, 0);
  await expect.poll(() => cellOpen(page, col), { timeout: 8000, message: `${col},${CEIL} opens on swing ${ROCK_SWINGS}` }).toBe(true);
  await page.waitForTimeout(400); // any loose rock has fallen by now
}

test.describe('Delve extras: loose rock and supports, played', () => {
  test.describe.configure({ timeout: 180000 });

  test('a loose Magma Halls ceiling cell dug with no support falls and bruises 8% of max HP', async ({ page }) => {
    const { f, loose } = gallery();
    expect(loose.length, 'the gallery ceiling has loose cells for this seed').toBeGreaterThan(3);
    await seed(page, f.blobs());
    await descend(page);
    const full = await keeperHp(page);
    const hit = Math.max(4, Math.round(full * .08));
    await digOverhead(page, loose[0]);
    await expect(messageLine(page)).toContainText(`Loose rock hits you (-${hit})`);
    expect(await keeperHp(page)).toBe(full - hit);
  });

  test('a basalt support within reach holds loose rock; one out of reach does not', async ({ page }) => {
    const { f, loose } = gallery();
    // A loose cell to hold, and another more than 5 columns from it (and from the support).
    const held = loose.find(c => c >= 8)!;
    const far = loose.find(c => c > held + 7)!;
    expect(far, 'a second loose cell further east').toBeTruthy();
    await seed(page, { ...f.blobs(), ...bag({ 'basalt-support': 2 }) });
    await descend(page);
    const full = await keeperHp(page);
    // Stand one column west of the loose cell, facing it, and place the support beside.
    await walkTo(page, colX(held - 1), 6);
    await chooseSlot(page, 'Digit9', 'Basalt support');
    await page.keyboard.press('b');
    await expect(messageLine(page)).toContainText('Basalt support placed');
    await expect.poll(() => hotbarCount(page, 'Basalt support')).toBe(1);
    // The support stands under the loose cell; the Keeper walks through it to stand under the rock too.
    await digOverhead(page, held);
    expect(await messageLine(page).textContent()).not.toMatch(/groans|Loose rock hits you/);
    expect(await keeperHp(page)).toBe(full);
    // The dug cell is open in the save: it was dug, it just did not fall.
    await expect.poll(async () => (await delveDiff(page)).get(f.t.index(held, CEIL)), { timeout: 6000 }).toBe(0);
    // Control: the same rock, out of the support's reach, comes down.
    await digOverhead(page, far);
    await expect(messageLine(page)).toContainText('Loose rock hits you');
    expect(await keeperHp(page)).toBeLessThan(full);
  });

  test('digging is never blocked by the seam\'s breath: the next cell opens in four swings and pays no Mining XP', async ({ page }) => {
    const { f } = gallery();
    // Two firm ceiling cells side by side, both in reach from one spot.
    // Clear of the vitals panel, which covers the ceiling over the first columns.
    const col = Array.from({ length: 70 }, (_, i) => i + 12).find(c => !isLoose(f.t, c, CEIL) && !isLoose(f.t, c + 1, CEIL))!;
    expect(col, 'two firm ceiling cells side by side').toBeTruthy();
    await seed(page, f.blobs());
    await descend(page);
    await walkTo(page, colX(col), 6);
    await page.waitForTimeout(200);
    const mining0 = await xp(page, 'mining');
    const blocks0 = await hotbarCount(page, 'Basalt block');
    // Crack both cells to their last stage first (a chip never asks the seam).
    await crack(page, col + 1, ROCK_SWINGS - 1);
    await crack(page, col, ROCK_SWINGS - 1);
    // The fourth swing on the first cell breaks it and books a Mining action:
    // the seam's 2.5 s breath starts here.
    await swingAt(page, col);
    await expect.poll(() => xp(page, 'mining'), { timeout: 3000 }).toBeGreaterThan(mining0);
    const mining1 = await xp(page, 'mining');
    // The fourth swing on the second, a second later, is inside the breath. It
    // still breaks (before, it was refused until the breath ran out) and pays nothing.
    await swingAt(page, col + 1, 0);
    await expect(page.locator('.loot-toast', { hasText: '+0 XP · the seam is catching its breath' })).toBeVisible();
    await expect.poll(() => cellOpen(page, col + 1), { timeout: 5000 }).toBe(true);
    expect(await cellOpen(page, col)).toBe(true);
    expect(await xp(page, 'mining'), 'the cell dug during the breath paid nothing').toBe(mining1);
    // The block still drops: it is the rock itself, not a reward.
    await expect.poll(() => hotbarCount(page, 'Basalt block')).toBe(blocks0 + 2);
  });

  test('rubble never takes the Keeper below 1 HP', async ({ page }) => {
    const { f, loose } = gallery();
    await seed(page, f.blobs());
    await descend(page);
    const full = await keeperHp(page);
    const hit = Math.max(4, Math.round(full * .08));
    const needed = Math.ceil((full - 1) / hit) + 1;
    expect(loose.length, `enough loose cells overhead to be hit ${needed} times`).toBeGreaterThanOrEqual(needed);
    let hp = full;
    for (const col of loose.slice(0, needed)) {
      await digOverhead(page, col);
      await expect.poll(() => keeperHp(page), { timeout: 5000, message: `rubble from ${col},${CEIL}` }).toBe(Math.max(1, hp - hit));
      const now = await keeperHp(page);
      hp = now;
      if (hp === 1) break;
    }
    expect(hp).toBe(1);
    expect(await canvas(page).getAttribute('data-area')).toBe('Ember Delve');
  });
});

// ── 2. Blasting charges ─────────────────────────────────────────────────────

const STAFF_BAG = { 'celestial-alloy': 4, 'starlight-herb': 4 };
const CHARGE_BAG = { 'cinder-ore': 3, 'ember-residue': 1, 'slag-fragment': 2 };

/** XP the blast pays for these cells: max(1, node xp), Mining for mining nodes, Delving otherwise. */
function blastXp(f: DelveFixture, cells: number[]): { mining: number; exploration: number } {
  const out = { mining: 0, exploration: 0 };
  for (const i of cells) {
    const node = TERRAIN_NODE_LIST[f.t.kind[i]];
    out[node.discipline === 'mining' ? 'mining' : 'exploration'] += Math.max(1, node.xp);
  }
  return out;
}

/** Choose the charge, light it in front of the Keeper, and return the cell it went into. */
async function lightCharge(page: Page, f: DelveFixture): Promise<{ col: number; row: number }> {
  await chooseSlot(page, 'Digit0', 'Blasting charge');
  const x = await playerX(page);
  await page.keyboard.press('b');
  await expect(messageLine(page)).toContainText('Fuse lit!');
  // placeTarget('beside'), facing east: the column past the body, at the feet row (open here).
  const at = f.campAt!;
  return { col: Math.floor((x + 13 - 1e-3) / CELL) + 1, row: at.row };
}

test.describe('Delve extras: blasting charges, played', () => {
  test.describe.configure({ timeout: 180000 });

  test('the charge recipe waits for Smithing 10, then makes two', async ({ page }) => {
    await seed(page, { ...bag(CHARGE_BAG), ...purse(10_000), ...activity({ forge: xpForLevel(10) - 1 }) });
    const short = await benchWhy(page, 'Blasting', 'Blasting charge');
    expect(short.disabled).toBe(true);
    // Since P-7 (7754feb) the refusal names the ladder it reads: "Reach Smithing 10 first".
    expect(short.why).toMatch(/Smithing 10/);
    await seed(page, { ...bag(CHARGE_BAG), ...purse(10_000), ...activity({ forge: xpForLevel(10) }) });
    expect((await benchWhy(page, 'Blasting', 'Blasting charge')).disabled).toBe(false);
    await craft(page, 'Blasting', 'Blasting charge');
    await expect.poll(() => stackQty(page, 'blast-charge')).toBe(2);
    expect(await stackQty(page, 'slag-fragment')).toBe(0);
  });

  // P-7 (fixed): the refusal names the Smithing ladder, not the bench's crafting level.
  test('a Smithing-gated recipe says which skill it waits for', async ({ page }) => {
    await seed(page, { ...bag(CHARGE_BAG), ...purse(10_000), ...activity({ forge: xpForLevel(10) - 1 }) });
    expect((await benchWhy(page, 'Blasting', 'Blasting charge')).why).toContain('Smithing');
  });

  test('without a staff the fuse will not light', async ({ page }) => {
    const f = new DelveFixture().carve(95, 99, 21, 23).camp(97, 23);
    await seed(page, { ...f.blobs(), ...bag({ 'blast-charge': 1 }) });
    await descend(page);
    await chooseSlot(page, 'Digit0', 'Blasting charge');
    await page.keyboard.press('b');
    await expect(messageLine(page)).toContainText('You need a staff to light the fuse');
    expect(await hotbarCount(page, 'Blasting charge')).toBe(1);
  });

  test('a charge lit with a staff clears its round once, pays XP once, keeps across a reload, and spares protected walls', async ({ page }) => {
    // A dug approach to the sealed pocket (cracked walls cols 100-106, rows 21-25, protected; its cache at 103,24).
    const f = new DelveFixture().carve(95, 99, 21, 23).camp(97, 23);
    const protectedCells = [[100, 21], [100, 22], [100, 23], [100, 24], [100, 25], [101, 21], [101, 25], [103, 24]] as const;
    const before = protectedCells.map(([c, r]) => f.kindAt(c, r));
    expect(before.every(k => k === 'cracked-wall' || k === 'cache')).toBe(true);
    await seed(page, { ...f.blobs(), ...bag({ ...STAFF_BAG, 'blast-charge': 2 }), ...purse(10_000) });
    await craft(page, 'Staff I', 'Staff I');
    await descend(page);
    const mining0 = await xp(page, 'mining'), delving0 = await xp(page, 'exploration');
    const charge = await lightCharge(page, f);
    // Staff I: power 1 + 1. The cells the game's own blast rule picks around that cell.
    f.set(charge.col, charge.row, 'blast-charge');
    const out = new Int32Array(32);
    const n = blastCells(f.t, charge.col, charge.row, 2, () => false, out);
    const round = [...out.slice(0, n)];
    expect(round.length, 'the round holds rock to clear').toBeGreaterThanOrEqual(3);
    for (const i of round) {
      const col = i % f.t.cols, row = (i - col) / f.t.cols;
      expect(Math.hypot(col - charge.col, row - charge.row)).toBeLessThanOrEqual(2.3);
    }
    const pay = blastXp(f, round);
    await expect(messageLine(page)).toContainText(`The charge goes off: ${round.length} cells`, { timeout: 5000 });
    await expect.poll(() => xp(page, 'mining'), { timeout: 8000 }).toBe(mining0 + pay.mining);
    expect(await xp(page, 'exploration')).toBe(delving0 + pay.exploration);
    expect(await hotbarCount(page, 'Blasting charge')).toBe(1);
    // The save: every cell of the round open, the charge gone, the protected walls as they were.
    await expect.poll(async () => { const d = await delveDiff(page); return round.every(i => d.get(i) === 0); }, { timeout: 6000 }).toBe(true);
    const diff = await delveDiff(page);
    expect(diff.get(f.t.index(charge.col, charge.row))).toBe(0);
    for (const [c, r] of protectedCells) expect(diff.has(f.t.index(c, r)), `protected ${c},${r} untouched`).toBe(false);
    const encoded = (await blob<{ areas: Record<string, { cells: string }> }>(page, 'godforge-delve'))!.areas['ember-delve'].cells;
    // Reload: the round stays open, and nothing is paid again, even after going back down.
    await saveAndReload(page);
    expect((await blob<{ areas: Record<string, { cells: string }> }>(page, 'godforge-delve'))!.areas['ember-delve'].cells).toBe(encoded);
    const mining1 = await xp(page, 'mining');
    expect(mining1).toBe(mining0 + pay.mining);
    await descend(page);
    await page.waitForTimeout(2500);
    expect(await xp(page, 'mining')).toBe(mining1);
    expect(await hotbarCount(page, 'Blasting charge')).toBe(1);
  });

  test('bedrock and the protected fragment stand through a blast', async ({ page }) => {
    // The fragment chamber, its warden already felled (the `claimed` flag), so its seal is open.
    const f = new DelveFixture().camp(104, 50);
    f.claimed = ['warden-defeated'];
    const bedrock = [103, 104, 105, 106, 107].map(c => f.t.index(c, 51));
    expect(bedrock.every(i => TERRAIN_NODE_LIST[f.t.kind[i]].id === 'bedrock')).toBe(true);
    const fragment = f.t.index(106, 50);
    expect(f.kindAt(106, 50)).toBe('godforge-fragment');
    await seed(page, { ...f.blobs(), ...bag({ ...STAFF_BAG, 'blast-charge': 1 }), ...purse(10_000) });
    await craft(page, 'Staff I', 'Staff I');
    await descend(page);
    const charge = await lightCharge(page, f);
    expect(charge).toEqual({ col: 105, row: 50 });
    f.set(charge.col, charge.row, 'blast-charge');
    const out = new Int32Array(32);
    const round = [...out.slice(0, blastCells(f.t, 105, 50, 2, flag => flag === 'warden-defeated', out))];
    await expect(messageLine(page)).toContainText('The charge goes off', { timeout: 5000 });
    await expect.poll(async () => { const d = await delveDiff(page); return round.every(i => d.get(i) === 0); }, { timeout: 6000 }).toBe(true);
    const diff = await delveDiff(page);
    for (const i of bedrock) expect(diff.has(i), 'bedrock untouched').toBe(false);
    expect(diff.has(fragment), 'the fragment untouched').toBe(false);
    expect(await stackQty(page, 'godforge-fragment')).toBe(0);
  });
});

// ── 3. Inscriptions and the Archivist ───────────────────────────────────────

const OLD_EIGHT = [
  'roots-inverse-tree', 'roots-keepers-tally', 'basalt-kaels-mark', 'basalt-sealed-pocket',
  'grotto-light-through-the-crack', 'grotto-drowned-lamp', 'magma-the-fracture', 'magma-warden-oath',
];
/** Each new carving, and a camp beside it where the Keeper's body reaches the wall. */
const NEW_FOUR: { id: string; camp: [number, number] }[] = [
  { id: 'roots-cutting-mark', camp: [29, 8] },
  { id: 'basalt-seam-ledger', camp: [79, 18] },
  { id: 'grotto-tally-marks', camp: [41, 34] },
  { id: 'magma-unsigned', camp: [103, 50] },
];

async function lore(page: Page): Promise<string[]> {
  return (await blob<{ inscriptions?: string[] }>(page, 'godforge-delve-lore'))?.inscriptions ?? [];
}

async function openQuestBoard(page: Page): Promise<void> {
  await openPlay(page, '?at=waystone');
  await page.locator('.waystone-road', { hasText: 'Verdant' }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Rootglass Canopy');
  await expect(placePanel(page)).toBeHidden();
  await focusWorld(page);
  await walkTo(page, 1030, 40);
  await page.keyboard.press('e');
  await expect(page.locator('#place-title')).toHaveText('Quest Board');
  await expect(page.locator('section.place app-station-shell.qb')).toBeVisible({ timeout: 15000 });
  await page.locator('section.place app-station-tabs').getByRole('button', { name: /^Delve/ }).click();
}
async function openMission(page: Page, title: string): Promise<void> {
  // "Words in the Stone" must not pick "Words in the Stone II".
  await page.locator('section.place app-journal-list .jl__row', { hasText: new RegExp(`${title}(?! ?I+\\b)`) }).first().click();
  await expect(page.locator('section.place .qb-detail app-detail-head')).toContainText(title);
}
async function claim(page: Page, title: string): Promise<void> {
  await openMission(page, title);
  const button = page.locator('section.place .qb-detail .ab__btn');
  await expect(button).not.toHaveAttribute('aria-disabled', 'true');
  await button.click();
  await expect(page.locator('section.place app-reward-pop .rp')).toBeVisible();
}

test.describe('Delve extras: the four new inscriptions, played', () => {
  test.describe.configure({ timeout: 240000 });

  test('each new carving reads with E, and the Archivist then counts 12 of 12', async ({ page }) => {
    let read = [...OLD_EIGHT];
    for (const { id, camp } of NEW_FOUR) {
      const f = new DelveFixture().camp(camp[0], camp[1]);
      // The warden would guard the deepest carving; it is long felled in this save.
      if (id === 'magma-unsigned') f.claimed = ['warden-defeated'];
      await seed(page, { ...f.blobs(), 'godforge-delve-lore': { version: 1, inscriptions: read } });
      await descend(page);
      await expect(page.locator('.prompt')).toContainText('Read the inscription');
      await page.keyboard.press('e');
      const text = inscriptionById(id)!.text;
      await expect(messageLine(page)).toContainText(`New inscription. ${text.slice(0, 40)}`);
      await expect.poll(() => lore(page), { timeout: 6000 }).toContain(id);
      read = await lore(page);
    }
    expect(read).toHaveLength(12);
    await openQuestBoard(page);
    await claim(page, 'Words in the Stone');
    await claim(page, 'Words in the Stone II');
    await openMission(page, 'Words in the Stone III');
    const detail = page.locator('section.place .qb-detail');
    await expect(detail).toContainText('Copy all 12 inscriptions');
    await expect(detail).toContainText('12/12');
    await claim(page, 'Words in the Stone III');
  });

  test('eleven copied is not yet all: Words III shows 11/12 and waits', async ({ page }) => {
    await seed(page, { 'godforge-delve-lore': { version: 1, inscriptions: [...OLD_EIGHT, ...NEW_FOUR.slice(0, 3).map(n => n.id)] } });
    await openQuestBoard(page);
    await claim(page, 'Words in the Stone');
    await claim(page, 'Words in the Stone II');
    await openMission(page, 'Words in the Stone III');
    await expect(page.locator('section.place .qb-detail')).toContainText('11/12');
    await expect(page.locator('section.place .qb-detail .ab__btn')).toHaveAttribute('aria-disabled', 'true');
  });
});

// ── 4. Gear in chests ───────────────────────────────────────────────────────

const KRIS = 'Briarvein Kris';
/** The Keeper's feet on the old tunnel's floor (row 9). */
const TUNNEL_FEET = SPEC.top + 9 * CELL;
const KRIS_BAG = { thornroot: 6, 'verdant-sap': 3, 'world-root-bark': 2 };

interface Ledger { records?: { id: string; definitionId?: string; location?: { kind: string; explorerId?: string } }[] }
async function krisLocation(page: Page): Promise<{ kind: string; explorerId?: string } | undefined> {
  const inv = await blob<Ledger>(page, 'godforge-inventory');
  return (inv?.records ?? []).find(r => r.definitionId === 'briarvein-kris')?.location;
}

test.describe('Delve extras: gear in chests, played', () => {
  test.describe.configure({ timeout: 180000 });

  test('a weapon goes into a chest, survives a reload, holds the chest in place, and comes back out', async ({ page }) => {
    // The old Root Hollows tunnel, the camp at its middle; the chest goes a few columns west of it.
    const f = new DelveFixture().floor(14, 34, 9).camp(22, 8);
    await seed(page, { ...f.blobs(), ...bag({ ...KRIS_BAG, chest: 1 }), ...purse(3_000_000) });
    await craft(page, KRIS, KRIS);
    expect((await krisLocation(page))?.kind).toBe('bag');
    await descend(page);
    // Walk west, clear of the carving at 19,7, and place the chest where the Keeper
    // stands with a right-click on that cell (a chest is walked through).
    await walkTo(page, colX(16), 6);
    await chooseSlot(page, 'Digit6', 'Chest');
    const chestCol = Math.floor(await playerX(page) / CELL);
    await clickCell(page, chestCol, 8, TUNNEL_FEET, 'right');
    await expect(messageLine(page)).toContainText('Chest placed');
    await expect(page.locator('.prompt')).toContainText('Open the chest');
    await page.keyboard.press('e');
    await expect(page.locator('#place-title')).toHaveText('Chest');
    await page.locator('.chest section[aria-labelledby="chest-bag-gear"] li', { hasText: KRIS }).getByRole('button', { name: 'Put in' }).click();
    await expect(page.locator('.chest section[aria-labelledby="chest-gear"] li', { hasText: KRIS })).toBeVisible();
    await expect.poll(async () => (await krisLocation(page))?.explorerId ?? '').toMatch(/^delve-chest:/);
    await page.keyboard.press('Escape');
    await expect(placePanel(page)).toBeHidden();
    // X on a chest with gear in it is refused, and the chest stays.
    await page.waitForTimeout(400); // keys pressed while the panel folds away are lost
    await focusWorld(page);
    await page.keyboard.press('x');
    await expect(messageLine(page)).toContainText('Empty the chest first');
    expect(await hotbarCount(page, 'Chest')).toBeLessThan(1);
    await expect(page.locator('.prompt')).toContainText('Open the chest');
    // Reload: the chest record and the stored weapon are both still there.
    await saveAndReload(page);
    expect(Object.keys((await blob<{ chests?: object }>(page, 'godforge-delve'))?.chests ?? {})).toHaveLength(1);
    expect((await krisLocation(page))?.explorerId ?? '').toMatch(/^delve-chest:/);
    await descend(page);
    await walkTo(page, colX(chestCol), 6);
    await expect(page.locator('.prompt')).toContainText('Open the chest');
    await page.keyboard.press('e');
    const stored = page.locator('.chest section[aria-labelledby="chest-gear"] li', { hasText: KRIS });
    await expect(stored).toBeVisible();
    await stored.getByRole('button', { name: 'Take' }).click();
    await expect.poll(async () => (await krisLocation(page))?.kind).toBe('bag');
    await expect(page.locator('.chest section[aria-labelledby="chest-bag-gear"] li', { hasText: KRIS })).toBeVisible();
    // Empty again: now it can be taken back.
    await page.keyboard.press('Escape');
    await expect(placePanel(page)).toBeHidden();
    await page.waitForTimeout(400);
    await focusWorld(page);
    await page.keyboard.press('x');
    await expect(messageLine(page)).toContainText('Chest back in the satchel');
    await expect.poll(() => hotbarCount(page, 'Chest')).toBe(1);
  });
});

