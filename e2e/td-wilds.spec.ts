/**
 * td-wilds.spec.ts — S11, the Verdant Wilds as an act (docs/world/campaign.md S11; docs/design/world-acts.md §1.3,
 * §2.3, §5.3): reach it (the long-way ketch to Mossharbor), walk a seam both ways (the Shore's north road into the
 * Fernglades), find the Greenwood's old road grown shut and take the connector instead (the Root Hollows −1 … −3 and up
 * the root-ramp into the Deep Wilds), see the hot spots spawn (the Hart Meadow's champions, the Bell-less Square's camp),
 * touch a Waystone and travel to Rootglass, and follow the Walking Tree until Glim dims beside it.
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

async function open(page: Page, query = '/play?td=1&hour=12'): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', ...purse(100_000) });
  await page.goto(query);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdReach?: unknown }).__tdReach);
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

test('reach the act and walk a seam both ways: Mossharbor, up the Shore\'s north road into the Fernglades and back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  // Ember Harbour's long-way ketch lands on Sunny Pell's pier, on the Mossy Shore.
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  expect((await here(page)).area).toBe('verdant-wilds-shore');
  expect((await here(page)).land).toBe('verdant-wilds');
  expect(await reach(page, 'atSeam', 'shore-n', 4)).toBe(true);
  await walk(page, 'ArrowUp', async () => (await here(page)).area === 'verdant-wilds-fernglades');
  const at = await here(page);
  expect(at.area).toBe('verdant-wilds-fernglades');
  const south = (await reach<{ id: string; c: number; r: number }[]>(page, 'seams')).find(s => s.id === 'fernglades-s')!;
  expect(Math.abs(at.c - south.c)).toBeLessThanOrEqual(2);
  expect(Math.abs(at.r - (south.r - 6))).toBeLessThanOrEqual(3);
  expect(await reach<string[]>(page, 'near', 8)).toEqual([]);
  await expect(canvas(page)).toHaveAttribute('data-area', /fernglades|bell-post/i, { timeout: 10000 });
  expect(await reach(page, 'atSeam', 'fernglades-s', 4)).toBe(true);
  await walk(page, 'ArrowDown', async () => (await here(page)).area === 'verdant-wilds-shore');
  expect((await here(page)).area).toBe('verdant-wilds-shore');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the thorn hedge shuts the Greenwood\'s road; the Root Hollows are the way on: down three floors, up the root-ramp into the Deep Wilds', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  // Up the old road to the thorns: the Keeper stops at the hedge, and the cairn beside it can be read.
  await toSection(page, 'verdant-wilds-greenwood', 100, -138);
  await walk(page, 'ArrowUp', async () => (await here(page)).r < -145, 4000);
  expect((await here(page)).r).toBeGreaterThanOrEqual(-145);
  await go(page, /a cairn by the thorns/i, /greenwood/i);
  await expect(page.locator('.td-toast')).toContainText(/the wood closes what it forgets/i, { timeout: 10000 });
  // The connector: in by the root-hole at the Greenwood's road end.
  await toSection(page, 'verdant-wilds-greenwood', 228, -108);
  await go(page, /the root hollows/i, /gnawed galleries/i);
  expect((await here(page)).level).toBe('root-hollows-1');
  await go(page, /stairs down/i, /sporewell/i);
  await go(page, /stairs down/i, /heartroot cellar/i);
  // The thing to read on the Heartroot Cellar.
  await go(page, /the heartroot's rings/i, /heartroot cellar/i);
  await expect(page.locator('.td-toast')).toContainText(/tomorrow/i, { timeout: 10000 });
  await go(page, /root-ramp/i, /deep wilds|root-ramp|heartroot stone/i);
  const out = await here(page);
  expect(out.area).toBe('verdant-wilds-deep-wilds');
  expect(out.level).toBe('surface');
  // And back down the way it came.
  await go(page, /the root-ramp/i, /heartroot cellar/i);
  expect((await here(page)).level).toBe('root-hollows-3');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the hot spots spawn: the Hart Meadow\'s champion packs, the Bell-less Square\'s camp', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await toSection(page, 'verdant-wilds-deep-wilds', 8, 8);
  const meadow = (await reach<{ c: number; r: number; n: number }>(page, 'campAt', 'hart-meadow'))!;
  expect(meadow.n).toBe(6);
  await toSection(page, 'verdant-wilds-deep-wilds', meadow.c, meadow.r + 12);
  await expect.poll(async () => (await reach<{ type: string }[]>(page, 'camp', 'hart-meadow')).length, { timeout: 10000 }).toBeGreaterThanOrEqual(4);
  const harts = await reach<{ type: string; level: number }[]>(page, 'camp', 'hart-meadow');
  expect(harts.some(m => m.type === 'rootglass-hart')).toBe(true);
  for (const m of harts) { expect(m.level).toBeGreaterThanOrEqual(21); expect(m.level).toBeLessThanOrEqual(25); }
  await expect(canvas(page)).toHaveAttribute('data-area', /hart meadow|deep wilds/i);
  await toSection(page, 'verdant-wilds-courts', 8, 8);
  const square = (await reach<{ c: number; r: number; n: number }>(page, 'campAt', 'bell-less-square'))!;
  await toSection(page, 'verdant-wilds-courts', square.c, square.r + 12);
  await expect.poll(async () => (await reach<{ type: string }[]>(page, 'camp', 'bell-less-square')).length, { timeout: 10000 }).toBeGreaterThanOrEqual(8);
  expect((await reach<{ type: string }[]>(page, 'camp', 'bell-less-square')).some(m => m.type === 'vine-lasher')).toBe(true);
});

test('Waystones: the Net Stone remembers the Keeper, and the Atlas travels to Rootglass\'s Boardwalk Stone for free', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await toSection(page, 'verdant-wilds-shore', 8, 8);
  await go(page, /^the net stone$/i, /mossy shore|net stone/i);
  const atlas = page.locator('.td-atlas');
  await expect(atlas).toBeVisible();
  await expect(atlas.locator('[data-stone="wilds:net"]')).toHaveAttribute('data-state', 'here');
  await expect(atlas.locator('[data-atlas-row]')).toHaveCount(8);
  await atlas.locator('[data-stone="wilds:rootglass"]').click();
  await atlas.locator('[data-atlas-go]').click();
  await expect(atlas).toHaveCount(0);
  await expect.poll(async () => (await here(page)).area, { timeout: 10000 }).toBe('verdant-wilds-rootglass');
  await expect(canvas(page)).toHaveAttribute('data-area', /rootglass/i, { timeout: 10000 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Walking Tree: it moves while unseen, three times; Glim dims beside it; one blow, a copy-seed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '/play?td=1&hour=23');
  await page.waitForFunction(() => !!(window as unknown as { __tdS8?: unknown }).__tdS8);
  await toSection(page, 'verdant-wilds-greenwood', 60, -56);
  // Night has fallen (hour=23): the tree is walking tonight, or force it on for the test's clock.
  await page.evaluate(() => (window as unknown as { __tdS8: { night: (id: string) => boolean } }).__tdS8.night('walking-tree'));
  await expect(canvas(page)).toHaveAttribute('data-night-events', /walking-tree/, { timeout: 10000 });
  type W = { x: number; y: number; c: number; r: number; ready: boolean; struck: boolean };
  const tree = () => reach<W>(page, 'walker');
  for (let i = 0; i < 3; i++) {
    const was = await tree();
    // Look at it (it stands still while seen), then away (forty tiles off: off the screen), then back.
    await toSection(page, 'verdant-wilds-greenwood', was.c + 3, was.r + 2);
    await page.waitForTimeout(1000);
    expect((await tree()).c).toBe(was.c);
    await toSection(page, 'verdant-wilds-greenwood', 20, -30);
    await expect.poll(async () => { const t = await tree(); return t.c !== was.c || t.r !== was.r; }, { timeout: 6000 }).toBe(true);
  }
  const at = await tree();
  await toSection(page, 'verdant-wilds-greenwood', at.c + 3, at.r + 2);
  await expect.poll(async () => (await tree()).ready, { timeout: 6000 }).toBe(true);
  await expect(page.locator('.td-toast')).toContainText(/glim dims beside the tree/i, { timeout: 10000 });
  await toSection(page, 'verdant-wilds-greenwood', at.c + 1, at.r + 1);
  // The prompt names the verb: Strike the tree (never Chop).
  await expect(page.getByText('Strike the tree').first()).toBeVisible({ timeout: 5000 });
  await canvas(page).focus();
  await page.keyboard.press('e');
  await expect.poll(async () => (await tree()).struck, { timeout: 5000 }).toBe(true);
  await expect(page.locator('.td-toast')).toContainText(/copy-seed/i, { timeout: 10000 });
  await page.screenshot({ path: 'output/s11wilds/walker-struck.png' });
  expect(errors, errors.join('\n')).toEqual([]);
});
