/**
 * td-los.spec.ts — line of sight and the crowd, played (td-sight.ts; owner 2026-10-21: "I was hitting the boss behind
 * the walls … the warlock skeletons all are like 1 on top of another").
 *
 * In the square by day (a house's wall reads plainly; the hook works the same on a dungeon floor), the webdriver-only
 * `__tdLos` hook finds a wall with open ground either side and no sight across it, stands the Warlock on one side and
 * a calm, sturdy boss on the other. A tap on the boss does
 * not target it; the attack key, his spells and a raw bolt thrown at it anyway leave its life whole (the bolt breaks
 * on the rock). On the surface, six raised skeletons laid on one pixel spread round him.
 * Screenshots: docs/handoff/cozy-ui/los-bolt-wall.jpg, los-skeletons.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

type Boss = { hp: number; max: number; x: number; y: number; seen: boolean; target: boolean };
type LosState = { walled: number; bolts: number; puffs: number; rays: number; asked: number; x: number; y: number; level: string };
const los = <T>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as unknown as { __tdLos: Record<string, (...x: unknown[]) => unknown> }).__tdLos[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>;
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/handoff/cozy-ui/${name}.jpg`, type: 'jpeg', quality: 82 });

async function arrive(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', ...extra });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdLos?: unknown }).__tdLos);
}

test.describe('line of sight', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a boss behind a wall: no target, no blow lands, a bolt thrown anyway breaks on the rock', async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await arrive(page);
    const arena = await los<{ keeper: { x: number; y: number }; boss: { x: number; y: number } } | null>(page, 'arena', 'ember-warden', 5000);
    expect(arena).not.toBeNull();
    await page.waitForTimeout(400);
    let boss = (await los<Boss>(page, 'boss'))!;
    expect(boss.seen).toBe(false);
    // A tap on it: no lock through rock.
    const at = (await los<{ x: number; y: number }>(page, 'page'))!;
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(150);
    expect((await los<Boss>(page, 'boss'))!.target).toBe(false);
    // Put him back where he stood (the tap walked him), then everything a Warlock has.
    await los(page, 'arena', 'ember-warden', 5000);
    await los(page, 'attack', true);
    for (const id of ['bone-spear', 'hellfire-nova', 'drain-life', 'ember-curse']) await los(page, 'cast', id);
    await page.waitForTimeout(1500);
    await los(page, 'attack', false);
    boss = (await los<Boss>(page, 'boss'))!;
    expect(boss.hp).toBe(boss.max);
    // A bolt thrown at it anyway: it breaks on the wall (a puff of grit), the boss keeps every point.
    // The floor's name card fades before the picture is taken.
    await page.waitForTimeout(3000);
    const before = (await los<LosState>(page, 'state')).walled;
    await los(page, 'bolt');
    await page.waitForTimeout(60);
    await los(page, 'bolt');
    await expect.poll(async () => (await los<LosState>(page, 'state')).puffs, { timeout: 3000, intervals: [20] }).toBeGreaterThan(0);
    await shot(page, 'los-bolt-wall');
    await expect.poll(async () => (await los<LosState>(page, 'state')).walled, { timeout: 3000 }).toBe(before + 2);
    expect((await los<Boss>(page, 'boss'))!.hp).toBe(boss.max);
    expect(errors).toEqual([]);
  });

  test('six skeletons laid on one spot spread round the Keeper', async ({ page }) => {
    test.setTimeout(90000);
    await arrive(page);
    await page.evaluate(() => (window as unknown as { __tdThorn: { clearing(): boolean } }).__tdThorn.clearing());
    await los(page, 'raise', 6);
    await page.waitForTimeout(4500);
    const kin = await los<{ x: number; y: number }[]>(page, 'kin');
    expect(kin.length).toBe(6);
    let min = Infinity;
    for (let i = 0; i < kin.length; i++) for (let j = i + 1; j < kin.length; j++) min = Math.min(min, Math.hypot(kin[i].x - kin[j].x, kin[i].y - kin[j].y));
    expect(min).toBeGreaterThanOrEqual(14);
    await shot(page, 'los-skeletons');
  });
});
