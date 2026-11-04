/**
 * td-s8storm.spec.ts — S8: thunderstorms, the land weathers, and night events batch 1 (docs/world/campaign.md S8;
 * docs/design/world-acts.md §3, §5; docs/handoff/s8storm.md).
 *
 *   - a storm's strike: the 1.2 s ring tell, then 8% of max life as lightning; never below a tenth of life;
 *   - the land specials: Ashfall (Ember Isle), Spore drift (the Wilds), Mist-rain (the Marches) show and set their rules;
 *   - Odette Pryor's board in the Pyre Spire's Study reads the next two windows;
 *   - each night event runs, never hurts, and pays once to one who follows it (the reward is laid on the ground).
 *
 * Screenshots go to output/s8storm/ (never committed): iso (the default) and classic, 1280×800 and a 390×844 phone.
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed, stackQty, toSection } from './play-helpers';

const SHOTS = 'output/s8storm';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const canvas = (page: Page) => page.locator('.viewport canvas').first();

interface S8State {
  events: { id: string; t: number }[]; tracks: Record<string, { near: number; paid: boolean; full: boolean; lit: boolean } | null>;
  strikes: number; rings: number; flashes: number; weather: string; hp: number; maxHp: number; wet: boolean;
  fire: number; spores: boolean; wetHalf: boolean; mealLightning: number; drops: { id: string; x: number; y: number }[];
  message: string; area: string; level: string; x: number; y: number;
}
const s8 = <T>(page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => {
  const r = (window as unknown as { __tdS8: Record<string, (...x: unknown[]) => unknown> }).__tdS8;
  return r[f as string](...(a as unknown[])) as T;
}, [fn, args] as const) as Promise<T>;
const st = (page: Page) => s8<S8State>(page, 'state');
const places = (page: Page) => s8<{ shift: [number, number][]; gate: [number, number]; column: [number, number][]; kiln: [number, number] }>(page, 'places');
/** Stand at tile (c, r) of the current area (the nearest free foot). */
const stand = (page: Page, c: number, r: number) => page.evaluate(([cc, rr]) => (window as unknown as { __tdZones: { to: (c: number, r: number) => unknown } }).__tdZones.to(cc, rr), [c, r] as const);

const stackRec = (key: string) => ({
  id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 90, deviceId: 'e2e', sequence: 1 }, source: 'inventory', stackKey: key, location: { kind: 'bag' },
});
function inventory(stacks: Record<string, number>): unknown {
  const keys = Object.keys(stacks);
  return {
    version: 2, records: keys.map(stackRec), tombstones: [],
    stackOps: keys.map((k, i) => ({ id: `e2e-grant-${k}`, stackKey: k, kind: 'grant', quantity: stacks[k], hlc: 80 + i, deviceId: 'e2e', sequence: i + 1 })),
    goldFromSales: 0, sold: 0, hlc: 500, legacyBackup: null, era: ERA,
  };
}

async function enter(page: Page, query: string, stacks: Record<string, number> = {}): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Pell', vocation: 'ashguard', tree: { spent: {}, free: [], at: 1 } },
    ...(Object.keys(stacks).length ? { 'godforge-inventory': inventory(stacks) } : {}),
  });
  await page.goto(`/play?td=1${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
  await page.waitForFunction(() => !!(window as unknown as { __tdS8?: unknown }).__tdS8, null, { timeout: 15000 });
  await page.waitForTimeout(400);
}

test.describe('S8: the storm, the land weathers, the night events', () => {
  test.describe.configure({ timeout: 150000 });

  test('a storm strike: the ring tells for 1.2 s, then 8% of life as lightning, never below a tenth', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, '&hour=15&weather=storm');
    await expect(canvas(page)).toHaveAttribute('data-weather', /^storm/, { timeout: 10000 });
    // Off the square (no strike lands on the town's safe ground; this one is forced at the Keeper's feet).
    await stand(page, 22, 40);
    await page.waitForTimeout(300);
    const before = await st(page);
    await s8(page, 'strike', 0, 0);
    await page.waitForTimeout(500);
    expect((await st(page)).rings).toBe(1);
    await shot(page, 'storm-tell-iso');
    await page.waitForTimeout(1100);
    const after = await st(page);
    expect(after.strikes).toBe(before.strikes + 1);
    const took = before.hp - after.hp;
    expect(took).toBeGreaterThan(0);
    expect(took).toBeLessThanOrEqual(Math.ceil(before.maxHp * .08 * 1.25) + 1);
    await shot(page, 'storm-scorch-iso');
    // At the floor: a strike takes nothing more.
    await page.evaluate(() => { const g = (window as unknown as { __tdGather: { hurt: (n: number) => number; state: () => { hp: number; maxHp: number } } }).__tdGather; const s = g.state(); g.hurt(s.hp - Math.ceil(s.maxHp * .1)); });
    const low = (await st(page)).hp;
    await s8(page, 'strike', 0, 0);
    await page.waitForTimeout(1500);
    expect((await st(page)).hp).toBeGreaterThanOrEqual(Math.min(low, Math.ceil(after.maxHp * .1)));
  });

  test('the storm on a phone, and in classic', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page, '&hour=21&weather=storm');
    await stand(page, 22, 40);
    await s8(page, 'strike', 24, 0);
    await page.waitForTimeout(600);
    await shot(page, 'storm-phone-iso');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/play?td=1&hour=15&weather=storm&artopt=live');
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await page.waitForFunction(() => !!(window as unknown as { __tdS8?: unknown }).__tdS8);
    await stand(page, 22, 40);
    await s8(page, 'strike', 20, 10);
    await page.waitForTimeout(600);
    await shot(page, 'storm-tell-classic');
  });

  test('the land weathers: Ashfall, Spore drift and Mist-rain show and set their rules', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, '&hour=15&weather=ashfall');
    await stand(page, 40, 30);
    await expect(canvas(page)).toHaveAttribute('data-weather', /^ashfall/, { timeout: 10000 });
    await page.waitForTimeout(600);
    expect((await st(page)).fire).toBeCloseTo(1.1, 5);
    await expect(page.locator('[data-weather-pip]')).toHaveAttribute('data-wx', 'ashfall');
    await shot(page, 'ashfall-iso');
    await page.goto('/play?td=1&hour=15&weather=spores');
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await page.waitForFunction(() => !!(window as unknown as { __tdS8?: unknown }).__tdS8);
    await toSection(page, 'verdant-wilds', 20, 30);
    await page.waitForTimeout(1500);
    expect((await st(page)).spores).toBe(true);
    await shot(page, 'spores-iso');
    await page.goto('/play?td=1&hour=15&weather=mistrain');
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await page.waitForFunction(() => !!(window as unknown as { __tdS8?: unknown }).__tdS8);
    await toSection(page, 'umbral-marches', 20, 30);
    await page.waitForTimeout(1500);
    const m = await st(page);
    expect(m.wetHalf).toBe(true);
    expect(m.wet).toBe(true);
    await shot(page, 'mistrain-iso');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await shot(page, 'mistrain-phone');
  });

  test('Odette Pryor\'s board reads the next two windows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, '&hour=12');
    await page.evaluate(() => (window as unknown as { __tdArt: { visit: (l: string, c: number, r: number, k: string) => boolean } }).__tdArt.visit('pyre-spire-2', 11, 2, 'infernal-reach-pyrehold'));
    await page.waitForTimeout(800);
    expect(await s8(page, 'board')).toBe('weather.board');
    await expect(page.getByText(/Odette Pryor's board, in chalk: ".+ by the next bell\. Then .+\."/).first()).toBeVisible({ timeout: 5000 });
    await shot(page, 'odette-board');
  });

  test('the Late Shift: six lamps walk out of the shaft; followed to where the last goes out, a lunch tin', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, '&hour=23');
    const p = await places(page);
    const end = p.shift[p.shift.length - 1];
    await stand(page, end[0] - 4, end[1] + 2);
    await s8(page, 'night', 'late-shift');
    await expect(canvas(page)).toHaveAttribute('data-night-events', /late-shift/, { timeout: 5000 });
    const hp0 = (await st(page)).hp;
    await page.waitForTimeout(9000);
    await shot(page, 'late-shift-iso');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await shot(page, 'late-shift-phone');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(async () => (await st(page)).drops.length, { timeout: 60000, intervals: [1000] }).toBeGreaterThan(0);
    const s = await st(page);
    expect(s.hp).toBeGreaterThanOrEqual(hp0);
    expect(s.drops[0].id).toMatch(/^night:late-shift:.*:cold-miners-pasty$/);
    await shot(page, 'late-shift-tin');
    expect(await s8(page, 'take', s.drops[0].id)).toBe(true);
    await expect.poll(() => stackQty(page, 'cold-miners-pasty'), { timeout: 5000 }).toBe(1);
  });

  test('the Count Goes On: the bell counts over the lych-gate', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, '&hour=23&weather=fog');
    const p = await places(page);
    await stand(page, p.gate[0], p.gate[1] + 1);
    await s8(page, 'night', 'count-goes-on');
    await page.waitForTimeout(5000);
    expect((await st(page)).events.map(e => e.id)).toContain('count-goes-on');
    expect((await st(page)).tracks['count-goes-on']?.full).toBe(true);
    await shot(page, 'count-goes-on-iso');
  });

  test('the Relief Column marches to the Bastion; walked beside, it leaves a Margin Note scrap', async ({ page }) => {
    // The march and the roll-call run on the clock (about 100 s): give a loaded machine room.
    test.setTimeout(300000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, '&hour=23');
    await toSection(page, 'infernal-reach-pyre-peaks', 38, -12);
    await page.waitForTimeout(1500);
    await stand(page, 38, -12);
    await s8(page, 'calm');
    await s8(page, 'night', 'relief-column');
    await page.waitForTimeout(6000);
    await shot(page, 'relief-column-iso');
    // Walk at their side (a step off the file) until it halts at the gate; then the roll-call, then the chalk.
    let last: { t: number } | null = null;
    for (let i = 0; i < 400; i++) {
      last = await s8<{ t: number } | null>(page, 'beside');
      if (!last || last.t > 75) break;
      await page.waitForTimeout(250);
    }
    expect(last).not.toBeNull();
    await shot(page, 'relief-column-gate-iso');
    await expect.poll(async () => (await st(page)).drops.map(d => d.id).join(','), { timeout: 90000, intervals: [1000] }).toMatch(/night:relief-column:.*:margin-note-scrap/);
  });

  test('the Kiln That Lights Itself: lit with a tinderbox before it fades, the burners\' cache', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await enter(page, '&hour=23&weather=ashfall', { tinderbox: 1 });
    const p = await places(page);
    await s8(page, 'calm');
    await toSection(page, 'infernal-reach-deep-charwood', 0, 0);
    await page.waitForTimeout(1500);
    // Beside the kiln (its mark keeps the wilds back two tiles round it): the first free foot south of it.
    const besideKiln = async () => {
      await stand(page, p.kiln[0] + 4, p.kiln[1] + 1);
      await page.waitForTimeout(300);
      const at = await st(page);
      return Math.hypot(at.x / 16 - p.kiln[0], at.y / 16 - p.kiln[1]) < 6;
    };
    await page.waitForTimeout(2500);
    expect(await besideKiln()).toBe(true);
    await s8(page, 'calm');
    const near = await st(page);
    expect(Math.hypot(near.x / 16 - p.kiln[0], near.y / 16 - p.kiln[1])).toBeLessThan(6);
    await s8(page, 'night', 'self-lit-kiln');
    await page.waitForTimeout(3000);
    await s8(page, 'calm');
    // (The area's name card fades first.)
    await page.waitForTimeout(4000);
    await shot(page, 'kiln-iso');
    expect(await s8(page, 'kiln')).toBe(true);
    await page.waitForTimeout(400);
    const s = await st(page);
    expect(s.drops.map(d => d.id).sort()).toEqual([expect.stringMatching(/basalt-blank$/), expect.stringMatching(/charcoal$/)]);
    for (const d of s.drops) expect(await s8(page, 'take', d.id)).toBe(true);
    await expect.poll(() => stackQty(page, 'charcoal'), { timeout: 5000 }).toBe(10);
    await shot(page, 'kiln-lit-iso');
  });
});
