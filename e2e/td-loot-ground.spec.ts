/**
 * td-loot-ground.spec.ts — the loot hotfix (owner 2026-10-26), solo:
 *   · five different things dropped land on ONE tile as one pile with a count; a right-click lists them, a row takes one,
 *     "Take all" the rest; dropping one moves nothing else in the satchel (every piece 1×1, pinned where it is);
 *   · Alt shows every ground label; a phone has a toggle;
 *   · walking over an item never picks it up, Gold still comes by itself;
 *   · a full satchel refuses a pickup with "Too much baggage" and the thing stays on the ground;
 *   · a Spellstone's card shows its picture and "Put on belt" / "Use", never Equip;
 *   · tap-to-move (390×844 touch): tap a satchel piece, tap the Vault; Deposit all; Sort;
 *   · a 360×640 touch path: drop two, tap the pile, Take all, the labels toggle.
 * Hooks: `window.__tdGround` (webdriver only; td-engine.ts).
 */
import * as fs from 'fs';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';

const SHOTS = 'docs/handoff/loot';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 78 }); };
const canvas = (page: Page) => page.locator('.viewport canvas');

function gear(id: string, def: string, name: string, i: number, extra: Record<string, unknown> = {}): unknown {
  return {
    id, definitionId: def, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: { defense: 4 + i }, sellValue: 90, econ: 3, location: { kind: 'bag' }, itemLevel: 3, ...extra,
  };
}
const stone = (id: string) => gear(id, 'spellstone:hellfire-nova@1#0', 'Spellstone', 50, { stats: {}, charges: 6, sellValue: 0 });
const stackRec = (key: string) => ({
  id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 90, deviceId: 'e2e', sequence: 1 }, source: 'inventory', stackKey: key, location: { kind: 'bag' },
});
function inventory(records: unknown[], stacks: Record<string, number> = {}): unknown {
  const keys = Object.keys(stacks);
  return {
    version: 2, records: [...records, ...keys.map(stackRec)], tombstones: [],
    stackOps: keys.map((k, i) => ({ id: `e2e-grant-${k}`, stackKey: k, kind: 'grant', quantity: stacks[k], hlc: 80 + i, deviceId: 'e2e', sequence: i + 1 })),
    goldFromSales: 0, sold: 0, hlc: 500, legacyBackup: null, era: ERA,
  };
}
const FIVE = [
  gear('d-helm', 'astral-helm', 'Astral Helm', 0), gear('d-cowl', 'keepers-cowl', 'Keepers Cowl', 1), gear('d-ring', 'anchor-ring', 'Anchor Ring', 2),
  gear('d-bow', 'meridian-longbow', 'Meridian Longbow', 3), gear('d-plate', 'infernal-cuirass', 'Infernal Cuirass', 4),
];
const KEEP = gear('k-staff', 'keeper-staff', 'Keeper Staff', 9);

async function enter(page: Page, blobs: Record<string, unknown>, query = ''): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Ilsa', vocation: 'ashguard', tree: { spent: {}, free: [], at: 1 } },
    ...blobs,
  });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.guide, .glim-say, .lvl-banner, .area-card { visibility: hidden !important; }' });
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __tdGround?: unknown }).__tdGround), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(500);
}

interface Pile { key: string; n: number; ids: string[]; labels: string[]; px: number; py: number }
type G = {
  piles(): Pile[]; me(): { x: number; y: number; px: number; py: number }; labels(): boolean;
  lay(kind: 'gold' | 'ore', dx: number, dy?: number, n?: number): { id: string; px: number; py: number }; has(id: string): boolean;
};
const g = <T>(page: Page, fn: (h: G) => T) => page.evaluate(`(${fn.toString()})(window.__tdGround)`) as Promise<T>;
const piles = (page: Page) => g(page, h => h.piles());
const has = (page: Page, id: string) => page.evaluate(i => (window as unknown as { __tdGround: G }).__tdGround.has(i), id);
const save = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-inventory') || 'null');
  return raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
});
/** Live instance records in the satchel (tombstones honoured), starter tools left out. */
const bagIds = async (page: Page): Promise<string[]> => {
  const inv = await save(page);
  const tomb = new Map((inv.tombstones ?? []).map((t: { id: string; revision: { hlc: number } }) => [t.id, t.revision.hlc]));
  return (inv.records ?? []).filter((r: { id: string; kind: string; location: { kind: string }; revision: { hlc: number } }) =>
    r.kind === 'instance' && r.location.kind === 'bag' && !r.id.startsWith('starter-') && !((tomb.get(r.id) as number ?? -1) >= r.revision.hlc)).map((r: { id: string }) => r.id);
};

async function openSatchel(page: Page): Promise<Locator> {
  await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
  await page.keyboard.press('i');
  const book = page.locator('#satchel-book');
  await expect(book.locator('[data-grid="b"]')).toBeVisible();
  return book;
}
async function closeSatchel(page: Page): Promise<void> {
  for (let i = 0; i < 3 && await page.locator('#satchel-book').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
}
/** The card's Drop for one satchel piece (a click selects it and pins its card). */
async function dropFromCard(page: Page, book: Locator, id: string): Promise<void> {
  await book.locator(`[data-grid="b"] [data-ids="${id}"]`).click();
  await page.locator('.d2tip--pinned [data-drop-item]').click();
  await expect(book.locator(`[data-grid="b"] [data-ids="${id}"]`)).toHaveCount(0);
}
const cellOf = (book: Locator, id: string) => book.locator(`[data-grid="b"] [data-ids="${id}"]`).getAttribute('data-cell');

test.describe('the ground: piles, manual pickup, labels', () => {
  test.describe.configure({ timeout: 150000 });

  test('five different things on one tile: one pile with a count; the right-click list takes one, then Take all; nothing else moves', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, { 'godforge-inventory': inventory([...FIVE, KEEP]) });
    const book = await openSatchel(page);
    // Every piece is one cell.
    for (const id of ['d-plate', 'd-bow', 'k-staff']) {
      await expect(book.locator(`[data-ids="${id}"]`)).toHaveAttribute('data-w', '1');
      await expect(book.locator(`[data-ids="${id}"]`)).toHaveAttribute('data-h', '1');
    }
    const staffAt = await cellOf(book, 'k-staff');
    const ringAt = await cellOf(book, 'd-ring');
    for (const id of ['d-helm', 'd-cowl', 'd-bow', 'd-plate']) {
      await dropFromCard(page, book, id);
      // Dropping one moves nothing else.
      expect(await cellOf(book, 'k-staff'), `after dropping ${id}`).toBe(staffAt);
      expect(await cellOf(book, 'd-ring'), `after dropping ${id}`).toBe(ringAt);
    }
    await dropFromCard(page, book, 'd-ring');
    expect(await cellOf(book, 'k-staff')).toBe(staffAt);
    await closeSatchel(page);
    // One pile, five things, at the Keeper's feet; nothing came back into the satchel on its own.
    await expect.poll(async () => (await piles(page)).map(p => p.n)).toEqual([5]);
    await page.waitForTimeout(1500);
    expect(await bagIds(page)).toEqual(['k-staff']);
    await page.mouse.move(5, 5);
    await shot(page, 'pile-1280');
    // Right-click the pile: its list.
    let pile = (await piles(page))[0];
    await page.mouse.click(pile.px, pile.py, { button: 'right' });
    const win = page.locator('[data-pile-window]');
    await expect(win).toBeVisible();
    await expect(win.locator('[data-pile-take]')).toHaveCount(5);
    await shot(page, 'pile-list-1280');
    await win.locator('[data-pile-take]').first().click();
    await expect.poll(() => bagIds(page).then(ids => ids.length), { timeout: 8000 }).toBe(2);
    await expect(win.locator('[data-pile-take]')).toHaveCount(4, { timeout: 5000 });
    await win.locator('[data-pile-all]').click();
    await expect.poll(() => bagIds(page).then(ids => ids.length), { timeout: 8000 }).toBe(6);
    await expect.poll(async () => (await piles(page)).length).toBe(0);
    await expect(win).toHaveCount(0, { timeout: 5000 });
    // The staff never moved through any of it.
    const book2 = await openSatchel(page);
    expect(await cellOf(book2, 'k-staff')).toBe(staffAt);
    pile = { ...pile };
  });

  test('walking over an item never picks it up; Gold still comes by itself; Alt shows every label', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, { 'godforge-inventory': inventory([KEEP]) });
    const ore = await g(page, h => h.lay('ore', 0, 0, 3));
    await page.waitForTimeout(2500);
    expect(await has(page, ore.id), 'ore at the Keeper\'s feet stays on the ground').toBe(true);
    const gold = await g(page, h => h.lay('gold', 0, 0, 25));
    await expect.poll(() => has(page, gold.id), { timeout: 6000 }).toBe(false);
    expect(await has(page, ore.id)).toBe(true);
    // Alt held: labels; let go: back.
    expect(await g(page, h => h.labels())).toBe(false);
    await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
    await page.keyboard.down('Alt');
    await expect.poll(() => g(page, h => h.labels())).toBe(true);
    await page.mouse.move(5, 5);
    await shot(page, 'alt-labels-1280');
    await page.keyboard.up('Alt');
    await expect.poll(() => g(page, h => h.labels())).toBe(false);
  });

  test('a full satchel refuses a pickup: "Too much baggage", and it stays on the ground', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // 57 rings and the three starter tools fill the 10×6 satchel (every piece one cell).
    const rings = Array.from({ length: 57 }, (_, i) => gear(`r${String(i).padStart(2, '0')}`, 'anchor-ring', 'Anchor Ring', i, { stats: { defense: i + 1 } }));
    await enter(page, { 'godforge-inventory': inventory(rings) });
    const book = await openSatchel(page);
    await expect(book.locator('[data-grid="b"] .ig-piece')).toHaveCount(60);
    await closeSatchel(page);
    const ore = await g(page, h => h.lay('ore', 0, 0, 3));
    await page.waitForTimeout(300);
    const pile = (await piles(page)).find(p => p.ids.includes(ore.id))!;
    await page.mouse.click(pile.px, pile.py, { button: 'right' });
    const win = page.locator('[data-pile-window]');
    await expect(win).toBeVisible();
    await win.locator('[data-pile-take]').first().click();
    await expect(page.locator('.objective')).toContainText(/Too much baggage/, { timeout: 5000 });
    await page.waitForTimeout(800);
    expect(await has(page, ore.id)).toBe(true);
  });

  test('a Spellstone\'s card: its picture, "Put on belt" and "Use", never Equip', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, { 'godforge-inventory': inventory([stone('st-1'), KEEP], { 'minor-health-potion': 2 }) });
    const book = await openSatchel(page);
    await book.locator('[data-grid="b"] [data-ids="st-1"]').click();
    const card = page.locator('.d2tip--pinned');
    await expect(card).toBeVisible();
    await expect(card.locator('.d2tip__icon img')).toHaveAttribute('src', /.+/);
    await expect(card.locator('[data-stone-belt]')).toHaveText('Put on belt');
    await expect(card.locator('[data-stone-use]')).toHaveText('Use');
    await expect(card.getByRole('button', { name: /^(Equip|Wear)$/ })).toHaveCount(0);
    await shot(page, 'stone-card-1280');
    await card.locator('[data-stone-belt]').click();
    await expect(page.locator('.td-stone, [data-kind="stone"]').first()).toHaveAttribute('data-stone', /hellfire-nova@1#0/, { timeout: 5000 });
    // A potion's card: Put on belt too.
    await closeSatchel(page);
    const book2 = await openSatchel(page);
    await book2.locator('[data-grid="b"] [data-stack="minor-health-potion"]').click();
    await expect(page.locator('.d2tip--pinned [data-potion-belt]')).toHaveText('Put on belt');
  });
});

async function touchCtx(browser: Browser, w: number, h: number) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  return { ctx, page };
}

test.describe('phones', () => {
  test.describe.configure({ timeout: 150000 });

  test('390×844 touch: tap a satchel piece, tap the Vault (tap-to-move); Deposit all; Sort', async ({ browser }) => {
    const { ctx, page } = await touchCtx(browser, 390, 844);
    await enter(page, { 'godforge-inventory': inventory([...FIVE, KEEP], { 'cinder-ore': 4, 'minor-health-potion': 2 }) }, '&at=vault');
    const stash = page.locator('[data-vault-stash]');
    await expect(stash).toBeVisible({ timeout: 20000 });
    const tab = stash.locator('[data-grid="general-1"]'), bag = stash.locator('[data-grid="b"]');
    // Tap the ring: it lights up; tap a cell of the stash: it moves there.
    await bag.locator('[data-ids="d-ring"]').scrollIntoViewIfNeeded();
    await bag.locator('[data-ids="d-ring"]').tap();
    await expect(bag.locator('[data-ids="d-ring"]')).toHaveClass(/is-sel/);
    await shot(page, 'tap-select-390');
    await tab.scrollIntoViewIfNeeded();
    const t = (await tab.boundingBox())!;
    await page.touchscreen.tap(t.x + t.width - 8, t.y + 8);
    await expect.poll(async () => ((await save(page)).records.find((r: { id: string }) => r.id === 'd-ring'))?.location).toEqual({ kind: 'explorer', explorerId: 'vault:general-1' });
    // Tapping a piece twice lets it go (nothing moves).
    await bag.locator('[data-ids="d-helm"]').tap();
    await expect(bag.locator('[data-ids="d-helm"]')).toHaveClass(/is-sel/);
    await bag.locator('[data-ids="d-helm"]').tap();
    await expect(bag.locator('[data-ids="d-helm"]')).not.toHaveClass(/is-sel/);
    // Deposit all: everything but what the belt draws from (the health potion on Q).
    await page.locator('[data-vault-deposit]').tap();
    await expect(bag.locator('.ig-piece:not([data-stack="minor-health-potion"])')).toHaveCount(0, { timeout: 5000 });
    await expect(bag.locator('[data-stack="minor-health-potion"]')).toHaveCount(1);
    await expect(tab.locator('[data-ids="k-staff"]')).toHaveCount(1);
    await expect(tab.locator('[data-stack="cinder-ore"]')).toHaveAttribute('data-qty', '4');
    // Sort the tab: kind, then rarity, then name (the ore, a material, goes last).
    await page.locator('[data-vault-sort]').tap();
    const order = await tab.locator('.ig-piece').evaluateAll(els => els.map(e => ({ cell: Number(e.getAttribute('data-cell')), stack: e.getAttribute('data-stack') })).sort((a, b) => a.cell - b.cell));
    expect(order[0].cell).toBe(0);
    expect(order.map(o => o.cell)).toEqual(order.map((_, i) => i));
    expect(order[order.length - 1].stack).toBe('cinder-ore');
    await shot(page, 'vault-sorted-390');
    // Take all back.
    await page.locator('[data-vault-takeall]').tap();
    await expect(tab.locator('.ig-piece')).toHaveCount(0, { timeout: 5000 });
    await ctx.close();
  });

  test('360×640 touch: drop two, tap the pile, Take all; the labels toggle', async ({ browser }) => {
    const { ctx, page } = await touchCtx(browser, 360, 640);
    await enter(page, { 'godforge-inventory': inventory([FIVE[0], FIVE[2], KEEP]) });
    await page.getByRole('button', { name: /^Satchel/ }).first().tap();
    const book = page.locator('#satchel-book');
    await expect(book.locator('[data-grid="b"]')).toBeVisible();
    for (const id of ['d-helm', 'd-ring']) {
      await book.locator(`[data-grid="b"] [data-ids="${id}"]`).tap();
      await page.locator('.d2tip--pinned [data-drop-item]').tap();
      await expect(book.locator(`[data-grid="b"] [data-ids="${id}"]`)).toHaveCount(0);
    }
    await closeSatchel(page);
    await expect.poll(async () => (await piles(page)).map(p => p.n)).toEqual([2]);
    const pile = (await piles(page))[0];
    await page.touchscreen.tap(pile.px, pile.py);
    const win = page.locator('[data-pile-window]');
    await expect(win).toBeVisible();
    await shot(page, 'pile-list-360');
    await win.locator('[data-pile-all]').tap();
    await expect.poll(() => bagIds(page).then(ids => ids.sort()), { timeout: 8000 }).toHaveLength(3);
    await expect.poll(async () => (await piles(page)).length).toBe(0);
    // The labels toggle (Alt's place on a phone).
    const toggle = page.locator('button[data-loot-labels]');
    await toggle.tap();
    await expect.poll(() => g(page, h => h.labels())).toBe(true);
    await toggle.tap();
    await expect.poll(() => g(page, h => h.labels())).toBe(false);
    await ctx.close();
  });
});
