/**
 * td-grid.spec.ts — the D2 / PoE2 satchel grid (docs/design/inventory-grid.md): drag to equip, drag into the Vault at
 * a Vault (and no stash anywhere else), a pickup refused by a full grid, and a phone's long-press then tap.
 *
 * Screenshots: docs/handoff/grid/{satchel,vault,full}-1280.png and {satchel,vault}-390.png.
 */
import * as fs from 'fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';

const SHOTS = 'docs/handoff/grid';
const canvas = (page: Page) => page.locator('.viewport canvas');
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

function gear(id: string, definitionId: string, name: string, i: number, location: unknown = { kind: 'bag' }, extra: Record<string, unknown> = {}): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: { defense: 4 + i }, sellValue: 90, econ: 3, location, itemLevel: 3, ...extra,
  };
}
const stackRec = (key: string) => ({
  id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 90, deviceId: 'e2e', sequence: 1 }, source: 'inventory', stackKey: key, location: { kind: 'bag' },
});
const grant = (key: string, qty: number, n: number) => ({ id: `e2e-grant-${key}`, stackKey: key, kind: 'grant', quantity: qty, hlc: 80 + n, deviceId: 'e2e', sequence: n });

function inventory(records: unknown[], stacks: Record<string, number> = {}): unknown {
  const keys = Object.keys(stacks);
  return {
    version: 2, records: [...records, ...keys.map(stackRec)], tombstones: [],
    stackOps: keys.map((k, i) => grant(k, stacks[k], i + 1)), goldFromSales: 0, sold: 0, hlc: 500, legacyBackup: null, era: ERA,
  };
}

const BASIC = [
  gear('g-staff', 'keeper-staff', 'Keeper Staff', 0),
  gear('g-plate', 'infernal-cuirass', 'Infernal Cuirass', 1),
  gear('g-ring', 'anchor-ring', 'Anchor Ring', 2),
];

async function enter(page: Page, blobs: Record<string, unknown>, query = ''): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Ilsa', vocation: 'ashguard', tree: { spent: {}, free: [], at: 1 } },
    ...blobs,
  });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
  await page.waitForTimeout(500);
}

const save = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-inventory') || 'null');
  return raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
});
const rec = async (page: Page, id: string) => ((await save(page))?.records ?? []).find((r: { id: string }) => r.id === id);

async function openSatchel(page: Page): Promise<Locator> {
  await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
  await page.keyboard.press('i');
  const book = page.locator('#satchel-book');
  await expect(book).toBeVisible();
  await expect(book.locator('[data-grid="b"]')).toBeVisible();
  return book;
}

/** A mouse drag from one element's centre (or a cell offset) to another's. */
async function dragTo(page: Page, from: Locator, to: Locator, toOffset?: { x: number; y: number }): Promise<void> {
  const a = (await from.boundingBox())!, b = (await to.boundingBox())!;
  await page.mouse.move(a.x + Math.min(10, a.width / 2), a.y + Math.min(10, a.height / 2));
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 4 });
  const tx = toOffset ? b.x + toOffset.x : b.x + b.width / 2, ty = toOffset ? b.y + toOffset.y : b.y + b.height / 2;
  await page.mouse.move(tx, ty, { steps: 8 });
  await page.mouse.up();
}

test.describe('the satchel grid', () => {
  test.describe.configure({ timeout: 120000 });

  test('every item covers one cell; drag one to a cell, then onto the doll to wear it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, { 'godforge-inventory': inventory(BASIC, { 'minor-health-potion': 5, 'basalt-blank': 3 }) });
    const book = await openSatchel(page);
    const grid = book.locator('[data-grid="b"]');
    const plate = grid.locator('[data-ids="g-plate"]');
    // 1×1 everywhere (owner 2026-10-26): a cuirass and a staff take one cell, like a ring.
    await expect(plate).toHaveAttribute('data-w', '1');
    await expect(plate).toHaveAttribute('data-h', '1');
    await expect(grid.locator('[data-ids="g-staff"]')).toHaveAttribute('data-h', '1');
    await expect(grid.locator('[data-ids="g-ring"]')).toHaveAttribute('data-w', '1');
    await expect(grid.locator('[data-stack="minor-health-potion"]')).toHaveAttribute('data-qty', '5');
    await page.mouse.move(5, 5);
    await page.waitForTimeout(700); // the window fades in
    await shot(page, 'satchel-1280');

    // Move the ring to the bottom-right cell: only its place is written.
    const box = (await grid.boundingBox())!;
    const cols = Number(await grid.getAttribute('data-cols')), rows = Number(await grid.getAttribute('data-rows'));
    const cw = box.width / cols, ch = box.height / rows;
    await dragTo(page, grid.locator('[data-ids="g-ring"]'), grid, { x: box.width - cw / 2, y: box.height - ch / 2 });
    await expect(grid.locator('[data-ids="g-ring"]')).toHaveAttribute('data-cell', String(cols * rows - 1));
    await expect.poll(async () => (await rec(page, 'g-ring'))?.pos?.c?.[0]).toBe(cols * rows - 1);
    expect((await rec(page, 'g-ring')).revision.hlc).toBe(102); // a move inside the satchel never touches the record

    // Drag the cuirass onto the chest well: it is worn.
    await dragTo(page, plate, book.locator('.well[data-slot="chest"]'));
    await expect.poll(async () => (await rec(page, 'g-plate'))?.location).toEqual({ kind: 'equipped', slotId: 'chest' });
    await expect(grid.locator('[data-ids="g-plate"]')).toHaveCount(0);
    await expect(book.locator('.well[data-slot="chest"]')).toHaveClass(/filled/);

    // And back off the doll into a chosen cell.
    await dragTo(page, book.locator('.well[data-slot="chest"]'), grid, { x: cw * 6 + 4, y: ch * 2 + 4 });
    await expect.poll(async () => (await rec(page, 'g-plate'))?.location).toEqual({ kind: 'bag' });
    await expect(grid.locator('[data-ids="g-plate"]')).toHaveAttribute('data-cell', String(cols * 2 + 6));
  });

  test('a full grid refuses a pickup: the item stays on the ground, with the reason', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // 57 rings and the three starter tools (one cell each) fill every cell of a 10×6 satchel.
    const rings = Array.from({ length: 57 }, (_, i) => gear(`g-r${String(i).padStart(2, '0')}`, 'anchor-ring', 'Anchor Ring', i, { kind: 'bag' }, { stats: { defense: i + 1 } }));
    await enter(page, { 'godforge-inventory': inventory(rings) }, '&fxgrid=1');
    const book = await openSatchel(page);
    await expect(book.locator('[data-grid="b"] .ig-piece')).toHaveCount(60);
    await expect(book.locator('[data-no-room]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    // A drop at the Keeper's feet, walked over: refused, and it stays.
    await expect.poll(() => page.evaluate(() => !!(window as unknown as { __tdGrid?: unknown }).__tdGrid), { timeout: 10000 }).toBe(true);
    const took = await page.evaluate(() => (window as unknown as { __tdGrid: { pickup(def: string): boolean } }).__tdGrid.pickup('astral-helm'));
    expect(took).toBe(false);
    await expect(page.locator('.objective')).toContainText(/Too much baggage/);
    // And away from a Vault, nothing moves into it.
    expect(await page.evaluate(() => (window as unknown as { __tdGrid: { toVault(id: string): string } }).__tdGrid.toVault('g-r00'))).toBe('vault-closed');
    expect(((await save(page)).records as { kind: string }[]).filter(r => r.kind === 'instance').length).toBe(57 + 3); // + the starter tools
    await page.mouse.move(5, 5);
    await page.waitForTimeout(700);
    await shot(page, 'full-1280');
  });
});

test.describe('the Vault: a stash grid beside the satchel, only at a Vault', () => {
  test.describe.configure({ timeout: 120000 });

  test('no stash away from a Vault; at the Vault, drag a piece in and a stack out', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, { 'godforge-inventory': inventory([
      ...BASIC,
      gear('g-helm', 'astral-helm', 'Astral Helm', 5, { kind: 'explorer', explorerId: 'vault:general-1' }),
    ], { 'cinder-ore': 12 }) });
    // Away from a Vault the satchel has no stash, and no "Send to Vault" anywhere.
    const book = await openSatchel(page);
    await expect(page.locator('[data-grid="general-1"]')).toHaveCount(0);
    await book.locator('[data-ids="g-ring"]').click();
    await expect(page.locator('.d2tip--pinned')).toBeVisible();
    await expect(page.locator('.d2tip--pinned')).not.toContainText(/Vault/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // At the Vault: the stash and the satchel side by side.
    await page.goto('/play?td=1&hour=12&at=vault');
    const stash = page.locator('[data-vault-stash]');
    await expect(stash).toBeVisible({ timeout: 20000 });
    const tab = stash.locator('[data-grid="general-1"]'), bag = stash.locator('[data-grid="b"]');
    await expect(tab.locator('[data-ids="g-helm"]')).toBeVisible();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(700);
    await shot(page, 'vault-1280');

    // The ring into the stash.
    await dragTo(page, bag.locator('[data-ids="g-ring"]'), tab, { x: 120, y: 120 });
    await expect.poll(async () => (await rec(page, 'g-ring'))?.location).toEqual({ kind: 'explorer', explorerId: 'vault:general-1' });
    await expect(tab.locator('[data-ids="g-ring"]')).toBeVisible();
    // The ore pile into the stash: a consume and a grant, the total kept.
    await dragTo(page, bag.locator('[data-stack="cinder-ore"]'), tab, { x: 10, y: 200 });
    await expect(tab.locator('[data-stack="cinder-ore"]')).toHaveAttribute('data-qty', '12');
    await expect(bag.locator('[data-stack="cinder-ore"]')).toHaveCount(0);
    // And the helm out into the satchel.
    const bb = (await bag.boundingBox())!;
    await dragTo(page, tab.locator('[data-ids="g-helm"]'), bag, { x: (bb.width / 10) * 7 + 4, y: 4 });
    await expect.poll(async () => (await rec(page, 'g-helm'))?.location).toEqual({ kind: 'bag' });
  });

  test('a phone: long-press to pick up, tap a cell to place', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await enter(page, { 'godforge-inventory': inventory(BASIC, { 'cinder-ore': 4 }) }, '&at=vault');
    const stash = page.locator('[data-vault-stash]');
    await expect(stash).toBeVisible({ timeout: 20000 });
    const tab = stash.locator('[data-grid="general-1"]'), bag = stash.locator('[data-grid="b"]');
    await shot(page, 'vault-390');
    await bag.locator('[data-ids="g-ring"]').scrollIntoViewIfNeeded();
    const ring = (await bag.locator('[data-ids="g-ring"]').boundingBox())!;
    const cdp = await ctx.newCDPSession(page);
    const touch = (type: string, x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', ring.x + 8, ring.y + 8);
    await page.waitForTimeout(600);
    await touch('touchEnd', ring.x + 8, ring.y + 8);
    await expect(stash.locator('.vs-hold')).toBeVisible();
    await tab.scrollIntoViewIfNeeded();
    const t = (await tab.boundingBox())!;
    await touch('touchStart', t.x + 60, t.y + 60);
    await touch('touchEnd', t.x + 60, t.y + 60);
    await expect.poll(async () => (await rec(page, 'g-ring'))?.location).toEqual({ kind: 'explorer', explorerId: 'vault:general-1' });
    await ctx.close();
  });
});

test('360×640, by touch: every control of the satchel and the Vault can be reached and hit', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const reachAll = (sel: string) => page.evaluate(async s => {
    const root = document.querySelector(s);
    if (!root) return ['no ' + s];
    const misses: string[] = [];
    const ctrls = [...root.querySelectorAll('button, [data-belt], input, select')].filter(el => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[hidden], [inert]');
    });
    for (const el of ctrls) {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = el.getBoundingClientRect();
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(el === hit || el.contains(hit))) misses.push((el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.tagName).slice(0, 40));
    }
    return misses;
  }, sel);
  await enter(page, { 'godforge-inventory': inventory(BASIC, { 'minor-health-potion': 3 }) });
  await page.getByRole('button', { name: /^Satchel/ }).first().tap();
  await expect(page.locator('#satchel-book [data-grid="b"]')).toBeVisible();
  expect(await reachAll('#satchel-book')).toEqual([]);
  await page.goto('/play?td=1&hour=12&at=vault');
  await expect(page.locator('[data-vault-stash]')).toBeVisible({ timeout: 20000 });
  expect(await reachAll('section.place')).toEqual([]);
  await ctx.close();
});

test('390×844: the satchel grid on a phone (screenshot)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await enter(page, { 'godforge-inventory': inventory(BASIC, { 'minor-health-potion': 3, 'basalt-blank': 2 }) });
  await page.getByRole('button', { name: /^Satchel/ }).first().tap();
  await expect(page.locator('#satchel-book [data-grid="b"]')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, 'satchel-390');
  await ctx.close();
});
