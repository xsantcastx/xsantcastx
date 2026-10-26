import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared helpers for the `play-*` specs: specs that PLAY the /play world in a
 * real browser instead of asserting markup.
 *
 * Seeding rules (see docs/handoff/playtest-findings.md):
 *   - Save blobs are written from `/robots.txt`, a same-origin page that does
 *     not boot Angular. Writing them from inside the app and reloading loses the
 *     write: the outgoing page flushes its in-memory copy on pagehide.
 *   - Never seed with `addInitScript` in a spec that reloads: the init script
 *     runs again on the reload and overwrites what the game just saved.
 */

export type Blobs = Record<string, unknown>;

/** Clear storage and write the given save blobs from a page that runs no app code. */
export async function seed(page: Page, blobs: Blobs = {}): Promise<void> {
  await page.goto('/robots.txt');
  await page.evaluate(entries => {
    const keepOnboarding = localStorage.getItem('eclipse-onboarding');
    // The lobby skip (playwright.config) survives the clear, so a seeded spec still lands in the world.
    const keepLobby = localStorage.getItem('eclipse-lobby');
    localStorage.clear();
    if (keepLobby) localStorage.setItem('eclipse-lobby', keepLobby);
    sessionStorage.clear();
    // A seeded tester has been here before: without a record a fresh browser is offered "Make your
    // Keeper" on arrival (game-only shell), which would open over the spec. play-first-session removes it.
    localStorage.setItem('eclipse-onboarding', keepOnboarding ?? JSON.stringify({ done: true, lastStep: 5, at: '2026-01-01T00:00:00.000Z' }));
    localStorage.setItem('xsantcastx_consent', 'denied');
    sessionStorage.setItem('visit-counted', '1');
    // The side view's specs keep the side view (top-down is the default since 2026-10-19); a top-down spec seeds 'eclipse-td': '1'.
    localStorage.setItem('eclipse-td', '0');
    // Isometric is the default since 2026-10-27: a top-down spec keeps testing the top-down (Classic) view; an iso spec
    // seeds 'eclipse-td-graphics': 'iso' or uses ?artopt=iso.
    localStorage.setItem('eclipse-td-graphics', 'classic');
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }, blobs);
}

/** Read a save blob (parsed) without touching the app. */
export async function blob<T = unknown>(page: Page, key: string): Promise<T | null> {
  return page.evaluate(k => {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }, key) as Promise<T | null>;
}

export function canvas(page: Page): Locator {
  return page.locator('.viewport canvas');
}

export async function playerX(page: Page): Promise<number> {
  return Number(await canvas(page).getAttribute('data-player-x'));
}

/** Open /play (optionally with a query) and wait for the engine to report a position. */
export async function openPlay(page: Page, query = ''): Promise<void> {
  await page.goto(`/play${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
  // The engine binds after hydration; give it the first frames.
  await page.waitForTimeout(400);
  await focusWorld(page);
}

/** Put keyboard focus on the canvas without clicking it (a click walks or swings). */
export async function focusWorld(page: Page): Promise<void> {
  await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
}

/** Hold A or D until the Keeper passes `target` (real time). */
export async function walk(page: Page, key: 'a' | 'd', target: number, timeout = 30000): Promise<void> {
  await focusWorld(page);
  await page.keyboard.down(key);
  try {
    await expect.poll(async () => {
      const x = await playerX(page);
      return key === 'd' ? x >= target : x <= target;
    }, { timeout, intervals: [50] }).toBe(true);
  } finally {
    await page.keyboard.up(key);
  }
}

/**
 * Walk so the Keeper ends near `target` (within `slack` px).
 *
 * The key is released by a 50 ms poll, so the Keeper always walks on a little
 * past the crossing. Normally that is one frame (≤ 27 px in town). When this
 * machine is busy, though (other worktrees building or running suites), the
 * poll can fire 0.4 s late. The Keeper then stops 100 px past the shaft, at the
 * Material Vendor, and E answers the wrong place. So once the trailing frame
 * has landed, the stop is checked, and up to two short walks bring the Keeper
 * back. Those walk-backs are best effort: one that is blocked (a wall, or a pit
 * the slide dropped into) leaves the Keeper where they are, as before.
 */
export async function walkTo(page: Page, target: number, slack = 30): Promise<void> {
  const x = await playerX(page);
  if (Math.abs(x - target) <= slack) return;
  if (x < target) await walk(page, 'd', target - slack / 2);
  else await walk(page, 'a', target + slack / 2);
  for (let i = 0; i < 2; i++) {
    await page.waitForTimeout(250);
    const at = await playerX(page);
    if (Math.abs(at - target) <= slack) return;
    try {
      if (at < target) await walk(page, 'd', target - slack / 2, 4000);
      else await walk(page, 'a', target + slack / 2, 4000);
    } catch {
      return;
    }
  }
}

/**
 * Tap toward [lo, hi] until the Keeper's x is inside it (inclusive).
 *
 * `walkTo` alone can stop ~27 px past its target, a whole Delve column. The
 * Keeper has no momentum, but a headless frame can last the engine's 0.1 s
 * cap (191 px/s × 0.1 s ≈ 19 px per frame in a Delve), and the poll that
 * releases the key runs 50 ms behind the frame. Use this wherever the spec
 * depends on which cell the Keeper stands in. Keep the window wider than one
 * frame's step (~20 px) or the taps can hop over it.
 */
export async function settleBetween(page: Page, lo: number, hi: number, tries = 12): Promise<number> {
  await page.waitForTimeout(250); // the frame after the key-up still moves the Keeper; read after it
  let x = await playerX(page);
  for (let i = 0; i < tries && (x < lo || x > hi); i++) {
    await focusWorld(page);
    const key = x < lo ? 'd' : 'a';
    await page.keyboard.down(key);
    await page.waitForTimeout(40);
    await page.keyboard.up(key);
    await page.waitForTimeout(350); // a key released between frames may not move at all; re-read and retry
    x = await playerX(page);
  }
  expect(x, `the Keeper settles between ${lo} and ${hi}`).toBeGreaterThanOrEqual(lo);
  expect(x, `the Keeper settles between ${lo} and ${hi}`).toBeLessThanOrEqual(hi);
  return x;
}

/** Hold a key for `ms` milliseconds of real time. */
export async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/** The objective / message line under the title. */
export function messageLine(page: Page): Locator {
  return page.locator('.objective');
}

/** The open in-world place dialog. */
export function placePanel(page: Page): Locator {
  return page.locator('section.place');
}

/** One hotbar slot's held count, from its aria-label ("Torch, 3 held"). */
export async function hotbarCount(page: Page, name: string): Promise<number> {
  const label = await page.locator('.hotbar button.hot', { hasText: '' })
    .evaluateAll((buttons, n) => buttons.map(b => b.getAttribute('aria-label') ?? '').find(l => l.startsWith(`${n},`)) ?? '', name);
  const match = /,\s*(\d+) held/.exec(label);
  return match ? Number(match[1]) : -1;
}

/** Keep in step with INVENTORY_ERA (src/app/shared/rpg/inventory.model.ts); a stale era wipes the bag at boot. */
export const ERA = 55;

/** An inventory ledger holding only these material stacks. */
export function ledger(stacks: Record<string, number>): unknown {
  const rows = Object.entries(stacks);
  return {
    version: 2,
    records: rows.map(([key], i) => ({
      id: `stack:${key}`, definitionId: key, kind: 'stack',
      category: 'materials', tags: ['material', key], soulbound: false,
      acquiredAt: '2026-10-01T00:00:00.000Z',
      revision: { hlc: i + 1, deviceId: 'e2e', sequence: i + 1 },
      source: 'inventory', stackKey: key, location: { kind: 'bag' },
    })),
    tombstones: [],
    stackOps: rows.map(([key, quantity], i) => ({
      id: `seed:${key}`, stackKey: key, kind: 'grant', quantity, hlc: i + 1, deviceId: 'e2e', sequence: i + 1,
    })),
    goldFromSales: 0,
    sold: 0,
    hlc: rows.length,
    legacyBackup: null,
    era: ERA,
  };
}

/** Blobs for a bag of material stacks (with the era stamp the boot check wants). */
export function bag(stacks: Record<string, number>): Blobs {
  return { 'godforge-realm-era': String(ERA), 'godforge-inventory': ledger(stacks) };
}

/** A v3 economy purse (gold alone merges over a fresh ledger). */
export function purse(gold: number): Blobs {
  return { 'godforge-economy': { version: 3, goldEra: 1, gold, totalGoldEarned: gold, runGoldEarned: gold } };
}

/** Stack quantity in the inventory ledger blob: every device's fold plus the live ops past it. */
export async function stackQty(page: Page, stackKey: string): Promise<number> {
  return page.evaluate(key => {
    type Fold = { deviceId: string; upToHlc: number; net: Record<string, number> };
    const ledger = JSON.parse(localStorage.getItem('godforge-inventory') || '{}');
    const folds: Fold[] = ledger.stackFolds || [];
    let qty = folds.reduce((sum, fold) => sum + (fold.net[key] ?? 0), 0);
    for (const op of ledger.stackOps || []) {
      if (op.stackKey !== key) continue;
      const own = folds.find(fold => fold.deviceId === op.deviceId);
      if (own && op.hlc <= own.upToHlc) continue;
      qty += op.kind === 'grant' ? op.quantity : -op.quantity;
    }
    return Math.max(0, qty);
  }, stackKey);
}

/**
 * A Keeper whose Spellbook already holds rank 1 in the skills the starting kit lacks (the trees: a save from before
 * them keeps what it used, keeper-look.model coerceTree) — for the specs that cast or run them without levelling.
 */
export const SKILLS_LEARNED: Blobs = {
  'godforge-keeper-look': {
    version: 1, made: true, prompted: true,
    tree: { spent: {}, free: ['bone-spear', 'raise-skeleton', 'aura-siphon'], at: 1 },
  },
};

/** The open Skill Book's row for a skill (play/spellbook/skill-book): its tab opened if need be. */
export async function bookRow(page: Page, id: string): Promise<Locator> {
  const row = page.locator(`.brow[data-row="${id}"]`);
  // The Warlock's tabs, the Ashguard's, the Lanternwright's, the Thornstrider's, then the common page: only the open class's tabs are there to click.
  // The book loads lazily (@defer): wait for it before reading its tabs.
  await expect(page.locator('.sbook .book')).toBeVisible({ timeout: 10000 });
  const shown = () => expect(row).toBeVisible({ timeout: 800 }).then(() => true, () => false);
  if (await row.count()) { await expect(row).toBeVisible(); return row; }
  for (const tree of ['ember', 'bone', 'shadow', 'brand', 'oath', 'ash', 'lamp', 'hearth', 'moth', 'thorn', 'wild', 'briar', 'common']) {
    const tab = page.locator(`[data-book-tab="${tree}"]`);
    if (!(await tab.count())) continue;
    // Wait for the page to render after the click: a count taken at once can miss it and walk on past the row.
    await tab.click();
    if (await shown()) break;
  }
  await expect(row).toBeVisible();
  return row;
}
/**
 * In the open Skill Book (K): find the skill's row on its tree's tab and open its card with a click on its icon (what it
 * does now, the next rank, the Cant words, synergies).
 */
export async function pickSkill(page: Page, id: string): Promise<void> {
  const row = await bookRow(page, id);
  await row.locator('.brow__icon').click();
  await expect(page.locator(`.bcard[data-card="${id}"]`)).toBeVisible();
}
/** Buy `n` ranks of a skill in the open book and Accept them (one save). */
export async function learnRanks(page: Page, id: string, n = 1): Promise<void> {
  const row = await bookRow(page, id);
  for (let i = 0; i < n; i++) await row.locator(`[data-plus="${id}"]`).click();
  await page.locator('[data-book-accept]').click();
  await expect(page.locator('[data-book-accept]')).toBeDisabled();
}
/** The book's Keys tab: put a learnt skill on a key (1–4). */
export async function putOnKey(page: Page, id: string, key: number): Promise<void> {
  await page.locator('[data-book-tab="keys"]').click();
  await page.locator(`[data-key-row="${id}"] .bkey__key`, { hasText: String(key) }).click();
}
/** The book's Keys tab: the running aura's switch for `id`. */
export async function bookAura(page: Page, id: string): Promise<Locator> {
  await page.locator('[data-book-tab="keys"]').click();
  return page.locator(`[data-aura-row="${id}"]`);
}

/**
 * Sail from the pier the Keeper is on (docs/design/realms-endgame.md §1): open the Map, go to the Harbourmaster's pin
 * (`master`, else the first), pick the board row for `dest`, pay the fare, skip the crossing, and wait for the arrival
 * (`area`, matched against the canvas's data-area). The Keeper needs the fare in their purse (`purse`).
 */
export async function sail(page: Page, dest: RegExp, area: RegExp, master?: RegExp): Promise<void> {
  const cv = page.locator('canvas').first();
  const map = page.locator('#places-list.td-map');
  if (!(await map.isVisible())) { await cv.focus(); await page.keyboard.press('m'); }
  // The new Map (td-map-window): a harbour pin is an anchor named for its keeper; a click on it walks there.
  const who = master ? master.source.replace(/\\/g, '').replace(/"/g, '') : '';
  const pin = map.locator(`.mw__pin[data-cat="harbour"]${who ? `[data-name*="${who}" i]` : ''}`).first();
  await pin.click();
  const board = page.locator('.td-harbour');
  await expect(board).toBeVisible({ timeout: 30000 });
  await board.locator('[data-harbour-row]', { hasText: dest }).first().click();
  await board.locator('[data-harbour-go]').click();
  await page.locator('[data-harbour-skip]').click();
  await expect(page.locator('[data-harbour-voyage]')).toHaveCount(0, { timeout: 10000 });
  await expect(cv).toHaveAttribute('data-area', area, { timeout: 30000 });
}

/**
 * The top-down Map has no list of every place any more (owner's player notes 2026-10-21): its search finds one. Type
 * the name there first, then click the result as before; on a menu with no search (the side view) this does nothing.
 */
export async function mapFind(page: Page, name: string | RegExp): Promise<void> {
  const find = page.locator('#places-list [data-map-find]');
  if (await find.count()) await find.fill(typeof name === 'string' ? name : name.source.replace(/[\\^$.*+?()[\]{}|]/g, ''));
}

/**
 * Open the Game Menu (the ☰ Menu: Character, Glass, Bestiary, Lore, Friends, Sound, Loot, Account, Feedback, Character
 * select). Escape opens it when nothing else is up and folds whatever is, so a few presses always get there; the Map
 * (Places) holds only the map.
 */
export async function openMenu(page: Page): Promise<void> {
  const menu = page.locator('#game-menu');
  for (let i = 0; i < 5 && !(await menu.isVisible()); i++) {
    await focusWorld(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await expect(menu).toBeVisible();
}
