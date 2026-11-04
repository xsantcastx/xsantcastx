/**
 * td-s10b.spec.ts — S10b: the Last Siege and the Fogmother (docs/world/campaign.md S10; docs/design/monsters-abilities.md
 * §6.2, §6.4; docs/handoff/s10b.md).
 *
 * Both are the room's (a world boss rises only in the room-run world); here the screen raises each beside the Keeper
 * through the webdriver hook `__tdS10` (`go`, `raise`, `light`), so its party form runs in this screen's own MobSystem
 * and every telegraph and mark draws as on a member's screen:
 *   - the Siege Trench on the Bastion Road; the tower drawn at world-boss size on its own body, rolling its track; the
 *     crossbow volley's rings, then the catapult's meteor rings, in an ashfall night;
 *   - the Three Posts on the Black Meres; the Fogmother on her own body; Wrap's grey line, a lit post's light and flame,
 *     Gloam Blizzard's rings and the Settle's closing fog, on a foggy night;
 *   - both uniques' cards say what they do and where they fall.
 *
 * Screenshots go to output/s10b/ (never committed): iso and flat, 1280×800 and a 390×844 phone.
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed, toSection } from './play-helpers';

const SHOTS = 'output/s10b';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const canvas = (page: Page) => page.locator('.viewport canvas').first();
interface S10State { look: string | null; scale: number; track: { i: number; done: boolean } | null; posts: number; cut: number; up: boolean; phase: number; hp: number; rings: number; marks: string[]; x: number; y: number }
const s10 = <T>(page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => {
  const r = (window as unknown as { __tdS10: Record<string, (...x: unknown[]) => unknown> }).__tdS10;
  return r[f as string](...(a as unknown[])) as T;
}, [fn, args] as const) as Promise<T>;
const st = (page: Page) => s10<S10State>(page, 'state');
const calm = (page: Page) => page.evaluate(() => (window as unknown as { __tdS8: { calm: () => boolean } }).__tdS8.calm());

const item = (id: string, def: string, name: string, stats: Record<string, number>, level: number) => ({
  id, definitionId: def, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'legendary', soulbound: false,
  acquiredAt: '2026-11-04T00:00:00.000Z', revision: { hlc: 300, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
  name, type: 'artifact', stats, sellValue: 6000, econ: 3, location: { kind: 'bag' }, itemLevel: level,
});
const WALL = item('wall-0', 'unique-wall-that-kept-walking', 'The Wall That Kept Walking', { blockChance: 38, defense: 17, fireResist: 24, life: 34 }, 32);
const PSALM = item('psalm-0', 'unique-psalm-heard-through-water', 'The Psalm Heard Through Water', { coldResist: 19, lightningResist: 19, mana: 38, castSpeed: 14 }, 54);

async function enter(page: Page, size: { width: number; height: number }, weather: string, items: unknown[] = [], view = ''): Promise<void> {
  await page.setViewportSize(size);
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  const base = ledger({}) as { records: unknown[]; hlc: number };
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Pell', vocation: 'lanternwright', tree: { spent: {}, free: [], at: 1 } },
    ...(items.length ? { 'godforge-inventory': { ...base, records: [...base.records, ...items], hlc: base.hlc + 400 } } : {}),
  });
  await page.goto(`/play?td=1&hour=23&weather=${weather}${view}`);
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
  await page.waitForFunction(() => !!(window as unknown as { __tdS10?: unknown }).__tdS10, null, { timeout: 15000 });
}
async function toArena(page: Page, area: string, c: number, r: number, id: string): Promise<void> {
  // A level-1 Keeper in a level-30 land: the photographs hold him whole from the first step (the creatures blind).
  await calm(page);
  await toSection(page, area, c, r);
  await page.waitForTimeout(800);
  const at = await s10<{ c: number; r: number } | null>(page, 'go', id);
  expect(at, `${id}'s arena`).not.toBeNull();
  await page.waitForTimeout(1200);
}

const VIEWS = { desktop: [{ width: 1280, height: 800 }, ''], phone: [{ width: 390, height: 844 }, ''], 'iso-desktop': [{ width: 1280, height: 800 }, '&artopt=iso'], 'iso-phone': [{ width: 390, height: 844 }, '&artopt=iso'] } as const;

test.describe('S10b: the Last Siege and the Fogmother', () => {
  test.describe.configure({ timeout: 150000 });

  for (const [name, [size, view]] of Object.entries(VIEWS)) {
    test(`the Last Siege on an ashfall night: the tower, its volley and its catapult (${name})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await enter(page, size, 'ashfall', [], view);
      await toArena(page, 'infernal-reach-pyre-peaks', 70, 30, 'last-siege');
      await shot(page, `siege-trench-${name}`);
      expect(await s10(page, 'mates')).toBe(3);
      await calm(page);
      const up = await s10<{ hp: number; max: number; look: string | null }>(page, 'raise', 'last-siege', .99);
      expect(up.look).toBe('last-siege');
      await page.waitForTimeout(2600);
      const p1 = await st(page);
      expect(p1.look).toBe('last-siege');
      expect(p1.scale).toBeGreaterThanOrEqual(2);
      expect(p1.track).not.toBeNull();
      expect(p1.marks).toContain('fix');
      await expect.poll(async () => (await st(page)).rings, { timeout: 6000 }).toBeGreaterThan(0);
      await shot(page, `siege-volley-${name}`);
      // Phase 2 (65–30%): Load the Catapult — the meteor rings on the healer's side, the garrison down the ladders.
      await s10(page, 'raise', 'last-siege', .5, 60, -12);
      await page.waitForTimeout(3400);
      expect((await st(page)).phase).toBe(1);
      await shot(page, `siege-catapult-${name}`);
      expect(errors).toEqual([]);
    });

    test(`the Fogmother on a foggy night: Wrap, a lit post, Gloam Blizzard and the Settle (${name})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await enter(page, size, 'fog', [], view);
      await toArena(page, 'umbral-marches', -4, -6, 'fogmother');
      await shot(page, `three-posts-${name}`);
      expect(await s10(page, 'mates')).toBe(3);
      await calm(page);
      const up = await s10<{ look: string | null }>(page, 'raise', 'fogmother', .99, 64, -20);
      expect(up.look).toBe('fogmother');
      await page.waitForTimeout(3600);
      const p1 = await st(page);
      expect(p1.phase).toBe(0);
      expect(p1.marks).toContain('wrap');
      await shot(page, `fog-wrap-${name}`);
      // Phase 2: She Sings Your Name (Brands), Gloam Blizzard over the farthest; one post lit.
      await s10(page, 'raise', 'fogmother', .5, 64, -20);
      expect(await s10(page, 'light', 1)).toBe(1);
      await page.waitForTimeout(8300);
      await shot(page, `fog-blizzard-${name}`);
      // Phase 3: the Settle closes the fog to three tiles but round the lit posts; all three lit, she deals a quarter less.
      await s10(page, 'raise', 'fogmother', .2, 64, -20);
      expect(await s10(page, 'light', 3)).toBe(3);
      await expect.poll(async () => (await st(page)).marks, { timeout: 8000 }).toContain('settle');
      await page.waitForTimeout(400);
      const p3 = await st(page);
      expect(p3.posts).toBe(3);
      expect(p3.cut).toBeCloseTo(.75, 2);
      await shot(page, `fog-settle-${name}`);
      expect(errors).toEqual([]);
    });
  }

  for (const [it, label, where] of [[WALL, 'The Wall That Kept Walking', 'Found in: The Last Siege'], [PSALM, 'The Psalm Heard Through Water', 'Found in: The Fogmother']] as const) {
    test(`${label}: its card says what it does and where it falls`, async ({ page }) => {
      await enter(page, { width: 1280, height: 1000 }, 'clear', [it]);
      await page.waitForTimeout(1500);
      await canvas(page).focus();
      await page.keyboard.press('i');
      const cell = page.locator(`button.pocket[aria-label^="${label}"]`).first();
      await expect(cell).toBeVisible({ timeout: 10000 });
      await cell.hover();
      const card = page.locator('.d2tip').first();
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('data-rarity', 'legendary');
      await expect(card.locator('.d2tip__special')).toContainText('Used for:');
      await expect(card.locator('.d2tip__special')).toContainText(where);
      await page.waitForTimeout(200);
      fs.mkdirSync(SHOTS, { recursive: true });
      await card.screenshot({ path: `${SHOTS}/${it.definitionId}-card.png` });
    });
  }
});
