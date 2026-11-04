/**
 * td-s10boss.spec.ts — S10: threat, party forms and the first world boss (docs/world/campaign.md S10;
 * docs/design/monsters-abilities.md §5, §6.3; docs/handoff/s10boss.md).
 *
 * The Antlered Storm is the room's (a world boss rises only in the room-run world); here the screen raises it beside
 * the Keeper through the webdriver hook `__tdS10`, so its party form runs in this screen's own MobSystem and every
 * telegraph and mark draws as on a member's screen:
 *   - the Storm-Struck Oak stands in the Greenwood with its ring of split stumps;
 *   - the form wakes with the first blow, Strike's rings tell for 1.2 s, the fixate pip lies under its prey;
 *   - in phase 2 everyone is marked (Spread) and the Tether line is drawn; phase 3 opens the storm's eye;
 *   - the Crown of the Antlered Storm's card says what it does and where it falls.
 *
 * Screenshots go to output/s10boss/ (never committed): iso (the default), 1280×800 and a 390×844 phone.
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed, toSection } from './play-helpers';

const SHOTS = 'output/s10boss';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const canvas = (page: Page) => page.locator('.viewport canvas').first();
interface S10State { up: boolean; phase: number; hp: number; rings: number; marks: string[]; x: number; y: number; stats: Record<string, number> | null }
const s10 = <T>(page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => {
  const r = (window as unknown as { __tdS10: Record<string, (...x: unknown[]) => unknown> }).__tdS10;
  return r[f as string](...(a as unknown[])) as T;
}, [fn, args] as const) as Promise<T>;
const st = (page: Page) => s10<S10State>(page, 'state');

const CROWN = {
  id: 'crown-0', definitionId: 'unique-crown-of-the-antlered-storm', kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'legendary', soulbound: false,
  acquiredAt: '2026-11-04T00:00:00.000Z', revision: { hlc: 300, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
  name: 'Crown of the Antlered Storm', type: 'artifact', stats: { lightningResist: 29, moveSpeed: 9.6 }, sellValue: 6000, econ: 3, location: { kind: 'bag' }, itemLevel: 42,
};

async function enter(page: Page, size: { width: number; height: number }, items: unknown[] = [], view = ''): Promise<void> {
  await page.setViewportSize(size);
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  const base = ledger({}) as { records: unknown[]; hlc: number };
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Pell', vocation: 'ashguard', tree: { spent: {}, free: [], at: 1 } },
    ...(items.length ? { 'godforge-inventory': { ...base, records: [...base.records, ...items], hlc: base.hlc + 400 } } : {}),
  });
  await page.goto(`/play?td=1&hour=15&weather=storm${view}`);
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
  await page.waitForFunction(() => !!(window as unknown as { __tdS10?: unknown }).__tdS10, null, { timeout: 15000 });
}

/** To the Greenwood's heart, at the Storm-Struck Oak. */
async function toOak(page: Page): Promise<void> {
  await toSection(page, 'verdant-wilds', 64, 30);
  await page.waitForTimeout(800);
  const at = await s10<{ c: number; r: number } | null>(page, 'oak');
  expect(at, 'the Oak stands in the Wilds').not.toBeNull();
  await page.waitForTimeout(1200);
}

test.describe('S10: the Antlered Storm', () => {
  test.describe.configure({ timeout: 150000 });

  const VIEWS = { desktop: [{ width: 1280, height: 800 }, ''], phone: [{ width: 390, height: 844 }, ''], 'iso-desktop': [{ width: 1280, height: 800 }, '&artopt=iso'], 'iso-phone': [{ width: 390, height: 844 }, '&artopt=iso'] } as const;
  for (const [name, [size, view]] of Object.entries(VIEWS)) {
    test(`the Oak, the Storm's telegraphs and its marks (${name})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await enter(page, size, [], view);
      await toOak(page);
      await shot(page, `oak-${name}`);
      // Phase 1: it wakes with the first blow (its life a hair under whole), and Strike's rings open under the Keepers.
      expect(await s10(page, 'mates')).toBe(3);
      // A level-1 Keeper would fall to it in two blows: the photograph holds him whole (its rings still open).
      await page.evaluate(() => (window as unknown as { __tdS8: { calm: () => boolean } }).__tdS8.calm());
      const up = await s10<{ hp: number; max: number }>(page, 'storm', .99);
      expect(up.max).toBeGreaterThan(100000);
      await page.waitForTimeout(2300);
      const p1 = await st(page);
      expect(p1.up).toBe(true);
      expect(p1.phase).toBe(0);
      expect(p1.marks).toContain('fix');
      await expect.poll(async () => (await st(page)).rings, { timeout: 6000 }).toBeGreaterThan(0);
      await shot(page, `telegraph-strike-${name}`);
      // Phase 2 (60–30%): Spread on everyone, the Tether, the Add wave.
      await s10(page, 'storm', .5, 120, 40);
      await page.waitForTimeout(400);
      await s10(page, 'mark', { m: 'tether', a: '', b: 'fx-Odo', t: 10 });
      await s10(page, 'mark', { m: 'brand', a: 'fx-Sela', t: 8 });
      await page.waitForTimeout(3200);
      await shot(page, `telegraph-spread-tether-${name}`);
      expect((await st(page)).marks).toContain('tether');
      expect(errors).toEqual([]);
    });
  }

  test('the Crown of the Antlered Storm: its card says what it does and where it falls', async ({ page }) => {
    await enter(page, { width: 1280, height: 1000 }, [CROWN]);
    await page.waitForTimeout(1500);
    await canvas(page).focus();
    await page.keyboard.press('i');
    const cell = page.locator('button.pocket[aria-label^="Crown of the Antlered Storm"]').first();
    await expect(cell).toBeVisible({ timeout: 10000 });
    await cell.hover();
    const card = page.locator('.d2tip').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-rarity', 'legendary');
    await expect(card.locator('.d2tip__special')).toContainText('Used for:');
    await expect(card.locator('.d2tip__special')).toContainText('Found in: The Antlered Storm');
    await page.waitForTimeout(200);
    fs.mkdirSync(SHOTS, { recursive: true });
    await card.screenshot({ path: `${SHOTS}/crown-card.png` });
  });
});
