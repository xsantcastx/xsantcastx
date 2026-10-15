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

/**
 * One World is the game (the P2 flip): the Delve is the Ember world's
 * underground and its save is v3 (`godforge-world`, `godforge-world-r*`). A
 * spec written against the v2 Delve save (`godforge-delve`, its region slots,
 * the rift slots) gets the same terrain filed the v3 way, with the migration
 * marker set so nothing is migrated on top: the cells are the same (rows ≥ 0
 * are byte-identical), only where they are kept moved.
 */
const AREA_WORLD: Record<string, string> = { 'ember-delve': 'ember', 'umbral-delve': 'ink', 'verdant-delve': 'root', 'luminous-delve': 'prism', 'celestial-delve': 'orrery' };
const REALM_WORLD: Record<string, string> = { umbral: 'ink', verdant: 'root', luminous: 'prism', celestial: 'orrery' };
export function asWorldSave(blobs: Blobs): Blobs {
  const delve = blobs['godforge-delve'] as { seed: number; createdAt?: number; areas?: Record<string, unknown>; claimed?: string[]; chests?: Record<string, unknown> } | undefined;
  if (!delve || blobs['godforge-world']) return blobs;
  const out: Blobs = { ...blobs };
  const worlds: Record<string, { core: unknown }> = {};
  for (const [area, core] of Object.entries(delve.areas ?? {})) if (AREA_WORLD[area]) worlds[AREA_WORLD[area]] = { core };
  const chests: Record<string, unknown> = {};
  for (const [key, chest] of Object.entries(delve.chests ?? {})) {
    const at = key.lastIndexOf(':'), world = AREA_WORLD[key.slice(0, at)];
    if (world) chests[`${world}:${key.slice(at + 1)}`] = chest;
  }
  out['godforge-world'] = {
    version: 3, seed: delve.seed, createdAt: delve.createdAt ?? 1, worlds, claimed: delve.claimed ?? [], migrated: 'v2',
    ...(Object.keys(chests).length ? { chests } : {}),
  };
  let slot = 0;
  for (const [key, value] of Object.entries(blobs)) {
    const ember = /^godforge-delve-r\d+$/.test(key), rift = /^godforge-rift-(\w+)-r\d+$/.exec(key);
    const world = ember ? 'ember' : rift ? REALM_WORLD[rift[1]] : null;
    if (world && value && typeof value === 'object') out[`godforge-world-r${slot++}`] = { ...(value as object), v: 3, world };
  }
  return out;
}

/** The Delve save as the v2 shape specs read (areas by area id, chests by `<area>:<cell>`), from the v3 blob. */
export async function delveSave<T = { seed: number; areas: Record<string, { layout: string; cells: string; seen?: string; wet?: string; liquids?: string }>; claimed: string[]; chests?: Record<string, unknown> }>(page: Page): Promise<T | null> {
  const world = await blob<{ seed: number; createdAt: number; worlds?: Record<string, { core: unknown }>; claimed?: string[]; chests?: Record<string, unknown> }>(page, 'godforge-world');
  if (!world) return null;
  const areaOf = Object.fromEntries(Object.entries(AREA_WORLD).map(([a, w]) => [w, a]));
  const areas: Record<string, unknown> = {};
  for (const [w, entry] of Object.entries(world.worlds ?? {})) if (areaOf[w]) areas[areaOf[w]] = entry.core;
  const chests: Record<string, unknown> = {};
  for (const [key, chest] of Object.entries(world.chests ?? {})) { const at = key.lastIndexOf(':'); chests[`${areaOf[key.slice(0, at)] ?? key.slice(0, at)}:${key.slice(at + 1)}`] = chest; }
  return { seed: world.seed, createdAt: world.createdAt, areas, claimed: world.claimed ?? [], chests } as T;
}

/** One World: a Waystone opens the Travel map; the five towns are the trunk line's stones (`<world>:town`). */
const TOWN_ROW: Record<string, string> = { Infernal: 'ember:town', Luminous: 'prism:town', Umbral: 'ink:town', Celestial: 'orrery:town', Verdant: 'root:town' };
/** On an open Travel map: pick a realm's town stone and travel there (a short channel, then the step). */
export async function travelToTown(page: Page, realm: string): Promise<void> {
  await page.locator(`[data-row="${TOWN_ROW[realm]}"]`).click();
  await page.locator('[data-act="travel"]').click();
}

/** One World: the mine head over the Delve's entry ledge (the old shaft's station, `delve`), at the street's west end. */
export const SHAFT_X = 112;
/** One World's Ember world columns a spec logs in at (the resume point; a column's centre is col × 32 + 16). */
export const WORLD_COL = { quarry: 168, quarryMaws: 200, highRoads: 178, homestead: -40, roadMaws: 128 } as const;
/**
 * A v3 world save that logs the Keeper in at `col` on the Ember world's street (row 0's top): the resume point
 * the game itself keeps ("you log in where you were"). Merged over any other blobs a spec seeds.
 */
export function loginAt(col: number, row = 0, seed = 424242): Blobs {
  return { 'godforge-world': { version: 3, seed, createdAt: 1, worlds: {}, claimed: [], migrated: 'v2', at: { world: 'ember', col, row, t: Date.now() } } };
}

/**
 * One World: into the Ember Delve the way a player goes now: walk the street to the old shaft's spot (x 260,
 * beside the mine head: its own ledge is bedrock) and dig down (S + J) until the Keeper stands in the rock
 * (data-area turns to the Delve's name), then a little deeper so the camera follows the Delve's framing.
 */
export async function digIntoDelve(page: Page): Promise<void> {
  await focusWorld(page);
  await walkTo(page, 260, 10);
  await page.keyboard.down('s'); await page.keyboard.down('j');
  try {
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 30000 });
    await page.waitForTimeout(700);
  } finally { await page.keyboard.up('j'); await page.keyboard.up('s'); }
  await page.waitForTimeout(600);
  await focusWorld(page);
}

/** Clear storage and write the given save blobs from a page that runs no app code. */
export async function seed(page: Page, blobs: Blobs = {}): Promise<void> {
  blobs = asWorldSave(blobs);
  await page.goto('/robots.txt');
  await page.evaluate(entries => {
    const keepOnboarding = localStorage.getItem('eclipse-onboarding');
    localStorage.clear();
    sessionStorage.clear();
    // A seeded tester has been here before: without a record a fresh browser is offered "Make your
    // Keeper" on arrival (game-only shell), which would open over the spec. play-first-session removes it.
    localStorage.setItem('eclipse-onboarding', keepOnboarding ?? JSON.stringify({ done: true, lastStep: 5, at: '2026-01-01T00:00:00.000Z' }));
    localStorage.setItem('xsantcastx_consent', 'denied');
    sessionStorage.setItem('visit-counted', '1');
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
  return { 'godforge-economy': { version: 3, gold, totalGoldEarned: gold, runGoldEarned: gold } };
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
