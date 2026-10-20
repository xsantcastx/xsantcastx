/**
 * play-menus.ts — the in-game menus, how to open each one and how to measure it. Shared by
 * play-menus-orientation.spec.ts (fits the phone, held either way) and play-nice-menus.spec.ts (clean pixel windows:
 * every control inside the window, none overlapping, the primary in view at scrollTop 0).
 */
import { expect, type Page } from '@playwright/test';
import { ERA, ledger, openPlay, purse, seed, walkTo } from './play-helpers';

export interface Size { tag: string; width: number; height: number; touch: boolean; mobile: boolean }
export const ALL_SIZES: Size[] = [
  { tag: '390x844', width: 390, height: 844, touch: true, mobile: true },
  { tag: '844x390', width: 844, height: 390, touch: true, mobile: true },
  { tag: '932x430', width: 932, height: 430, touch: true, mobile: true },
  { tag: '360x740', width: 360, height: 740, touch: true, mobile: true },
  { tag: '820x1180', width: 820, height: 1180, touch: true, mobile: false },
  { tag: '1180x820', width: 1180, height: 820, touch: true, mobile: false },
  { tag: '1280x800', width: 1280, height: 800, touch: false, mobile: false },
];
export const TEST_SIZES = ALL_SIZES.filter(s => ['844x390', '390x844', '360x740'].includes(s.tag));

export interface Menu {
  id: string;
  query?: string;
  /** Opens the menu once /play is up (after `query`). */
  open?: (page: Page) => Promise<void>;
  root: string;
  close: string;
  primary?: string;
  /** Clicks of `close` that put it away (an app inside the Slate needs one to go home, one to leave). */
  closeClicks?: number;
  /** A modal veil (the Slate): it is allowed over the move stick. */
  modal?: boolean;
  /** The primary action must be in plain view the moment the menu opens: no scrolling to reach it (owner rule). */
  noScroll?: boolean;
  /** Extra save blobs on top of the shared stash. */
  blobs?: Record<string, unknown>;
  /** A HUD column or a dialog rather than a window (the Homestead build column, the story card): no window chrome to check. */
  chromeless?: boolean;
}

/**
 * The owner's satchel (bug report, 2026-10-15): materials, a dozen charms (so the doll grows its charm row) and
 * a worn charm — the case that clipped the grid under the wells in portrait and cut the doll off in landscape.
 */
const CHARMS = ['Small Charm of Fortune', 'Student’s Thread', 'Copper Knot', 'Counting Stone', 'Margin Note', 'Verge Compass'];
export function satchel(stacks: Record<string, number>): Record<string, unknown> {
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
export const STASH = { ...satchel({ 'cinder-ore': 24, 'ember-residue': 6, 'pyrite-dust': 3 }), ...purse(5000), 'preferred-language': 'en' };
const placesItem = (key: string) => async (page: Page) => {
  await page.locator('.places-toggle').first().click();
  await page.locator(`#places-list button[data-open="${key}"]`).click();
};
const station = (at: string, primary = '.place .ab__btn'): Menu => ({ id: at, query: `?at=${at}`, root: '.place', close: '.place-close', primary });
const openSlate = async (page: Page) => { await page.locator('.slate-btn').click(); };

export const MENUS: Menu[] = [
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
  { id: 'loot', open: placesItem('loot'), root: '.sound-host .ls', close: '.sound-host .ls__done' },
  { id: 'glass', open: placesItem('glass'), root: '.place', close: '.place-close' },
  { id: 'character', open: placesItem('character'), root: '.place', close: '.place-close' },
  { ...station('crafting'), noScroll: true }, { ...station('runes'), noScroll: true }, { ...station('enchanting'), noScroll: true }, station('vault', ''),
  { ...station('vendor'), noScroll: true }, { ...station('gambler'), noScroll: true },
  // The Exchange left the world with the game-only shell's deep clean (no station, no ?at=exchange).
  station('market', ''), station('quests', ''), station('codex', ''), station('skills', ''),
  station('waystone', ''), station('reels', '.place .rl-spin, .place .ab__btn'),
  { id: 'slate', open: openSlate, root: '[data-slate-phone]', close: '[data-slate-home]', modal: true },
  { id: 'slate-reels', open: async page => { await openSlate(page); await page.locator('.sl-tile[data-game="reels"]').click(); }, root: '[data-slate-phone]', close: '[data-slate-home]', closeClicks: 2, modal: true },
  { id: 'slate-pets', open: async page => { await openSlate(page); await page.locator('.sl-tile[data-app="pets"]').click(); }, root: '[data-slate-phone]', close: '[data-slate-home]', closeClicks: 2, modal: true },
];

export interface Box { x: number; y: number; w: number; h: number }
export interface Report {
  menu: string; size: string; opened: boolean;
  root: Box | null; hscroll: boolean;
  outside: { sel: string; box: Box }[];
  close: { box: Box; hit: boolean; noScroll?: boolean } | null;
  primary: { box: Box; hit: boolean; noScroll?: boolean } | null;
  small: string[];
  /** Controls an overflow:hidden box cuts (nothing can scroll them into view). */
  clipped: string[];
  /** Controls in plain view whose centre a hit test does not reach (something lies over them). */
  blocked: string[];
  scrollers: number;
  coversMove: boolean;
  error?: string;
}

export async function measure(page: Page, menu: Menu): Promise<Omit<Report, 'menu' | 'size' | 'opened'>> {
  return page.evaluate(({ root, close, primary }) => {
    const vw = innerWidth, vh = innerHeight;
    const shown = (el: Element): boolean => {
      // A closed <details> keeps reporting its body's rects in Chrome; that body is not on screen.
      const fold = el.closest('details:not([open])');
      if (fold && !el.closest('summary')) return false;
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
      const noScroll = !!at && (at === el || el.contains(at)) && r.top >= 0 && r.left >= 0 && r.bottom <= vh && r.right <= vw;
      // Below the fold of a scrolling body: scroll it into view the way a thumb would, then it must answer.
      if (!(at && (at === el || el.contains(at)))) {
        el.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
        r = el.getBoundingClientRect();
        at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      }
      return { box: box(r), hit: !!at && (at === el || el.contains(at)), noScroll };
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

/** Glim, met (his HUD icon is there only once he is). */
const GLIM_MET = {
  version: 1, met: true, metAt: '2026-10-14T00:00:00.000Z', ladder: {}, said: { meet: 1, homestead: 1 }, lastAt: { meet: 1, homestead: 1 },
  moments: ['area:infernal', 'talk:who', 'depth:0'], answers: {}, peak: 2, seenAt: 1_790_000_000_000,
};
/**
 * Menus that need a walk or a story state to reach (not in the orientation sweep, which opens 27 menus at three sizes):
 * Account & settings, Glim's chat, the act card, the Homestead build column.
 */
export const EXTRA_MENUS: Menu[] = [
  { id: 'account', open: placesItem('account'), root: '.place', close: '.place-close' },
  { id: 'glim-chat', blobs: { 'godforge-glim': GLIM_MET }, open: page => page.locator('[data-glim-tap]').click(), root: '[data-glim-chat]', close: '[data-glim-chat] .gc__close' },
  {
    id: 'story', chromeless: true, root: '.story-veil .story-card', close: '.story-card__go, .story-card button', modal: true,
    blobs: { 'godforge-story': { version: 1, chapter: 'prologue', beats: ['p.arrival', 'p.words'], cards: [], scenes: [] } },
  },
  {
    id: 'homestead', chromeless: true, root: '.hc', close: '.hc-toggle', primary: '.hc-strike',
    open: async page => {
      await walkTo(page, 1075, 40);
      await page.keyboard.press('e');
      const toggle = page.locator('.hc-toggle');
      await toggle.waitFor();
      // A Homestead with nothing built opens the column by itself.
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      await page.locator('.hc-rows').waitFor();
    },
  },
];

/** Opens a menu at the current size; returns false when the menu did not appear. */
export async function openMenu(page: Page, menu: Menu): Promise<boolean> {
  // A covered control must fail the menu fast, not wait out the whole test.
  page.setDefaultTimeout(10_000);
  const needsSlate = menu.id.startsWith('slate');
  await seed(page, { ...(needsSlate ? { ...STASH, ...satchel({ 'cinder-ore': 24, 'mirror-slate-ii': 1 }) } : STASH), ...(menu.blobs ?? {}) });
  await openPlay(page, menu.query ?? '');
  if (menu.open) { try { await menu.open(page); } catch { return false; } }
  const root = page.locator(menu.root).first();
  try { await expect(root).toBeVisible({ timeout: 8000 }); } catch { return false; }
  // Settle: every open animation finished, so we measure the end state.
  await page.waitForTimeout(500);
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => null))));
  return true;
}

