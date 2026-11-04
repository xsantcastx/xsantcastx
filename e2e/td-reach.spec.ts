/**
 * td-reach.spec.ts — S7, the Infernal Reach as an act (docs/world/campaign.md S7; docs/design/world-acts.md §1.2): reach
 * it (the ship to Pyrehold), walk a seam (Pyrehold's north gate into the Cinder Steppe: no invisible wall, the veil, the
 * arrival rule), take a connector (the Kiln Tunnels, the only way into the Deep Charwood), see a hot spot spawn (Kettle
 * Camp's pack, the Drake Nests' unique), touch two Waystones and travel between them, read a thing, find Garrick Dross's
 * board holding the Verdant ship until the Cinder Sovereign falls.
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

async function open(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', ...purse(100_000), ...extra });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdReach?: unknown }).__tdReach);
}
/** Travel by the Map's key (reduced motion: at once) and wait for the area to change. */
async function go(page: Page, place: RegExp, area: RegExp): Promise<void> {
  await page.locator('.places-toggle').first().click();
  await mapFind(page, place);
  // A result row carries the name and its area · distance (ui-pass-3 §8): match the name line.
  await page.locator('#places-list [data-map-results] button .mw__rname b', { hasText: place }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
}
/** Hold a key until `done` (or give up). */
async function walk(page: Page, key: string, done: () => Promise<boolean>, ms = 8000): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await done())) await page.waitForTimeout(60);
  await page.keyboard.up(key);
}

test('reach the act and walk a seam: out of Pyrehold\'s north gate into the Cinder Steppe and back, set down 6 tiles inside with nothing near', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await sail(page, /pyrehold/i, /pyrehold/i);
  expect((await here(page)).area).toBe('infernal-reach-pyrehold');
  expect((await here(page)).land).toBe('infernal-reach');
  // The gate is a place you walk through: up the north road, past the gate line.
  expect(await reach(page, 'atSeam', 'pyrehold-n', 4)).toBe(true);
  await walk(page, 'ArrowUp', async () => (await here(page)).area === 'infernal-reach-steppe');
  const at = await here(page);
  expect(at.area).toBe('infernal-reach-steppe');
  const seams = await reach<{ id: string; c: number; r: number }[]>(page, 'seams');
  const south = seams.find(s => s.id === 'steppe-s')!;
  // The arrival rule: 6 tiles inside the far gate, on its road, and no creature within 8 tiles.
  expect(Math.abs(at.c - south.c)).toBeLessThanOrEqual(2);
  expect(Math.abs(at.r - (south.r - 6))).toBeLessThanOrEqual(3);
  expect(await reach<string[]>(page, 'near', 8)).toEqual([]);
  await expect(canvas(page)).toHaveAttribute('data-area', /cinder steppe|watch cairn/i, { timeout: 10000 });
  // And back the same way: the seam works both ways.
  expect(await reach(page, 'atSeam', 'steppe-s', 4)).toBe(true);
  await walk(page, 'ArrowDown', async () => (await here(page)).area === 'infernal-reach-pyrehold');
  expect((await here(page)).area).toBe('infernal-reach-pyrehold');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a connector works: into the Kiln Tunnels from the Charwood, out of the far mouth into the Deep Charwood', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await toSection(page, 'infernal-reach-charwood', -74, -76);
  await go(page, /the kiln tunnels/i, /^The Kiln Tunnels$/);
  expect((await here(page)).level).toBe('kiln-tunnels-1');
  // The thing to read on this floor: the cart tally.
  await go(page, /a cart tally/i, /^The Kiln Tunnels$/);
  await expect(page.locator('.td-toast')).toContainText(/fourth row stops at two/i, { timeout: 10000 });
  await go(page, /far mouth/i, /deep charwood|far mouth/i);
  const out = await here(page);
  expect(out.area).toBe('infernal-reach-deep-charwood');
  expect(out.level).toBe('surface');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the hot spots spawn: Kettle Camp\'s pack round its fire, the Drake Nests\' unique leader', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const kettle = (await (async () => { await toSection(page, 'infernal-reach-deep-charwood', 8, 8); return reach<{ c: number; r: number; n: number }>(page, 'campAt', 'kettle'); })())!;
  expect(kettle.n).toBe(11);
  await toSection(page, 'infernal-reach-deep-charwood', kettle.c, kettle.r + 12);
  await expect.poll(async () => (await reach<{ type: string }[]>(page, 'camp', 'kettle')).length, { timeout: 10000 }).toBeGreaterThanOrEqual(8);
  const pack = await reach<{ type: string; level: number }[]>(page, 'camp', 'kettle');
  expect(pack.some(m => m.type === 'orc-warlord' || m.type === 'orc-firecaller')).toBe(true);
  for (const m of pack) { expect(m.level).toBeGreaterThanOrEqual(13); expect(m.level).toBeLessThanOrEqual(16); }
  await expect(canvas(page)).toHaveAttribute('data-area', /kettle camp|deep charwood/i);
  const nest = (await (async () => { await toSection(page, 'infernal-reach-molten-fields', 8, 8); return reach<{ c: number; r: number }>(page, 'campAt', 'drake-nests'); })())!;
  await toSection(page, 'infernal-reach-molten-fields', nest.c, nest.r + 12);
  await expect.poll(async () => (await reach<{ rank: string | null }[]>(page, 'camp', 'drake-nests')).map(m => m.rank), { timeout: 10000 }).toContain('unique');
});

test('Waystones: touch one a section, then travel to another of the land\'s for free', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await sail(page, /pyrehold/i, /pyrehold/i);
  // Garrick Dross's board: the Verdant ship waits on the Cinder Sovereign (the end of Act I), and says so.
  await canvas(page).focus(); await page.keyboard.press('m');
  // A pin's tap opens its card; Walk here goes (ui-pass-3 §8).
  await page.locator('#places-list .mw__pin[data-cat="harbour"][data-name*="garrick" i]').first().dispatchEvent('click');
  await page.locator('#places-list [data-map-walk]').click();
  const board = page.locator('.td-harbour');
  await expect(board).toBeVisible({ timeout: 30000 });
  const verdant = board.locator('[data-harbour-row]', { hasText: /mossharbor/i });
  await expect(verdant).toHaveAttribute('data-state', 'locked');
  await verdant.click();
  await expect(board.locator('[data-harbour-reason]')).toContainText(/cinder sovereign/i);
  await page.keyboard.press('Escape');
  await expect(board).toHaveCount(0);
  // The Map the pin was on folds too.
  for (let i = 0; i < 4; i++) {
    if (!(await page.locator('#places-list.td-map').isVisible()) && !(await page.locator('#game-menu').isVisible())) break;
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  }
  // The Plaza Stone, touched: it remembers the Keeper; the Atlas lists the land's stones.
  await go(page, /the plaza stone/i, /pyrehold/i);
  const atlas = page.locator('.td-atlas');
  await expect(atlas).toBeVisible();
  await expect(atlas.locator('[data-stone="reach:pyrehold"]')).toHaveAttribute('data-state', 'here');
  await expect(atlas.locator('[data-atlas-row]')).toHaveCount(10);
  await page.keyboard.press('Escape');
  await expect(atlas).toHaveCount(0);
  // Into the Steppe by its gate (the Map's way pin), then the Watch Cairn: Pyrehold is a touched stone now.
  await go(page, /north gate/i, /cinder steppe|watch cairn/i);
  expect((await here(page)).area).toBe('infernal-reach-steppe');
  await go(page, /a watch cairn/i, /cinder steppe|watch cairn/i);
  await expect(page.locator('.td-toast')).toContainText(/struck by five, kept by one/i, { timeout: 10000 });
  await go(page, /^the watch cairn$/i, /cinder steppe|watch cairn/i);
  await expect(atlas).toBeVisible();
  await expect(atlas.locator('[data-stone="reach:watch-cairn"]')).toHaveAttribute('data-state', 'here');
  await atlas.locator('[data-stone="reach:pyrehold"]').click();
  await atlas.locator('[data-atlas-go]').click();
  await expect(atlas).toHaveCount(0);
  await expect.poll(async () => (await here(page)).area, { timeout: 10000 }).toBe('infernal-reach-pyrehold');
  await expect(canvas(page)).toHaveAttribute('data-area', /pyrehold/i);
  expect(errors, errors.join('\n')).toEqual([]);
});
