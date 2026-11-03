/**
 * td-nearby.spec.ts — the satchel's Nearby tab (docs/design/ui-pass-3.md §A.4; Accept 14–18): every corpse and pile
 * within 8 tiles of the Keeper, nearest first; in reach (3 tiles) Take takes now, further it walks there first.
 *
 *  14. Two creatures felled (`__tdParty.smite`) and a stack dropped (the satchel card's Drop, "How many?"): the satchel
 *      opens on Nearby with three rows, nearest first. Take all empties a row into the satchel; a partial take of the
 *      stack (stepper at 2) leaves the rest on the ground.
 *  15. A corpse five tiles off is greyed with "Walk · 5 tiles"; Take walks the Keeper there and takes on arrival.
 *  16. Past eight tiles its row goes; a corpse that crumbles fades ("Looted") and goes.
 *  17. Online (a private Hearth room, the td-grid-online fixture): another Keeper's pile lists as "Bryn's drop", and
 *      taking it removes it for both screens.
 *  18. A full satchel greys Take and says "Too much baggage…" (play.grid.full); nothing leaves the ground.
 * `?fxparty=1` (automation only) fells a creature through the real kill and lays ember residue in its corpse.
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA };
const canvas = (page: Page) => page.locator('.viewport canvas');
const SHOTS = process.env['UIWA_SHOTS'] ?? '';

const stackRec = (key: string) => ({
  id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 90, deviceId: 'e2e', sequence: 1 }, source: 'inventory', stackKey: key, location: { kind: 'bag' },
});
/** Sixty rings, each its own roll (so no two share a cell): the satchel's sixty cells, full. */
const RINGS = Array.from({ length: 60 }, (_, i) => ({
  id: `full-${i}`, definitionId: 'anchor-ring', kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'common', soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
  name: `Anchor Ring ${i}`, type: 'artifact', stats: { defense: i + 1 }, sellValue: 5, econ: 1, location: { kind: 'bag' }, itemLevel: 1,
}));
const inventory = (stacks: Record<string, number>, records: unknown[] = []) => {
  const keys = Object.keys(stacks);
  return { version: 2, records: [...records, ...keys.map(stackRec)], tombstones: [], stackOps: keys.map((k, i) => ({ id: `e2e-grant-${k}`, stackKey: k, kind: 'grant', quantity: stacks[k], hlc: 80 + i, deviceId: 'e2e', sequence: i + 1 })), goldFromSales: 0, sold: 0, hlc: 500, legacyBackup: null, era: ERA };
};
type Corpse = { id: string; stage: string; loot: number; x: number; y: number };
const party = <T>(page: Page, fn: string) => page.evaluate(fn) as Promise<T>;
const corpses = (page: Page) => party<Corpse[]>(page, 'window.__tdParty.corpses()');
const me = (page: Page) => party<{ x: number; y: number }>(page, 'window.__tdGround.me()');
/** How many of a stack the satchel grid shows. */
const inBag = (page: Page, sk: string) => page.locator(`#satchel-book [data-grid="b"] [data-stack="${sk}"]`).evaluateAll(els => els.reduce((a, e) => a + Number(e.getAttribute('data-qty') ?? 0), 0));
const rows = (page: Page) => page.locator('[data-nearby] .near-row:not(.is-gone)');

async function boot(page: Page, stacks: Record<string, number> = { 'cinder-ore': 5 }, records: unknown[] = []): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'preferred-language': 'en', 'godforge-inventory': inventory(stacks, records) });
  await page.goto('/play?td=1&hour=12&fxparty=1');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdParty?: unknown; __tdGround?: unknown }).__tdParty && !!(window as unknown as { __tdGround?: unknown }).__tdGround);
  await page.waitForTimeout(600);
}
const openBag = async (page: Page) => { await page.locator('[data-th="bag"]').tap(); await expect(page.locator('#satchel-book')).toBeVisible(); };
const closeBag = async (page: Page) => { await page.locator('#satchel-book .book-close').tap(); await expect(page.locator('#satchel-book')).toHaveCount(0); };
/** Fell a creature `dx` art px from the Keeper and lay ember residue in its corpse. */
const fell = async (page: Page, dx: number) => {
  await page.evaluate(d => { const h = (window as unknown as { __tdParty: { smite: (t: string, dx: number) => unknown; stock: () => unknown } }).__tdParty; h.smite('ash-wolf', d); h.stock(); }, dx);
  await page.waitForTimeout(900); // the Gold beside it is pulled in by itself
};

test.describe('Nearby on a phone (390×844)', () => {
  test.use(PHONE);

  test('two corpses and a dropped stack: opens on Nearby, three rows nearest first; Take all; a partial take of 2', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    // Drop the stack through the satchel card ("How many?": all five).
    await openBag(page);
    await page.locator('#satchel-book [data-grid="b"] [data-stack="cinder-ore"]').first().tap();
    await page.locator('.d2tip--pinned [data-drop-item]').tap();
    const bar = page.locator('[data-drop-amount]');
    if (await bar.isVisible().catch(() => false)) { await bar.locator('[data-drop-amount-n]').fill('5'); await bar.locator('[data-drop-amount-ok]').tap(); }
    await expect.poll(() => inBag(page, 'cinder-ore')).toBe(0);
    await closeBag(page);
    // Two creatures felled beside the Keeper.
    await fell(page, 26);
    await fell(page, -40);
    expect((await corpses(page)).filter(c => c.loot > 0).length).toBe(2);
    // The satchel opens on Nearby (a corpse fell in reach in the last 30 s).
    await openBag(page);
    await expect(page.locator('#satchel-book')).toHaveAttribute('data-bag-tab', 'nearby');
    await expect(rows(page)).toHaveCount(3);
    const dists = await rows(page).evaluateAll(els => els.map(e => Number(e.getAttribute('data-dist'))));
    expect([...dists].sort((a, b) => a - b)).toEqual(dists);
    expect(dists.every(d => d <= 48)).toBe(true);
    await expect(page.locator('[data-near-badge]').first()).toHaveText('3');
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/nearby-390x844.png` }); }
    // Take all on a corpse row: it empties, the satchel gains its residue.
    const corpseRow = page.locator('[data-nearby] .near-row[data-near-kind="corpse"]').first();
    const id = await corpseRow.getAttribute('data-near');
    await corpseRow.locator('[data-near-all]').tap();
    await expect(page.locator(`[data-nearby] .near-row[data-near="${id}"]:not(.is-gone)`)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(2, { timeout: 5000 });
    // A partial take: the stack's card, the stepper at 2, Take; three stay on the ground.
    const pile = page.locator('[data-nearby] .near-row[data-near-kind="ground"]');
    await pile.locator('[data-near-item]').first().tap();
    const cardEl = page.locator('[data-near-card]');
    await expect(cardEl.locator('[data-near-qty]')).toHaveText('5');
    for (let i = 0; i < 3; i++) await cardEl.locator('[data-near-less]').tap();
    await expect(cardEl.locator('[data-near-qty]')).toHaveText('2');
    await cardEl.locator('[data-near-take]').tap();
    await expect(pile.locator('[data-near-item]').first()).toHaveAttribute('data-qty', '3', { timeout: 5000 });
    await page.locator('[data-bag-tab="bag"]').tap();
    await expect.poll(() => inBag(page, 'cinder-ore')).toBe(2);
    expect(await inBag(page, 'ember-residue')).toBeGreaterThanOrEqual(2);
  });

  test('a corpse five tiles off: greyed, "Walk · 5 tiles"; Take walks there and takes on arrival', async ({ page }) => {
    test.setTimeout(90_000);
    await boot(page, {});
    await fell(page, 80);
    await openBag(page);
    await page.locator('[data-bag-tab="nearby"]').tap();
    const row = page.locator('[data-nearby] .near-row[data-near-kind="corpse"]');
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute('data-in-reach', '0');
    await expect(row).toHaveClass(/is-far/);
    await expect(row.locator('[data-near-walk]')).toHaveText('Walk · 5 tiles');
    const x0 = (await me(page)).x;
    await row.locator('[data-near-walk]').tap();
    await expect.poll(async () => Math.abs((await me(page)).x - x0), { timeout: 15000 }).toBeGreaterThan(30);
    await expect.poll(async () => (await corpses(page))[0]?.loot ?? 0, { timeout: 15000 }).toBe(0);
    await expect(rows(page)).toHaveCount(0, { timeout: 5000 });
  });

  test('past eight tiles a row goes; a crumbled corpse fades as Looted and goes', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, {});
    await fell(page, 26);
    await openBag(page);
    await expect(rows(page)).toHaveCount(1);
    // Rot: the corpse crumbles (its clock moved on) — the row fades and goes.
    await page.evaluate(() => (window as unknown as { __tdParty: { age: (s: number) => number } }).__tdParty.age(400));
    await expect(page.locator('[data-nearby] .near-row.is-gone [data-near-looted]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-nearby] .near-row')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('[data-near-empty]')).toBeVisible();
    // Distance: a fresh one, then the Keeper walks away until it is past eight tiles.
    await fell(page, 26);
    await expect(rows(page)).toHaveCount(1, { timeout: 5000 });
    const c = (await corpses(page)).find(k => k.loot > 0)!;
    for (const [dx, dy] of [[-260, 0], [260, 0], [0, 260], [0, -260]]) {
      await page.evaluate(([x, y]) => (window as unknown as { __tdGround: { walk: (dx: number, dy: number) => boolean } }).__tdGround.walk(x, y), [dx, dy]);
      await page.waitForTimeout(3500);
      const m = await me(page);
      if (Math.hypot(m.x - c.x, m.y - c.y) > 140) break;
    }
    const m = await me(page);
    expect(Math.hypot(m.x - c.x, m.y - c.y), 'the Keeper walked past eight tiles').toBeGreaterThan(128);
    await expect(rows(page)).toHaveCount(0, { timeout: 5000 });
  });

  test('a full satchel greys Take, says so, and nothing leaves the ground', async ({ page }) => {
    test.setTimeout(90_000);
    await boot(page, {}, RINGS);
    await openBag(page);
    await expect(page.locator('#satchel-book .capacity')).toContainText(/60\s*\/\s*60/);
    await closeBag(page);
    await fell(page, 26);
    await openBag(page);
    await expect(page.locator('#satchel-book')).toHaveAttribute('data-bag-tab', 'nearby');
    const row = rows(page).first();
    await expect(row.locator('[data-near-all]')).toBeDisabled();
    await expect(page.locator('[data-near-full]')).toContainText('Too much baggage');
    const before = (await corpses(page))[0].loot;
    await row.locator('[data-near-item]').first().tap();
    await expect(page.locator('[data-near-take]')).toBeDisabled();
    expect((await corpses(page))[0].loot).toBe(before);
  });
});

// ── 17. Online: another Keeper's pile, through the room ──
let hearth: Hearth;
test.describe('Nearby online', () => {
  test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' }); });
  test.afterAll(async () => { await hearth?.stop(); });
  const rec = (id: string, name: string, def: string, rarity: string) => ({
    id, definitionId: def, kind: 'instance', category: 'equipment', tags: ['artifact'], rarity, soulbound: false,
    acquiredAt: '2026-10-20T00:00:00.000Z', revision: { hlc: 10, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: { magicFind: 3 }, rollQuality: { magicFind: 0.5 }, itemLevel: 8, sellValue: 20, location: { kind: 'bag' },
  });
  const keeper = (uid: string, records: unknown[]) => ({
    'eclipse-hearth-fake-token': `fake.${uid}.keeper`, 'eclipse-trade-fake': '1', 'godforge-realm-era': '55',
    'godforge-inventory': { version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 10, legacyBackup: null, era: 55 },
    'godforge-economy': { version: 3, goldEra: 1, gold: 20, totalGoldEarned: 20, runGoldEarned: 20, ops: [], origin: null, hlc: 10, applied: {} },
  });
  const names = (page: Page) => page.evaluate(() => {
    const inv = JSON.parse(localStorage.getItem('godforge-inventory') ?? '{}');
    const tomb = new Map((inv.tombstones ?? []).map((t: { id: string; revision: { hlc: number } }) => [t.id, t.revision.hlc]));
    return (inv.records ?? []).filter((r: { id: string; kind: string; revision: { hlc: number } }) => r.kind === 'instance' && !r.id.startsWith('starter-') && !((tomb.get(r.id) as number ?? -1) >= r.revision.hlc)).map((r: { name: string }) => r.name).sort();
  });

  test("another Keeper's pile lists as \"Bryn's drop\"; taking it removes it for both", async ({ browser }, info) => {
    test.setTimeout(180_000);
    const aCtx = await newContext(browser, info, PHONE);
    const aster = await aCtx.newPage();
    await enterAs(aster, hearth.port, 'Aster', 'ashguard', keeper('na', []));
    const bCtx = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
    const bryn = await bCtx.newPage();
    await enterAs(bryn, hearth.port, 'Bryn', 'thornstrider', keeper('nb', [rec('r1', 'Tide Ring', 'keepers-cowl', 'epic')]));
    // Bryn drops the ring at his feet (the satchel card's Drop).
    await bryn.waitForTimeout(500);
    if (await bryn.locator('.menu-scrim').count()) await bryn.locator('.menu-scrim').click({ position: { x: 4, y: 4 } });
    await bryn.getByRole('button', { name: /^Satchel/ }).first().click();
    await bryn.locator('#satchel-book [data-grid="b"] [data-ids="r1"]').click();
    await bryn.locator('.d2tip--pinned [data-drop-item]').click();
    await expect.poll(async () => (await canvas(bryn).getAttribute('data-ground')) ?? '', { timeout: 20000 }).toMatch(/^g/);
    await expect.poll(async () => (await canvas(aster).getAttribute('data-ground')) ?? '', { timeout: 20000 }).toMatch(/^g/);
    // Aster's Nearby: "Bryn's drop" (walked to if it is past three tiles).
    await openBag(aster);
    await aster.locator('[data-bag-tab="nearby"]').tap();
    const row = aster.locator('[data-nearby] .near-row[data-near-name="Bryn\'s drop"]');
    await expect(row).toBeVisible({ timeout: 10000 });
    const take = row.locator('[data-near-all], [data-near-walk]').first();
    await take.tap();
    if ((await row.getAttribute('data-in-reach').catch(() => '1')) === '0') {
      await expect(row).toHaveAttribute('data-in-reach', '1', { timeout: 15000 }).catch(() => { /* it was taken on arrival */ });
      if (await row.count()) await row.locator('[data-near-all]').tap().catch(() => { /* gone */ });
    }
    await expect.poll(() => names(aster), { timeout: 20000 }).toEqual(['Tide Ring']);
    await expect.poll(async () => (await canvas(bryn).getAttribute('data-ground')) ?? '', { timeout: 20000 }).toBe('');
    await expect.poll(async () => (await canvas(aster).getAttribute('data-ground')) ?? '', { timeout: 20000 }).toBe('');
    await bCtx.close();
    await aCtx.close();
  });
});
