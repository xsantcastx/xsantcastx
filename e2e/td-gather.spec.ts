/**
 * td-gather.spec.ts — the RuneScape-style gathering skills and Weather v1 in the top-down world (docs/handoff/gather.md):
 *
 *   - walk to a lake's marked spot (a ripple with a float) and fish until the satchel is full: the loop lands what fits,
 *     then the next catch is refused and the line comes in, with the reason;
 *   - light a log with a tinderbox (the satchel card's Light), cook the raw fish at the fire, eat a meal;
 *   - the weather shows (rain streaks, the pip, Wet on the Keeper);
 *   - a 360×640 touch phone: tap a spot's float to fish, the card's Light button is a thumb's size.
 *
 * Screenshots: docs/handoff/gather/*.png.
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed, stackQty } from './play-helpers';

const SHOTS = 'docs/handoff/gather';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const canvas = (page: Page) => page.locator('.viewport canvas');

type Spot = { id: string; water: string; x: number; y: number; shore: { x: number; y: number }; d: number };
type G = {
  spots(reach?: number): Spot[];
  near(x: number, y: number, dx?: number, dy?: number): boolean;
  page(x: number, y: number): { x: number; y: number };
  fires(): { x: number; y: number; left: number }[];
  hurt(n: number): number;
  state(): { fishing: { n: number } | null; cooking: { n: number } | null; striking: boolean; fires: number; shadows: number; weather: { state: string; level: number }; wet: number; hp: number; maxHp: number; x: number; y: number };
};
const gx = (page: Page) => page.evaluate(() => !!(window as unknown as { __tdGather?: G }).__tdGather);

function gear(id: string, i: number): unknown {
  return {
    id, definitionId: 'anchor-ring', kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name: 'Anchor Ring', type: 'artifact', stats: { defense: i + 1 }, sellValue: 90, econ: 3, location: { kind: 'bag' }, itemLevel: 3,
  };
}
const stackRec = (key: string) => ({
  id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 90, deviceId: 'e2e', sequence: 1 }, source: 'inventory', stackKey: key, location: { kind: 'bag' },
});
function inventory(records: unknown[], stacks: Record<string, number>): unknown {
  const keys = Object.keys(stacks);
  return {
    version: 2, records: [...records, ...keys.map(stackRec)], tombstones: [],
    stackOps: keys.map((k, i) => ({ id: `e2e-grant-${k}`, stackKey: k, kind: 'grant', quantity: stacks[k], hlc: 80 + i, deviceId: 'e2e', sequence: i + 1 })),
    goldFromSales: 0, sold: 0, hlc: 500, legacyBackup: null, era: ERA,
  };
}

async function enter(page: Page, blobs: Record<string, unknown>, query = ''): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Pell', vocation: 'ashguard', tree: { spent: {}, free: [], at: 1 } },
    ...blobs,
  });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
  await expect.poll(() => gx(page), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(500);
}

/** The nearest lake spot to the town, with the Keeper set down a few tiles from its shore (he still walks there). */
async function nearLake(page: Page): Promise<Spot> {
  const spot = await page.evaluate(() => (window as unknown as { __tdGather: G }).__tdGather.spots(1600).find(s => s.water === 'lake') ?? null);
  expect(spot, 'a lake spot near the Seamworks').not.toBeNull();
  await page.evaluate(s => (window as unknown as { __tdGather: G }).__tdGather.near(s.shore.x, s.shore.y, 0, 56), spot!);
  await page.waitForTimeout(400);
  return spot!;
}

test.describe('gathering and weather', () => {
  test.describe.configure({ timeout: 120000 });

  test('walk to a lake spot and fish until the satchel is full', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // 51 rings and the starter tools fill 59 cells; the 60th holds 19 Ash Perch, so one more fits and the next does not.
    const rings = Array.from({ length: 51 }, (_, i) => gear(`g-r${String(i).padStart(2, '0')}`, i));
    await enter(page, { 'godforge-inventory': inventory(rings, { 'ash-perch': 19, 'worn-rod': 1 }) }, '&weather=clear');
    const spot = await nearLake(page);
    // The fish under the water show round the float.
    await expect.poll(() => page.evaluate(() => (window as unknown as { __tdGather: G }).__tdGather.state().shadows)).toBeGreaterThanOrEqual(3);
    const at = await page.evaluate(s => (window as unknown as { __tdGather: G }).__tdGather.page(s.x, s.y), spot);
    await page.mouse.click(at.x, at.y);
    await expect(canvas(page)).toHaveAttribute('data-gather', /^fishing:/, { timeout: 15000 });
    await shot(page, 'fishing-1280');
    // One catch lands (the pile reaches 20), the next is refused: the line comes in and the toast says why.
    await expect.poll(() => stackQty(page, 'ash-perch'), { timeout: 40000 }).toBe(20);
    await expect(canvas(page)).toHaveAttribute('data-gather', '', { timeout: 40000 });
    await expect(page.locator('.td-toast')).toContainText(/satchel is full/i);
    expect(await stackQty(page, 'ash-perch')).toBe(20);
    await shot(page, 'fishing-full-1280');
  });

  test('light a fire, cook the catch, eat a meal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, { 'godforge-inventory': inventory([], { 'ashwood-log': 2, tinderbox: 1, 'ash-perch': 3, 'baked-ash-perch': 1 }) }, '&weather=clear');
    await page.evaluate(() => (window as unknown as { __tdArt: { road(dc: number): unknown } }).__tdArt.road(1));
    await page.waitForTimeout(300);
    await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
    await page.keyboard.press('i');
    const book = page.locator('#satchel-book');
    await expect(book).toBeVisible();
    await book.locator('[data-stack="ashwood-log"]').click();
    const light = page.locator('[data-light]');
    await expect(light).toBeVisible();
    await expect(page.locator('.d2tip--pinned')).toContainText(/Found in/);
    await expect(page.locator('.d2tip--pinned')).toContainText(/Used for/);
    await light.click();
    await expect(canvas(page)).toHaveAttribute('data-fires', '1', { timeout: 10000 });
    expect(await stackQty(page, 'ashwood-log')).toBe(1);
    await page.waitForTimeout(600);
    await shot(page, 'fire-1280');
    // E at the fire: the pan, until the raw fish are gone (some may burn at Cooking 1).
    await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
    await page.keyboard.press('e');
    await expect(canvas(page)).toHaveAttribute('data-gather', /^cooking:/, { timeout: 5000 });
    await expect.poll(() => stackQty(page, 'ash-perch'), { timeout: 20000 }).toBe(0);
    const baked = await stackQty(page, 'baked-ash-perch'), burnt = await stackQty(page, 'burnt-fish');
    expect(baked - 1 + burnt).toBe(3);
    await shot(page, 'cooked-1280');
    // Eat: the meal mends slowly.
    const hp = await page.evaluate(() => (window as unknown as { __tdGather: G }).__tdGather.hurt(40));
    await page.keyboard.press('i');
    await expect(book).toBeVisible();
    await book.locator('[data-stack="baked-ash-perch"]').click();
    await page.locator('[data-eat]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __tdGather: G }).__tdGather.state().hp), { timeout: 15000 }).toBeGreaterThan(hp + 20);
    expect(await stackQty(page, 'baked-ash-perch')).toBe(baked - 1);
  });

  test('the weather shows: rain streaks, the pip, the Keeper Wet; fog on the land', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, {}, '&weather=rain');
    await expect(canvas(page)).toHaveAttribute('data-weather', 'rain:1.0');
    await expect(page.locator('[data-weather-pip]')).toHaveAttribute('data-wx', 'rain');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __tdGather: G }).__tdGather.state().wet)).toBeGreaterThan(0);
    await page.waitForTimeout(800);
    await shot(page, 'rain-1280');
    await page.goto('/play?td=1&hour=12&weather=fog');
    await expect(canvas(page)).toHaveAttribute('data-weather', 'fog:1.0', { timeout: 30000 });
    await page.waitForTimeout(800);
    await shot(page, 'fog-1280');
    await page.goto('/play?td=1&hour=22&weather=storm');
    await expect(canvas(page)).toHaveAttribute('data-weather', 'storm:1.0', { timeout: 30000 });
    await page.waitForTimeout(800);
    await shot(page, 'storm-night-1280');
  });
});

test.describe('a 360×640 touch phone', () => {
  test.use({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  test.describe.configure({ timeout: 120000 });

  test('tap a spot\'s float to fish; the card\'s Light is a thumb\'s size and lights the log', async ({ page }) => {
    await enter(page, { 'godforge-inventory': inventory([], { 'worn-rod': 1, 'ashwood-log': 1, tinderbox: 1 }) }, '&weather=rain');
    const spot = await nearLake(page);
    const at = await page.evaluate(s => (window as unknown as { __tdGather: G }).__tdGather.page(s.x, s.y), spot);
    await page.touchscreen.tap(at.x, at.y);
    await expect(canvas(page)).toHaveAttribute('data-gather', /^fishing:/, { timeout: 15000 });
    await expect(page.locator('.td-toast')).toContainText(/Netter Pell/);
    await shot(page, 'fishing-rain-360');
    await expect.poll(() => stackQty(page, 'ash-perch'), { timeout: 40000 }).toBeGreaterThanOrEqual(1);
    // Off the shore, into the satchel: the log's card, Light.
    await page.evaluate(() => (window as unknown as { __tdArt: { road(dc: number): unknown } }).__tdArt.road(1));
    await page.getByRole('button', { name: /^Satchel/ }).first().tap();
    const cell = page.locator('#satchel-book [data-stack="ashwood-log"]');
    await expect(cell).toBeVisible();
    await cell.tap();
    const light = page.locator('[data-light]');
    await expect(light).toBeVisible();
    const box = (await light.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await light.tap();
    await expect(canvas(page)).toHaveAttribute('data-fires', '1', { timeout: 10000 });
    await page.waitForTimeout(600);
    await shot(page, 'fire-rain-360');
  });
});
