/**
 * td-satchel-phone.spec.ts — the satchel and the Vault on a phone (docs/design/ui-pass-3.md §A.3, §A.5; Accept 8–13).
 *
 *   8. At 360×640 and 390×844 the Bag tab shows the whole first page (5 × 6 cells of 64 px), the belt strip and the
 *      foot without scrolling.
 *   9. Every pocket, well, tab and button of the satchel and the Vault is ≥ 44 px at 360, 390 and 844×390.
 *  10. The pages are the stored grid: a piece at cell 7 is on page 2, column 2, row 0; dragged to page 1 column 2 it
 *      is stored at cell 2 (the mapping itself is unit-tested in grid-pages.spec.ts).
 *  11. A tapped wearable's card leaves the piece in view, shows the compare strip, and its primary Equip equips.
 *  12. By touch (CDP touch events): a long-press drag across the pages through the ◀ / ▶ hover, and from the Bag onto
 *      the Worn chip (rest, then drop on the slot).
 *  13. The Vault at 360×640: Vault | Satchel each shows its whole grid; a deposit by the card and by a drag onto the
 *      other chip both land; the tab row is wood chips, not a brass bar.
 */
import * as fs from 'fs';
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const canvas = (page: Page) => page.locator('.viewport canvas');
const SHOTS = process.env['UIWA_SHOTS'] ?? '';

function gear(id: string, definitionId: string, name: string, i: number, extra: Record<string, unknown> = {}): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: { defense: 4 + i }, sellValue: 90, econ: 3, location: { kind: 'bag' }, itemLevel: 3, ...extra,
  };
}
const stackRec = (key: string) => ({
  id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 90, deviceId: 'e2e', sequence: 1 }, source: 'inventory', stackKey: key, location: { kind: 'bag' },
});
const grant = (key: string, qty: number, n: number) => ({ id: `e2e-grant-${key}`, stackKey: key, kind: 'grant', quantity: qty, hlc: 80 + n, deviceId: 'e2e', sequence: n });
function inventory(records: unknown[], stacks: Record<string, number> = {}): unknown {
  const keys = Object.keys(stacks);
  return { version: 2, records: [...records, ...keys.map(stackRec)], tombstones: [], stackOps: keys.map((k, i) => grant(k, stacks[k], i + 1)), goldFromSales: 0, sold: 0, hlc: 500, legacyBackup: null, era: ERA };
}
/** A piece stored at cell 7 of the 10-wide grid (as a desktop would put it). */
const AT7 = { pos: { k: 'b', c: [7], r: { hlc: 400, deviceId: 'e2e', sequence: 1 } } };
const BAG = [
  gear('g-ring', 'anchor-ring', 'Anchor Ring', 2, AT7),
  gear('g-plate', 'infernal-cuirass', 'Infernal Cuirass', 1),
  gear('g-staff', 'keeper-staff', 'Keeper Staff', 0),
];
const STACKS = { 'cinder-ore': 24, 'ember-residue': 6, 'minor-health-potion': 5, 'minor-mana-potion': 4 };

async function enter(page: Page, query = '', lang = 'en'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'preferred-language': lang,
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Ilsa', vocation: 'ashguard', tree: { spent: {}, free: [], at: 1 } },
    'godforge-inventory': inventory(BAG, STACKS),
  });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  await page.waitForTimeout(600);
}
const save = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-inventory') || 'null');
  return raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
});
const rec = async (page: Page, id: string) => ((await save(page))?.records ?? []).find((r: { id: string }) => r.id === id);
const openBag = async (page: Page) => {
  await page.locator('[data-th="bag"]').tap();
  await expect(page.locator('#satchel-book')).toBeVisible();
  await page.waitForTimeout(400);
};
const center = async (page: Page, sel: string) => { const b = (await page.locator(sel).first().boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

/** A finger: down, hold, then glide to each point (resting `rest` ms at each), then up. */
async function fingerDrag(cdp: CDPSession, from: { x: number; y: number }, path: { x: number; y: number; rest?: number }[], page: Page): Promise<void> {
  const touch = (type: string, x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }] });
  await touch('touchStart', from.x, from.y);
  await page.waitForTimeout(450);
  let at = from;
  for (const p of path) {
    for (let i = 1; i <= 6; i++) { await touch('touchMove', at.x + (p.x - at.x) * i / 6, at.y + (p.y - at.y) * i / 6); await page.waitForTimeout(16); }
    at = p;
    if (p.rest) await page.waitForTimeout(p.rest);
  }
  await touch('touchEnd', at.x, at.y);
}

/** Every visible control inside `root` under 44 px (by its smaller side). */
const smalls = (page: Page, root: string) => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return ['no ' + s];
  return [...el.querySelectorAll('button, [role="tab"], [data-belt], .ig-piece, .well, .ig-cell')].filter(e => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]');
  }).filter(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5; })
    .map(e => `${(e.getAttribute('aria-label') || (e as HTMLElement).innerText || e.className.toString()).trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`);
}, root);

for (const size of [{ name: '360x640', width: 360, height: 640 }, { name: '390x844', width: 390, height: 844 }]) {
  test.describe(`the satchel on a phone at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });

    test('Bag: the whole first page (5 × 6 at 64 px), the belt strip and the foot, no scrolling; every target ≥ 44', async ({ page }) => {
      test.setTimeout(90_000);
      await enter(page);
      await openBag(page);
      const book = page.locator('#satchel-book');
      await expect(book).toHaveAttribute('data-bag-tab', 'bag');
      const m = await page.evaluate(() => {
        const r = (s: string) => { const e = document.querySelector(s)!.getBoundingClientRect(); return { t: e.top, b: e.bottom, l: e.left, r: e.right, w: e.width, h: e.height }; };
        const grid = document.querySelector('#satchel-book [data-grid="b"]')!;
        const body = document.querySelector('#satchel-book .book-body')!;
        return { grid: r('#satchel-book [data-grid="b"]'), cell: r('#satchel-book [data-grid="b"] .ig-cell'), cells: grid.querySelectorAll('.ig-cell').length,
          belt: r('#satchel-book [data-belt-strip]'), foot: r('#satchel-book .book-purse'), pages: r('#satchel-book [data-bag-pages]'),
          scrolls: body.scrollHeight > body.clientHeight + 1, vh: innerHeight, vw: innerWidth };
      });
      expect(Math.round(m.cell.w)).toBe(64);
      expect(m.cells).toBe(30);                    // 5 columns × 6 rows of the stored grid
      expect(Math.round(m.grid.h)).toBe(6 * 64);
      for (const part of [m.grid, m.belt, m.foot, m.pages]) { expect(part.b).toBeLessThanOrEqual(m.vh); expect(part.t).toBeGreaterThanOrEqual(0); expect(part.r).toBeLessThanOrEqual(m.vw); }
      expect(m.scrolls, 'the Bag tab does not scroll').toBe(false);
      expect(await smalls(page, '#satchel-book')).toEqual([]);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/satchel-${size.name}.png` }); }
      // Worn and Nearby: their targets too.
      await page.locator('[data-bag-tab="worn"]').tap();
      await expect(book).toHaveAttribute('data-bag-tab', 'worn');
      expect(await smalls(page, '#satchel-book')).toEqual([]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/satchel-worn-${size.name}.png` });
      await page.locator('[data-bag-tab="nearby"]').tap();
      await expect(page.locator('[data-nearby]')).toBeVisible();
      expect(await smalls(page, '#satchel-book')).toEqual([]);
    });

    test('the pages are the stored grid; a long-press drag flips the page and lands at cell 2', async ({ page }) => {
      test.setTimeout(90_000);
      await enter(page);
      await openBag(page);
      // Cell 7 (desktop) is page 2, column 2, row 0.
      await expect(page.locator('#satchel-book [data-ids="g-ring"]')).toHaveCount(0);
      await page.locator('[data-page-next]').tap();
      const ring = page.locator('#satchel-book [data-ids="g-ring"]');
      await expect(ring).toHaveAttribute('data-cell', '7');
      const g = (await page.locator('#satchel-book [data-grid="b"]').boundingBox())!, r = (await ring.boundingBox())!;
      expect(Math.round((r.x - g.x) / 64)).toBe(2);
      expect(Math.round((r.y - g.y) / 64)).toBe(0);
      // Long-press, glide onto ◀ Pocket 1 and rest (the page flips), then onto column 2, row 0, and lift.
      const cdp = await page.context().newCDPSession(page);
      const prev = await center(page, '[data-page-prev]');
      await fingerDrag(cdp, { x: r.x + r.width / 2, y: r.y + r.height / 2 }, [{ ...prev, rest: 650 }, { x: g.x + 2 * 64 + 32, y: g.y + 32 }], page);
      await expect(page.locator('#satchel-book [data-bag-pages]')).toHaveAttribute('data-page', '1');
      await expect.poll(async () => (await rec(page, 'g-ring'))?.pos?.c).toEqual([2]);
      await expect(page.locator('#satchel-book [data-ids="g-ring"]')).toHaveAttribute('data-cell', '2');
      // And back across through ▶ to page 2, column 0, row 1 (cell 15).
      const r2 = (await page.locator('#satchel-book [data-ids="g-ring"]').boundingBox())!;
      const next = await center(page, '[data-page-next]');
      await fingerDrag(cdp, { x: r2.x + 32, y: r2.y + 32 }, [{ ...next, rest: 650 }, { x: g.x + 32, y: g.y + 64 + 32 }], page);
      await expect.poll(async () => (await rec(page, 'g-ring'))?.pos?.c).toEqual([15]);
      // A sideways swipe with nothing held flips the page.
      await expect(page.locator('#satchel-book [data-bag-pages]')).toHaveAttribute('data-page', '2');
      const touch = (type: string, x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await touch('touchStart', g.x + 40, g.y + 300); for (let i = 1; i <= 5; i++) { await touch('touchMove', g.x + 40 + i * 50, g.y + 300); }
      await touch('touchEnd', g.x + 290, g.y + 300);
      await expect(page.locator('#satchel-book [data-bag-pages]')).toHaveAttribute('data-page', '1');
    });

    test('a wearable\'s card: the piece stays in view, the compare strip, Equip equips; a drag onto the Worn chip wears it', async ({ page }) => {
      test.setTimeout(90_000);
      await enter(page);
      await openBag(page);
      // An empty slot on the Worn tab filters the bag to what fits it, best first.
      await page.locator('[data-bag-tab="worn"]').tap();
      await page.locator('#satchel-book .well[data-slot="chest"]').tap();
      await expect(page.locator('[data-worn-fits] [data-fit="g-plate"]')).toBeVisible();
      await page.locator('[data-bag-tab="bag"]').tap();
      const plate = page.locator('#satchel-book [data-ids="g-plate"]');
      await plate.tap();
      const card = page.locator('.d2tip--pinned');
      await expect(card).toBeVisible();
      const pc = (await plate.boundingBox())!, cc = (await card.boundingBox())!;
      const meets = pc.x < cc.x + cc.width && cc.x < pc.x + pc.width && pc.y < cc.y + cc.height && cc.y < pc.y + pc.height;
      expect(meets, 'the card does not hide the piece').toBe(false);
      expect(cc.height).toBeLessThanOrEqual(size.height * .55 + 1);
      await expect(card.locator('.d2tip__compare')).toBeVisible();
      await expect(card.locator('[data-card-verdict]')).toBeVisible();
      const primary = card.locator('[data-card-primary]');
      await expect(primary).toHaveText('Equip');
      expect(Math.round((await primary.boundingBox())!.height)).toBeGreaterThanOrEqual(52);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/satchel-card-${size.name}.png` });
      await primary.tap();
      await expect.poll(async () => (await rec(page, 'g-plate'))?.location?.kind).toBe('equipped');
      // The worn piece's own card says Unequip.
      await expect(card.locator('[data-card-primary]')).toHaveText('Unequip');
      await card.locator('.d2tip__close').tap();
      // A long-press drag of the ring onto the Worn chip: rest, the doll opens, drop on its slot.
      await page.locator('[data-page-next]').tap();
      const ring = (await page.locator('#satchel-book [data-ids="g-ring"]').boundingBox())!;
      const cdp = await page.context().newCDPSession(page);
      const chip = await center(page, '[data-bag-tab="worn"]');
      const touch = (type: string, x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }] });
      await touch('touchStart', ring.x + 32, ring.y + 32);
      await page.waitForTimeout(450);
      for (let i = 1; i <= 8; i++) { await touch('touchMove', ring.x + 32 + (chip.x - ring.x - 32) * i / 8, ring.y + 32 + (chip.y - ring.y - 32) * i / 8); await page.waitForTimeout(16); }
      await page.waitForTimeout(650);
      await expect(page.locator('#satchel-book')).toHaveAttribute('data-bag-tab', 'worn');
      const well = page.locator('#satchel-book .well[data-slot="trinket"]');
      await expect(well).toHaveClass(/is-pulse/);
      const w = (await well.boundingBox())!;
      for (let i = 1; i <= 8; i++) { await touch('touchMove', chip.x + (w.x + w.width / 2 - chip.x) * i / 8, chip.y + (w.y + w.height / 2 - chip.y) * i / 8); await page.waitForTimeout(16); }
      await touch('touchEnd', w.x + w.width / 2, w.y + w.height / 2);
      await expect.poll(async () => (await rec(page, 'g-ring'))?.location?.kind).toBe('equipped');
    });

    test('the Vault: Vault | Satchel shows each whole grid; a deposit by the card and by a drag onto the chip', async ({ page }) => {
      test.setTimeout(90_000);
      await enter(page, '&at=vault');
      const stash = page.locator('[data-vault-stash]');
      await expect(stash).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-vault-switch]')).toBeVisible();
      // The tab row is wood chips, never the full-width brass bar.
      await expect(page.locator('.vs-tabs')).toHaveCount(0);
      const chipW = (await page.locator('[data-vault-tab="general-1"]').boundingBox())!.width;
      expect(chipW).toBeLessThan(size.width * .5);
      // The whole grid: all five columns of its page in view at 64 px, every row inside its own scroll area (a
      // twelve-row tab scrolls there), and the area itself on screen.
      const whole = async (grid: string) => page.evaluate(sel => {
        const g = document.querySelector(sel)!, box = (g.closest('app-item-grid') as HTMLElement).getBoundingClientRect();
        const rows = Number(g.getAttribute('data-rows'));
        return { t: box.top, b: box.bottom, l: box.left, r: box.right, rows, cells: g.querySelectorAll('.ig-cell').length, cw: g.querySelector('.ig-cell')!.getBoundingClientRect().width, vh: innerHeight, vw: innerWidth };
      }, grid);
      const v = await whole('[data-vault-stash] [data-grid="general-1"]');
      expect(Math.round(v.cw)).toBe(64);
      expect(v.cells).toBe(5 * v.rows);
      expect(v.b).toBeLessThanOrEqual(v.vh);
      expect(v.r).toBeLessThanOrEqual(v.vw);
      await expect(stash.locator('[data-grid="b"]')).toBeHidden();
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/vault-${size.name}.png` });
      await page.locator('[data-seg="satchel"]').tap();
      await expect(stash.locator('[data-grid="general-1"]')).toBeHidden();
      const b = await whole('[data-vault-stash] [data-grid="b"]');
      expect(b.cells).toBe(5 * b.rows);
      expect(b.b).toBeLessThanOrEqual(b.vh);
      expect(await smalls(page, '[data-vault-stash]')).toEqual([]);
      // By the card: tap the plate, Deposit.
      await stash.locator('[data-ids="g-plate"]').tap();
      await stash.locator('[data-vault-move="satchel"]').tap();
      await expect.poll(async () => (await rec(page, 'g-plate'))?.location).toEqual({ kind: 'explorer', explorerId: 'vault:general-1' });
      // By a drag onto the Vault chip (it switches, and the piece takes the first free cell).
      const staff = (await stash.locator('[data-ids="g-staff"]').boundingBox())!;
      const chip = await center(page, '[data-seg="vault"]');
      const cdp = await page.context().newCDPSession(page);
      await fingerDrag(cdp, { x: staff.x + 32, y: staff.y + 32 }, [{ ...chip, rest: 80 }], page);
      await expect.poll(async () => (await rec(page, 'g-staff'))?.location).toEqual({ kind: 'explorer', explorerId: 'vault:general-1' });
    });
  });
}

test.describe('the satchel and the Vault sideways (844×390)', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
  test('every pocket, well, tab and button ≥ 44 px', async ({ page }) => {
    test.setTimeout(90_000);
    await enter(page);
    await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
    await page.keyboard.press('i');
    await expect(page.locator('#satchel-book')).toBeVisible();
    await page.waitForTimeout(400);
    expect(await smalls(page, '#satchel-book')).toEqual([]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/satchel-844x390.png` });
    await page.locator('#satchel-book [data-bag-tab="nearby"]').tap();
    await expect(page.locator('[data-nearby]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/play?td=1&hour=12&at=vault');
    await expect(page.locator('[data-vault-stash]')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(400);
    expect(await smalls(page, '[data-vault-stash]')).toEqual([]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/vault-844x390.png` });
  });
});
