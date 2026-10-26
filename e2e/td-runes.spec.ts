/**
 * td-runes.spec.ts — runes, runewords and the district shops (docs/design/runewords.md, docs/design/shops.md):
 *  - a shop's shelf and the satchel: buy by dragging an offer into the satchel, sell by dragging a piece back;
 *  - the Enchanting Table: drag a rune onto a socketed normal base, complete a runeword (its name turns gold),
 *    and a rune dropped onto a piece with no sockets is refused (nothing spent);
 *  - away from the table the satchel refuses to set a rune;
 *  - 360×640 by touch: every control of a shop can be reached and hit.
 *
 * Screenshots: docs/handoff/runes/{shop,table,runeword}-1280.png and shop-360.png.
 */
import * as fs from 'fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';

const SHOTS = 'docs/handoff/runes';
const canvas = (page: Page) => page.locator('.viewport canvas');
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

function gear(id: string, definitionId: string, name: string, i: number, extra: Record<string, unknown> = {}): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'common', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: { spellDamage: 3 + i }, sellValue: 40, econ: 3, location: { kind: 'bag' }, itemLevel: 10, ...extra,
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

const STAFF = gear('g-staff', 'keeper-staff', 'Keeper Staff', 0, { sockets: [null, null] });
const RING = gear('g-ring', 'anchor-ring', 'Anchor Ring', 1, { rarity: 'rare', stats: { defense: 4 } });

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

const save = (page: Page, key = 'godforge-inventory') => page.evaluate(k => {
  const raw = JSON.parse(localStorage.getItem(k) || 'null');
  return raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
}, key);
const rec = async (page: Page, id: string) => ((await save(page))?.records ?? []).find((r: { id: string }) => r.id === id);
/** How many of a stack the open grid shows (its piles' counts added up; 0 when none). */
const stack = (page: Page, key: string) => page.evaluate(k => {
  const grid = document.querySelector('section.place [data-grid="b"], #satchel-book [data-grid="b"]');
  return [...(grid?.querySelectorAll(`[data-stack="${k}"]`) ?? [])].reduce((n, el) => n + Number(el.getAttribute('data-qty') || 0), 0);
}, key);
const gold = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-economy') || 'null');
  const e = raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
  return Number(e?.gold ?? 0);
});

async function dragTo(page: Page, from: Locator, to: Locator, toOffset?: { x: number; y: number }): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  await page.mouse.move(a.x + Math.min(10, a.width / 2), a.y + Math.min(10, a.height / 2));
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 4 });
  const b = (await to.boundingBox())!;
  const tx = toOffset ? b.x + toOffset.x : b.x + b.width / 2, ty = toOffset ? b.y + toOffset.y : b.y + b.height / 2;
  await page.mouse.move(tx, ty, { steps: 8 });
  await page.mouse.up();
}

test.describe('the district shops', () => {
  test.describe.configure({ timeout: 120000 });

  test('buy by dragging an offer into the satchel; sell by dragging a piece onto the shelf', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, {
      'godforge-inventory': inventory([RING], { 'cinder-ore': 10 }),
      'godforge-economy': { version: 3, goldEra: 1, gold: 5000, totalGoldEarned: 5000, runGoldEarned: 5000 },
    }, '&at=shop-general');
    const shelf = page.locator('[data-shop-shelf]');
    await expect(shelf).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-shop-keeper]')).toContainText('Edrin Kade');
    const bag = page.locator('section.place [data-grid="b"]');
    await page.mouse.move(5, 5);
    await page.waitForTimeout(600);
    await shot(page, 'shop-1280');

    // Buy: a torch dragged from the shelf into the satchel.
    const before = await gold(page);
    await dragTo(page, shelf.locator('[data-offer="gen-torch"]'), bag, { x: 200, y: 150 });
    await expect.poll(() => stack(page, 'torch')).toBe(1);
    await expect.poll(() => gold(page)).toBeLessThan(before);
    await expect(page.locator('[data-shop-announce]')).toContainText(/Bought Torch/);

    // Sell: the ore pile dragged back onto the shelf.
    const mid = await gold(page);
    await dragTo(page, bag.locator('[data-stack="cinder-ore"]'), shelf);
    await expect.poll(() => stack(page, 'cinder-ore')).toBe(0);
    await expect.poll(() => gold(page)).toBeGreaterThan(mid);
    // And a piece of gear: the General Store buys gear.
    await dragTo(page, bag.locator('[data-ids="g-ring"]'), shelf);
    await expect.poll(async () => !!(await rec(page, 'g-ring'))).toBe(false);

    // A click opens the offer's card; its button buys too. (A click straight after a drop is the drop's own: wait.)
    await page.waitForTimeout(500);
    await shelf.locator('[data-offer="gen-ladder"]').click();
    await expect(page.locator('[data-shop-card]')).toBeVisible();
    await page.locator('[data-shop-buy]').click();
    await expect.poll(() => stack(page, 'ladder')).toBe(1);
  });
});

test.describe('runes at the Enchanting Table', () => {
  test.describe.configure({ timeout: 120000 });

  test('drag runes onto a socketed base to make a runeword; a piece with no sockets refuses', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, { 'godforge-inventory': inventory([STAFF, RING], { 'rune-ember': 1, 'rune-drift': 1, 'rune-ash': 1 }) }, '&at=enchanting');
    const grid = page.locator('[data-table-grid] [data-grid="b"]');
    await expect(grid).toBeVisible({ timeout: 20000 });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(600);
    await shot(page, 'table-1280');

    // Refused: a rune onto the ring (no sockets). Nothing is spent.
    await dragTo(page, grid.locator('[data-stack="rune-ash"]'), grid.locator('[data-ids="g-ring"]'));
    await expect(page.locator('section.place')).toContainText(/has no sockets/);
    expect(await stack(page, 'rune-ash')).toBe(1);

    // Ember, then Drift, into the two-well normal staff: Ashwake.
    await dragTo(page, grid.locator('[data-stack="rune-ember"]'), grid.locator('[data-ids="g-staff"]'));
    await expect.poll(async () => (await rec(page, 'g-staff'))?.sockets).toEqual(['ember', null]);
    expect(await stack(page, 'rune-ember')).toBe(0);
    await dragTo(page, grid.locator('[data-stack="rune-drift"]'), grid.locator('[data-ids="g-staff"]'));
    await expect.poll(async () => (await rec(page, 'g-staff'))?.sockets).toEqual(['ember', 'drift']);
    // The runeword: the piece now names itself Ashwake.
    await expect(grid.locator('[data-ids="g-staff"]')).toHaveAttribute('aria-label', /Ashwake/);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    await shot(page, 'runeword-1280');
  });

  test('away from the table, the satchel will not set a rune', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, { 'godforge-inventory': inventory([STAFF], { 'rune-ember': 1 }) });
    await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
    await page.keyboard.press('i');
    const book = page.locator('#satchel-book');
    await expect(book.locator('[data-grid="b"]')).toBeVisible();
    await dragTo(page, book.locator('[data-stack="rune-ember"]'), book.locator('[data-ids="g-staff"]'));
    await expect(page.locator('.td-toast, .objective, .msg').filter({ hasText: /Set runes at an Enchanting Table/ }).first()).toBeAttached();
    expect(await stack(page, 'rune-ember')).toBe(1);
    expect((await rec(page, 'g-staff'))?.sockets).toEqual([null, null]);
  });
});

test('360×640, by touch: every control of a shop can be reached and hit', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const reachAll = (sel: string) => page.evaluate(async s => {
    const root = document.querySelector(s);
    if (!root) return ['no ' + s];
    const misses: string[] = [];
    const ctrls = [...root.querySelectorAll('button, input, select, a[href]')].filter(el => {
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
  await enter(page, { 'godforge-inventory': inventory([RING], { 'cinder-ore': 4 }), 'godforge-economy': { version: 3, goldEra: 1, gold: 5000, totalGoldEarned: 5000, runGoldEarned: 5000 } }, '&at=shop-general');
  await expect(page.locator('[data-shop-shelf]')).toBeVisible({ timeout: 20000 });
  expect(await reachAll('section.place')).toEqual([]);
  // A card's buttons too: tap an offer (a phone's tap is a click), then reach the card.
  await page.locator('[data-offer="gen-torch"]').tap();
  await expect(page.locator('[data-shop-card]')).toBeVisible();
  expect(await reachAll('section.place')).toEqual([]);
  await page.locator('[data-shop-buy]').tap();
  await expect.poll(() => stack(page, 'torch')).toBe(1);
  await shot(page, 'shop-360');
  await ctx.close();
});
