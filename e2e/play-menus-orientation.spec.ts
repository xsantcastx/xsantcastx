/**
 * play-menus-orientation.spec.ts — every in-game menu fits the phone it is on,
 * held either way (docs/handoff/menus-orientation.md).
 *
 * One menu system: a portrait phone gets a bottom sheet, a landscape phone a
 * right-hand side panel (the world and the move stick stay in view on the
 * left), a desktop a window. Same title bar and one 44px × close everywhere.
 *
 * At 844×390 (landscape phone) and 360×740 (small portrait phone), for each
 * menu in MENUS:
 *   - it opens;
 *   - no visible element of it lies outside the viewport, and the page does not
 *     scroll sideways;
 *   - its close button (and its primary action, where it has one) is at least
 *     44×44 and a hit test at its centre reaches it;
 *   - in landscape it leaves the left thumb zone (the move stick) uncovered.
 * And: turning the phone mid-menu keeps the menu open and usable.
 *
 * MENUS_MEASURE=1 only measures (no assertions), at every size in ALL_SIZES,
 * writing MENUS_OUT (JSON) and, with MENUS_SHOTS=<dir>/<prefix>, a screenshot
 * per menu and size. That is how the before/after grid was made.
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ERA, ledger, openPlay, purse, seed } from './play-helpers';

const MEASURE_ONLY = !!process.env['MENUS_MEASURE'];
const OUT = process.env['MENUS_OUT'];
const SHOTS = process.env['MENUS_SHOTS'];
const ONLY = process.env['MENUS_ONLY']?.split(',');

interface Size { tag: string; width: number; height: number; touch: boolean; mobile: boolean }
const ALL_SIZES: Size[] = [
  { tag: '390x844', width: 390, height: 844, touch: true, mobile: true },
  { tag: '844x390', width: 844, height: 390, touch: true, mobile: true },
  { tag: '932x430', width: 932, height: 430, touch: true, mobile: true },
  { tag: '360x740', width: 360, height: 740, touch: true, mobile: true },
  { tag: '820x1180', width: 820, height: 1180, touch: true, mobile: false },
  { tag: '1180x820', width: 1180, height: 820, touch: true, mobile: false },
  { tag: '1280x800', width: 1280, height: 800, touch: false, mobile: false },
];
const TEST_SIZES = ALL_SIZES.filter(s => ['844x390', '390x844', '360x740'].includes(s.tag));

interface Menu {
  id: string;
  query?: string;
  /** Opens the menu once /play is up (after `query`). */
  open?: (page: Page) => Promise<void>;
  root: string;
  close: string;
  primary?: string;
}

/**
 * The owner's satchel (bug report, 2026-10-15): materials, a dozen charms (so the doll grows its charm row) and
 * a worn charm — the case that clipped the grid under the wells in portrait and cut the doll off in landscape.
 */
const CHARMS = ['Small Charm of Fortune', 'Student’s Thread', 'Copper Knot', 'Counting Stone', 'Margin Note', 'Verge Compass'];
function satchel(stacks: Record<string, number>): Record<string, unknown> {
  const base = ledger(stacks) as { records: unknown[]; hlc: number };
  const charm = (name: string, i: number, location: unknown = { kind: 'bag' }) => ({
    id: `e2e-charm-${i}`, definitionId: `charm:${name}`, kind: 'instance', category: 'equipment', tags: ['charm'], rarity: 'common',
    soulbound: false, acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 },
    source: 'inventory', name, type: 'charm', stats: { magicFind: 3 }, rollQuality: { magicFind: .5 }, sellValue: 10, location,
  });
  const records = [...base.records, ...Array.from({ length: 12 }, (_, i) => charm(CHARMS[i % CHARMS.length], i)),
    charm('Copper Knot', 40, { kind: 'equipped', slotId: 'charm1' })];
  return { 'godforge-realm-era': String(ERA), 'godforge-inventory': { ...base, records, hlc: 200 } };
}
const STASH = { ...satchel({ 'cinder-ore': 24, 'ember-residue': 6, 'pyrite-dust': 3 }), ...purse(5000), 'preferred-language': 'en' };
const placesItem = (key: string) => async (page: Page) => {
  await page.locator('.places-toggle').first().click();
  await page.locator(`#places-list button[data-open="${key}"]`).click();
};
const station = (at: string, primary = '.place .ab__btn'): Menu => ({ id: at, query: `?at=${at}`, root: '.place', close: '.place-close', primary });
const openSlate = async (page: Page) => { await page.locator('.slate-btn').click(); };

const MENUS: Menu[] = [
  { id: 'places', open: page => page.locator('.places-toggle').first().click(), root: '#places-list', close: '.places-close' },
  { id: 'satchel', open: page => page.locator('.satchel .clasp').click(), root: '#satchel-book', close: '#satchel-book .book-close' },
  {
    id: 'satchel-card', root: '#satchel-book .slip', close: '#satchel-book .slip-x',
    open: async page => { await page.locator('.satchel .clasp').click(); await page.locator('#satchel-book .pocket').first().click(); },
  },
  {
    // A charm's card: the long one (lore, stats, the compare against the worn charm) with Equip as its primary.
    id: 'satchel-charm', root: '#satchel-book .slip', close: '#satchel-book .slip-x', primary: '#satchel-book .slip .wear',
    open: async page => {
      await page.locator('.satchel .clasp').click();
      const charm = page.locator('#satchel-book .pocket[aria-label^="Student"]').first();
      await charm.scrollIntoViewIfNeeded();
      await charm.click();
    },
  },
  {
    id: 'pets', root: '.pet-host .ps', close: '.pet-host .ps__x',
    open: async page => { await page.locator('.satchel .clasp').click(); await page.locator('#satchel-book .pet-well').click(); },
  },
  { id: 'sound', open: placesItem('sound'), root: '.sound-host .ss', close: '.sound-host .ss__done' },
  { id: 'glass', open: placesItem('glass'), root: '.place', close: '.place-close' },
  { id: 'character', open: placesItem('character'), root: '.place', close: '.place-close' },
  station('crafting'), station('runes'), station('enchanting'), station('vault', ''), station('vendor'), station('gambler'),
  station('exchange', ''), station('market', ''), station('quests', ''), station('codex', ''), station('skills', ''),
  station('waystone', ''), station('reels', '.place .rl-spin, .place .ab__btn'),
  { id: 'slate', open: openSlate, root: '.place', close: '.place-close' },
  { id: 'slate-homestead', open: async page => { await openSlate(page); await page.locator('.sl-tile[data-face="factory"]').click(); }, root: '.place', close: '.place-close' },
  { id: 'slate-reels', open: async page => { await openSlate(page); await page.locator('.sl-tile[data-game="reels"]').click(); }, root: '.place', close: '.place-close' },
];

interface Box { x: number; y: number; w: number; h: number }
interface Report {
  menu: string; size: string; opened: boolean;
  root: Box | null; hscroll: boolean;
  outside: { sel: string; box: Box }[];
  close: { box: Box; hit: boolean } | null;
  primary: { box: Box; hit: boolean } | null;
  small: string[];
  /** Controls an overflow:hidden box cuts (nothing can scroll them into view). */
  clipped: string[];
  /** Controls in plain view whose centre a hit test does not reach (something lies over them). */
  blocked: string[];
  scrollers: number;
  coversMove: boolean;
  error?: string;
}

async function measure(page: Page, menu: Menu): Promise<Omit<Report, 'menu' | 'size' | 'opened'>> {
  return page.evaluate(({ root, close, primary }) => {
    const vw = innerWidth, vh = innerHeight;
    const shown = (el: Element): boolean => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < .05) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const box = (r: DOMRect) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    const name = (el: Element) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const rootEl = Array.from(document.querySelectorAll(root)).find(shown) ?? null;
    const target = (sel: string) => {
      if (!sel || !rootEl) return null;
      const el = Array.from(document.querySelectorAll(sel)).find(shown) as HTMLElement | undefined;
      if (!el) return null;
      let r = el.getBoundingClientRect();
      let at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      // Below the fold of a scrolling body: scroll it into view the way a thumb would, then it must answer.
      if (!(at && (at === el || el.contains(at)))) {
        el.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
        r = el.getBoundingClientRect();
        at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      }
      return { box: box(r), hit: !!at && (at === el || el.contains(at)) };
    };
    const outside: { sel: string; box: { x: number; y: number; w: number; h: number } }[] = [];
    const small: string[] = [];
    const clipped: string[] = [];
    const blocked: string[] = [];
    let scrollers = 0;
    if (rootEl) {
      for (const el of [rootEl, ...Array.from(rootEl.querySelectorAll('*'))]) {
        if (!shown(el)) continue;
        // What of it can be seen: clipped by every scrolling/clipping ancestor up to the root.
        let r = el.getBoundingClientRect();
        let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const ar = a.getBoundingClientRect();
            if (cs.overflowX !== 'visible') { left = Math.max(left, ar.left); right = Math.min(right, ar.right); }
            if (cs.overflowY !== 'visible') { top = Math.max(top, ar.top); bottom = Math.min(bottom, ar.bottom); }
          }
          if (a === rootEl) break;
        }
        if (right - left < 1 || bottom - top < 1) continue;
        if (left < -1 || top < -1 || right > vw + 1 || bottom > vh + 1) {
          if (outside.length < 12) outside.push({ sel: name(el), box: { x: Math.round(left), y: Math.round(top), w: Math.round(right - left), h: Math.round(bottom - top) } });
        }
        const cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) scrollers++;
        if (el.matches('button, a[href], select, input:not([type=hidden]), summary, [role=tab]')) {
          r = el.getBoundingClientRect();
          if (Math.min(r.width, r.height) < 43.5 && small.length < 30) small.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
          // Cut by a box that does not scroll, or (in plain view) covered by something else.
          let cut = false, inScroller = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const acs = getComputedStyle(a);
            const scrolls = /auto|scroll/.test(acs.overflowY) || /auto|scroll/.test(acs.overflowX);
            const ar = a.getBoundingClientRect();
            const inside = r.left >= ar.left - 1 && r.right <= ar.right + 1 && r.top >= ar.top - 1 && r.bottom <= ar.bottom + 1;
            if (!inside && scrolls) inScroller = true;
            if (!inside && !scrolls && (acs.overflowX !== 'visible' || acs.overflowY !== 'visible') && !inScroller) cut = true;
            if (a === rootEl) break;
          }
          if (cut) { if (clipped.length < 20) clipped.push(`${name(el)} ${el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 24)}`); }
          else if (!inScroller && r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh) {
            let at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            // Under the panel's sticky primary bar: it scrolls out from under it. Prove it does.
            const sticky = (n: Element | null) => { for (let e = n; e && e !== rootEl; e = e.parentElement) if (getComputedStyle(e).position === 'sticky') return true; return false; };
            if (at && !(at === el || el.contains(at)) && sticky(at)) {
              el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
              const c = el.getBoundingClientRect();
              at = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
            }
            if (!at || !(at === el || el.contains(at))) {
              if (blocked.length < 20) blocked.push(`${name(el)} ${el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 24)} under ${at ? name(at) : 'nothing'}`);
            }
          }
        }
      }
    }
    const rr = rootEl?.getBoundingClientRect();
    const move = document.querySelector('.touch-move')?.getBoundingClientRect();
    const coversMove = !!rr && !!move && move.width > 0 && rr.left < move.right && move.left < rr.right && rr.top < move.bottom && move.top < rr.bottom;
    return {
      root: rr ? box(rr) : null,
      hscroll: document.documentElement.scrollWidth > vw + 1,
      outside, close: target(close), primary: primary ? target(primary) : null, small, clipped, blocked, scrollers, coversMove,
    };
  }, { root: menu.root, close: menu.close, primary: menu.primary ?? '' });
}

/** Opens a menu at the current size; returns false when the menu did not appear. */
async function openMenu(page: Page, menu: Menu): Promise<boolean> {
  // A covered control must fail the menu fast, not wait out the whole test.
  page.setDefaultTimeout(10_000);
  const needsSlate = menu.id.startsWith('slate');
  await seed(page, needsSlate ? { ...STASH, ...satchel({ 'cinder-ore': 24, 'mirror-slate-ii': 1 }) } : STASH);
  await openPlay(page, menu.query ?? '');
  if (menu.open) { try { await menu.open(page); } catch { return false; } }
  const root = page.locator(menu.root).first();
  try { await expect(root).toBeVisible({ timeout: 8000 }); } catch { return false; }
  // Settle: every open animation finished, so we measure the end state.
  await page.waitForTimeout(500);
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => null))));
  return true;
}

if (MEASURE_ONLY) {
  for (const size of ALL_SIZES) {
    test.describe(`measure ${size.tag}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.mobile });
      test.describe.configure({ timeout: 600_000 });
      test(`every menu at ${size.tag}`, async ({ page }) => {
        const reports: Report[] = [];
        for (const menu of MENUS) {
          if (ONLY && !ONLY.includes(menu.id)) continue;
          let report: Report;
          try {
            const opened = await openMenu(page, menu);
            report = { menu: menu.id, size: size.tag, opened, ...(opened ? await measure(page, menu) : { root: null, hscroll: false, outside: [], close: null, primary: null, small: [], clipped: [], blocked: [], scrollers: 0, coversMove: false }) };
          } catch (err) {
            report = { menu: menu.id, size: size.tag, opened: false, root: null, hscroll: false, outside: [], close: null, primary: null, small: [], clipped: [], blocked: [], scrollers: 0, coversMove: false, error: String(err).slice(0, 200) };
          }
          reports.push(report);
          if (SHOTS) {
            fs.mkdirSync(path.dirname(SHOTS), { recursive: true });
            await page.screenshot({ path: `${SHOTS}-${menu.id}-${size.tag}.png` }).catch(() => null);
          }
        }
        if (OUT) {
          const all = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) as Report[] : [];
          fs.writeFileSync(OUT, JSON.stringify([...all.filter(r => r.size !== size.tag), ...reports], null, 1));
        }
      });
    });
  }
} else {
  for (const size of TEST_SIZES) {
    test.describe(`menus at ${size.tag}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true });
      test.describe.configure({ timeout: 600_000 });
      const landscape = size.width > size.height;

      test(`every menu opens, fits, and closes from a 44px target`, async ({ page }) => {
        const failures: string[] = [];
        for (const menu of MENUS) {
          if (!(await openMenu(page, menu))) { failures.push(`${menu.id}: did not open`); continue; }
          const m = await measure(page, menu);
          if (m.hscroll) failures.push(`${menu.id}: the page scrolls sideways`);
          if (m.outside.length) failures.push(`${menu.id}: outside the viewport: ${m.outside.map(o => `${o.sel} ${JSON.stringify(o.box)}`).join('; ')}`);
          if (!m.close) failures.push(`${menu.id}: no close button`);
          else {
            if (Math.min(m.close.box.w, m.close.box.h) < 44) failures.push(`${menu.id}: close is ${m.close.box.w}x${m.close.box.h}`);
            if (!m.close.hit) failures.push(`${menu.id}: close is covered`);
          }
          if (menu.id === 'satchel-charm' && !m.primary) failures.push(`${menu.id}: no Equip on the charm's card`);
          if (m.primary) {
            if (Math.min(m.primary.box.w, m.primary.box.h) < 44) failures.push(`${menu.id}: primary is ${m.primary.box.w}x${m.primary.box.h}`);
            if (!m.primary.hit) failures.push(`${menu.id}: primary is covered`);
          }
          if (m.clipped.length) failures.push(`${menu.id}: cut off: ${m.clipped.join('; ')}`);
          if (m.blocked.length) failures.push(`${menu.id}: covered: ${m.blocked.join('; ')}`);
          if (landscape && m.coversMove) failures.push(`${menu.id}: covers the move stick`);
          // And it closes from its close button.
          const closed = await page.locator(menu.close).first().click({ timeout: 5000 }).then(() => true, () => false);
          if (!closed) { failures.push(`${menu.id}: its close could not be clicked`); continue; }
          await expect(page.locator(menu.root).first()).toBeHidden({ timeout: 4000 }).catch(() => failures.push(`${menu.id}: close did not close it`));
        }
        expect(failures, failures.join('\n')).toEqual([]);
      });

      test(`the Satchel: every well, pocket and card button answers a tap`, async ({ page }) => {
        expect(await openMenu(page, MENUS.find(m => m.id === 'satchel')!)).toBe(true);
        const book = page.locator('#satchel-book');
        // Every well and every pocket: scrolled into view if the body must, then hit at its centre.
        const hitAll = async (sel: string) => {
          const n = await book.locator(sel).count();
          expect(n, sel).toBeGreaterThan(0);
          for (let i = 0; i < n; i++) {
            const el = book.locator(sel).nth(i);
            await el.scrollIntoViewIfNeeded();
            const hit = await el.evaluate(node => {
              const r = node.getBoundingClientRect();
              const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return { ok: !!at && (at === node || node.contains(at)), w: r.width, h: r.height, under: at?.className?.toString() ?? '' };
            });
            expect(hit.ok, `${sel} #${i} is under ${hit.under}`).toBe(true);
            expect(Math.min(hit.w, hit.h), `${sel} #${i}`).toBeGreaterThanOrEqual(40);
          }
        };
        await hitAll('.well');
        await hitAll('.pocket');
        // No empty well spells its slot out in a word that spills from the box: each shows a picture.
        expect(await book.locator('.well:not(.filled) em').count()).toBe(0);
        // No charm in the bag reads as initials: every pocket has its pixel icon.
        expect(await book.locator('.pocket em').count()).toBe(0);
        // A charm's card: every button in it answers a tap, Equip included.
        const charm = book.locator('.pocket[aria-label^="Student"]').first();
        await charm.scrollIntoViewIfNeeded();
        await charm.click();
        await expect(book.locator('.slip .wear')).toBeVisible();
        for (const sel of ['.slip-x', '.slip .wear', '.slip .to-vault']) {
          const el = book.locator(sel).first();
          if (!(await el.count())) continue;
          await el.scrollIntoViewIfNeeded();
          const ok = await el.evaluate(node => {
            const r = node.getBoundingClientRect();
            const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !!at && (at === node || node.contains(at)) && r.bottom <= innerHeight && r.top >= 0;
          });
          expect(ok, `${sel} answers a tap`).toBe(true);
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}-satchel-charm-tap-${size.tag}.png` });
        // Equip works from there.
        await book.locator('.slip .wear').click();
        await expect(book.locator('.well[data-slot="charm2"].filled, .well[data-slot="charm3"].filled').first()).toBeVisible();
      });
    });
  }

  test.describe('turning the phone mid-menu', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    for (const id of ['satchel-charm', 'crafting', 'places']) {
      test(`${id} stays open and usable through portrait → landscape → portrait`, async ({ page }) => {
        const menu = MENUS.find(m => m.id === id)!;
        expect(await openMenu(page, menu)).toBe(true);
        // A scroll position inside the menu survives the turn (where there is anything to scroll).
        const scroller = await page.evaluate(sel => {
          const root = document.querySelector(sel.split(' ')[0])!;
          const all = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
          const s = all.find(el => { const cs = getComputedStyle(el); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 40; });
          if (!s) return false;
          s.dataset['turnProbe'] = '1';
          s.scrollTop = 30;
          return true;
        }, menu.root);
        for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
          await page.setViewportSize(viewport);
          await page.waitForTimeout(400);
          await expect(page.locator(menu.root).first()).toBeVisible();
          const m = await measure(page, menu);
          expect(m.hscroll).toBe(false);
          expect(m.outside, JSON.stringify(m.outside)).toEqual([]);
          expect(m.clipped, m.clipped.join('; ')).toEqual([]);
          expect(m.blocked, m.blocked.join('; ')).toEqual([]);
          expect(m.close?.hit).toBe(true);
          expect(Math.min(m.close!.box.w, m.close!.box.h)).toBeGreaterThanOrEqual(44);
          if (menu.primary) expect(m.primary?.hit, 'the primary action answers a tap').toBe(true);
          if (scroller) expect(await page.locator('[data-turn-probe]').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        }
        await page.locator(menu.close).first().click();
        await expect(page.locator(menu.root).first()).toBeHidden();
      });
    }
  });
}
