/**
 * td-marches.spec.ts — S11 part 2, the Umbral Marches as an act (docs/world/campaign.md S11; docs/design/world-acts.md
 * §1.4, §2.4, §5.4): reach it (Pyrehold's ketch to Mirewatch), walk a seam both ways (the Shore's north boardwalk into
 * the Gloaming Fen), find the Pilgrims' Boardwalk broken off and take the Sunken Belfry past it (its fifth bell's door
 * sealed), take the Bog Galleries from the Deep Fen to the Drowned Ruins, see the hot spots spawn, touch a Waystone and
 * travel to Gloamhaven, and stand still by the Belfry's roof while the fifth bell rings under the water.
 */
import { expect, test, type Page } from '@playwright/test';
import { mapFind, purse, sail, seed, toSection } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
interface Here { area: string; level: string; c: number; r: number; land: string; veil: boolean }
const here = (page: Page) => page.evaluate(() => (window as unknown as { __tdReach: { here: () => Here } }).__tdReach.here());
const reach = <T>(page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => {
  const r = (window as unknown as { __tdReach: Record<string, (...x: unknown[]) => unknown> }).__tdReach;
  return r[f as string](...(a as unknown[])) as T;
}, [fn, args] as const) as Promise<T>;
const s8 = <T>(page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => {
  const r = (window as unknown as { __tdS8: Record<string, (...x: unknown[]) => unknown> }).__tdS8;
  return r[f as string](...(a as unknown[])) as T;
}, [fn, args] as const) as Promise<T>;

async function open(page: Page, query = '/play?td=1&hour=12'): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', ...purse(100_000) });
  await page.goto(query);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdReach?: unknown; __tdS8?: unknown }).__tdReach && !!(window as unknown as { __tdS8?: unknown }).__tdS8);
}
/** Travel by the Map's key (reduced motion: at once) and wait for the area to change. */
async function go(page: Page, place: RegExp, area: RegExp): Promise<void> {
  await page.locator('.places-toggle').first().click();
  await mapFind(page, place);
  await page.locator('#places-list [data-map-results] button .mw__rname b', { hasText: place }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
}
async function walk(page: Page, key: string, done: () => Promise<boolean>, ms = 8000): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await done())) await page.waitForTimeout(60);
  await page.keyboard.up(key);
}

test('reach the act and walk a seam both ways: Mirewatch, up the Shore\'s north boardwalk into the Gloaming Fen and back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await sail(page, /pyrehold/i, /pyrehold/i);
  await sail(page, /mirewatch/i, /^Mirewatch$/);
  expect((await here(page)).area).toBe('umbral-marches-shore');
  expect((await here(page)).land).toBe('umbral-marches');
  await s8(page, 'calm');
  expect(await reach(page, 'atSeam', 'shore-n', 4)).toBe(true);
  await walk(page, 'ArrowUp', async () => (await here(page)).area === 'umbral-marches-fen');
  const at = await here(page);
  expect(at.area).toBe('umbral-marches-fen');
  const south = (await reach<{ id: string; c: number; r: number }[]>(page, 'seams')).find(s => s.id === 'fen-s')!;
  expect(Math.abs(at.c - south.c)).toBeLessThanOrEqual(2);
  expect(Math.abs(at.r - (south.r - 6))).toBeLessThanOrEqual(3);
  expect(await reach<string[]>(page, 'near', 8)).toEqual([]);
  expect(await reach(page, 'atSeam', 'fen-s', 4)).toBe(true);
  await walk(page, 'ArrowDown', async () => (await here(page)).area === 'umbral-marches-shore');
  expect((await here(page)).area).toBe('umbral-marches-shore');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Pilgrims\' Boardwalk breaks off in the water; down through the Sunken Belfry (its fifth bell\'s door sealed) to the Black Meres and back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await toSection(page, 'umbral-marches-boardwalk', 104, -55);
  await s8(page, 'calm');
  // Walk on north: the boards end; the Keeper stands at the last of them.
  await walk(page, 'ArrowUp', async () => (await here(page)).r < -58, 3000);
  expect((await here(page)).r).toBeGreaterThanOrEqual(-58);
  await go(page, /the broken boardwalk/i, /boardwalk|prayer-board/i);
  await expect(page.locator('.td-toast')).toContainText(/the way on is down through it/i, { timeout: 10000 });
  await go(page, /the sunken belfry/i, /sunken belfry/i);
  expect((await here(page)).level).toBe('sunken-belfry-1');
  await go(page, /the fifth bell's door/i, /sunken belfry/i);
  await expect(page.locator('.td-toast')).toContainText(/keyhole the shape of a bell/i, { timeout: 10000 });
  await go(page, /a ringer's glove/i, /sunken belfry/i);
  await expect(page.locator('.td-toast')).toContainText(/pull on four\. never on five\./i, { timeout: 10000 });
  await go(page, /the tower's foot/i, /black meres|mere-lamp|belfry/i);
  const out = await here(page);
  expect(out.area).toBe('umbral-marches-meres');
  expect(out.level).toBe('surface');
  await go(page, /the belfry's roof/i, /sunken belfry/i);
  expect((await here(page)).level).toBe('sunken-belfry-1');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Bog Galleries: in by the Deep Fen\'s peat-cut, down to the flooded cut, up the cutters\' stair into the Drowned Ruins', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await toSection(page, 'umbral-marches-deep-fen', 236, -42);
  await s8(page, 'calm');
  await go(page, /the peat-cut/i, /cutters' hall/i);
  expect((await here(page)).level).toBe('bog-galleries-1');
  await go(page, /the cutters' tally/i, /cutters' hall/i);
  await expect(page.locator('.td-toast')).toContainText(/every spade in the gallery/i, { timeout: 10000 });
  await go(page, /stairs down/i, /flooded cut/i);
  await go(page, /the cutters' stair/i, /drowned ruins|abbey-slab|cutters' stair/i);
  const out = await here(page);
  expect(out.area).toBe('umbral-marches-ruins');
  expect(out.level).toBe('surface');
  // The crypts' door stands at the Ruins' far end; and back down the stair the way it came.
  await go(page, /the cutters' stair/i, /flooded cut/i);
  expect((await here(page)).level).toBe('bog-galleries-2');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the hot spots spawn: the Lure Pools\' camp, the Knights\' Causeway\'s champions, the Witch\'s Island\'s unique', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const [area, id, n, type, band] of [
    ['umbral-marches-meres', 'lure-pools', 6, 'mire-lurker', [29, 32]],
    ['umbral-marches-deep-fen', 'knights-causeway', 4, 'drowned-knight', [32, 36]],
    ['umbral-marches-ruins', 'witchs-island', 1, 'gloam-witch', [37, 41]],
  ] as const) {
    await toSection(page, area, 8, 8);
    await s8(page, 'calm');
    const k = (await reach<{ c: number; r: number; n: number }>(page, 'campAt', id))!;
    expect(k, id).not.toBeNull();
    await toSection(page, area, k.c, k.r + 10);
    await expect.poll(async () => (await reach<{ type: string }[]>(page, 'camp', id)).length, { timeout: 10000 }).toBeGreaterThanOrEqual(n);
    const pack = await reach<{ type: string; level: number; rank: string | null }[]>(page, 'camp', id);
    expect(pack.some(m => m.type === type), id).toBe(true);
    for (const m of pack) { expect(m.level).toBeGreaterThanOrEqual(band[0]); expect(m.level).toBeLessThanOrEqual(band[1]); }
    if (id === 'witchs-island') expect(pack.some(m => m.rank === 'unique')).toBe(true);
  }
});

test('Waystones: the Corvane Stone remembers the Keeper, and the Atlas travels to Gloamhaven\'s Square Stone for free', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await toSection(page, 'umbral-marches-shore', 8, 8);
  await go(page, /^the corvane stone$/i, /gloaming shore|corvane stone/i);
  const atlas = page.locator('.td-atlas');
  await expect(atlas).toBeVisible();
  await expect(atlas.locator('[data-stone="marches:corvane"]')).toHaveAttribute('data-state', 'here');
  await expect(atlas.locator('[data-atlas-row]')).toHaveCount(7);
  await atlas.locator('[data-stone="marches:gloamhaven"]').click();
  await atlas.locator('[data-atlas-go]').click();
  await expect(atlas).toHaveCount(0);
  await expect.poll(async () => (await here(page)).area, { timeout: 10000 }).toBe('umbral-marches-gloamhaven');
  await expect(canvas(page)).toHaveAttribute('data-area', /gloamhaven/i, { timeout: 10000 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Bell Under the Water: the fifth bell rings once, the Lampfish go dark, and standing still by the roof the keyhole glows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await toSection(page, 'umbral-marches-meres', -24, -42);
  await s8(page, 'calm');
  expect(await s8(page, 'night', 'bell-under-water')).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-night-events', /bell-under-water/, { timeout: 10000 });
  type U = { age: number | null; keyhole: boolean; dark: boolean };
  await expect.poll(async () => (await s8<U>(page, 'underbell')).dark, { timeout: 10000 }).toBe(true);
  await expect(page.locator('.td-toast')).toContainText(/a bell rings once/i, { timeout: 10000 });
  // Stand still through its ringing: the keyhole glows, and a wax rubbing of it lies by the roof.
  await expect.poll(async () => (await s8<U>(page, 'underbell')).keyhole, { timeout: 25000 }).toBe(true);
  await expect(page.locator('.td-toast')).toContainText(/a keyhole the shape of a bell, glowing/i, { timeout: 10000 });
  const drops = (await s8<{ drops: { id: string }[] }>(page, 'state')).drops;
  expect(drops.some(d => /^night:bell-under-water:-?\d+:keyhole-rubbing$/.test(d.id))).toBe(true);
  await page.screenshot({ path: 'output/s11marches/underbell-keyhole.png' });
  expect(errors, errors.join('\n')).toEqual([]);
});
