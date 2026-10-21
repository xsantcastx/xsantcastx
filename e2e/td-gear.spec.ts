/**
 * td-gear.spec.ts — one and two hands, and town portals (owner 2026-10-21, relaying the players: "Ranger, no shield …
 * bows should be 2h, crossbows could be 1 handed" and "town portals").
 *
 *   1. A Thornstrider: his kit bow keeps the off-hand shut; he wears a two-handed Meridian Longbow (the card says
 *      "Two-handed bow"), the off-hand well stays blocked; then a one-handed crossbow, and a quiver beside it.
 *   2. The Waygate: out in the field he casts it (the real spell, its words over his head), steps in, comes out by the
 *      nearest hearth, cannot open another in town, steps back through and stands on the exact spot again.
 *
 * Screenshots: docs/handoff/cozy-ui/gear-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed, stackQty } from './play-helpers';

const SHOTS = 'docs/handoff/cozy-ui';
const canvas = (page: Page) => page.locator('.viewport canvas');

function gear(id: string, definitionId: string, name: string, stats: Record<string, number>, i: number): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats, sellValue: 900, econ: 3, location: { kind: 'bag' }, itemLevel: 3,
  };
}
const ITEMS = [
  gear('g-bow', 'meridian-longbow', 'Meridian Longbow', { spellDamage: 9 }, 0),
  gear('g-xbow', 'warden-crossbow', 'Canopy Warden\'s Crossbow', { spellDamage: 7 }, 1),
  gear('g-quiver', 'warden-quiver', 'Canopy Warden\'s Quiver', { defense: 5, magicFind: 4 }, 2),
];

type Spot = { continent: string; level: string; x: number; y: number; inTown?: boolean };
type W = { __tdWaygate: {
  cast(): string | null; read(): string | null; where(): Spot; gate(): { from: Spot; town: Spot; left: number } | null; trips(): number;
  stepOff(px?: number, dx?: number): { x: number; y: number }; stepOn(side: 'from' | 'town'): boolean; field(tiles?: number): { x: number; y: number } | null;
} };
const wg = {
  cast: (p: Page) => p.evaluate(() => (window as unknown as W).__tdWaygate.cast()),
  read: (p: Page) => p.evaluate(() => (window as unknown as W).__tdWaygate.read()),
  where: (p: Page) => p.evaluate(() => (window as unknown as W).__tdWaygate.where()),
  gate: (p: Page) => p.evaluate(() => (window as unknown as W).__tdWaygate.gate()),
  stepOff: (p: Page, px = 24, dx = 0) => p.evaluate(([n, d]) => (window as unknown as W).__tdWaygate.stepOff(n, d), [px, dx] as const),
  stepOn: (p: Page, side: 'from' | 'town') => p.evaluate(s => (window as unknown as W).__tdWaygate.stepOn(s), side),
  field: (p: Page) => p.evaluate(() => (window as unknown as W).__tdWaygate.field(6)),
};

async function enter(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  const base = ledger({}) as { records: unknown[]; hlc: number };
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-inventory': { ...base, records: [...base.records, ...ITEMS], hlc: base.hlc + 200 },
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Ilsa', vocation: 'thornstrider', tree: { spent: {}, free: ['waygate'], at: 1 } },
    ...extra,
  });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  await page.waitForTimeout(500);
}

/** A clip round the Keeper (the camera keeps him in the middle). */
async function keeperClip(page: Page, half = 110): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  return { x: Math.max(0, cx - half), y: Math.max(0, cy - half - 20), width: half * 2, height: half * 2 };
}

/** Pick a satchel cell, read its pinned card's kind line, and press Equip. */
async function wear(page: Page, name: string, kind: RegExp): Promise<void> {
  const cell = page.locator(`button.pocket[aria-label^="${name}"]`).first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await cell.click();
  const card = page.locator('.d2tip--pinned');
  await expect(card).toBeVisible();
  await expect(card).toContainText(kind);
  await card.locator('.d2tip__actions button.wear').first().click();
}

test.describe('hands and portals', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a Thornstrider: the kit bow shuts the off-hand; a two-handed longbow keeps it shut; a crossbow and a quiver', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enter(page);
    await page.keyboard.press('i');
    const off = page.locator('button.well[data-slot="off-hand"]'), weapon = page.locator('button.well[data-slot="weapon"]');
    await expect(off).toBeVisible({ timeout: 10000 });
    // Nothing worn: the hunting bow in his hands takes both.
    await expect(off).toHaveAttribute('data-blocked', '1');
    await expect(off).toHaveAttribute('aria-label', /hunting bow takes both hands/);

    // The two-handed longbow: the card says so, and the off-hand stays shut — now by the longbow.
    await wear(page, 'Meridian Longbow', /Two-handed bow/);
    await expect(weapon).toHaveClass(/filled/);
    await expect(weapon).toHaveAttribute('aria-label', /Meridian Longbow/);
    await expect(off).toHaveAttribute('data-blocked', '1');
    await expect(off).toHaveAttribute('aria-label', /Both hands hold Meridian Longbow/);
    // The off-hand well's card says why.
    await off.click();
    await expect(page.locator('.d2tip--pinned')).toContainText('Both hands hold Meridian Longbow');
    await page.locator('.d2tip--pinned .d2tip__close').click();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(600);
    const wells = (await page.locator('.wells').first().boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/gear-offhand-blocked.jpg`, type: 'jpeg', quality: 85,
      clip: { x: wells.x - 8, y: wells.y - 8, width: wells.width + 16, height: wells.height + 16 } });
    await page.keyboard.press('i');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/gear-bow-2h.jpg`, type: 'jpeg', quality: 85, clip: await keeperClip(page) });

    // A one-handed crossbow frees the off-hand; the quiver goes on beside it.
    await page.keyboard.press('i');
    await wear(page, 'Canopy Warden\'s Crossbow', /One-handed crossbow/);
    await expect(weapon).toHaveAttribute('aria-label', /Crossbow/);
    await expect(off).not.toHaveAttribute('data-blocked', '1');
    await wear(page, 'Canopy Warden\'s Quiver', /Off-hand|Quiver/);
    await expect(off).toHaveClass(/filled/);
    await expect(off).toHaveAttribute('aria-label', /Quiver/);
    // The longbow went back to the satchel when the crossbow came on.
    await expect(page.locator('button.pocket[aria-label^="Meridian Longbow"]')).toHaveCount(1);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/gear-crossbow-quiver-book.jpg`, type: 'jpeg', quality: 85,
      clip: { x: wells.x - 8, y: wells.y - 8, width: wells.width + 16, height: wells.height + 16 } });
    await page.keyboard.press('i');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/gear-crossbow-quiver.jpg`, type: 'jpeg', quality: 85, clip: await keeperClip(page) });

    // And back: wearing the longbow again sends the quiver to the satchel (two hands).
    await page.keyboard.press('i');
    await wear(page, 'Meridian Longbow', /Two-handed bow/);
    await expect(off).toHaveAttribute('data-blocked', '1');
    await expect(page.locator('button.pocket[aria-label^="Canopy Warden\'s Quiver"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('the Waygate: cast in the field, come out by the hearth, step back to the exact spot', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enter(page);
    // Out of town, on open ground.
    expect(await wg.field(page)).not.toBeNull();
    await page.waitForTimeout(300);
    const start = await wg.where(page);
    expect(start.inTown).toBe(false);
    expect(start.level).toBe('surface');

    // The real spell: its words over his head, a portal where he stands.
    expect(await wg.cast(page)).toBeNull();
    await expect(canvas(page)).toHaveAttribute('data-cant', /ul hesk vesh/, { timeout: 4000 });
    await expect(canvas(page)).toHaveAttribute('data-waygate', 'open');
    const g = (await wg.gate(page))!;
    expect(g.from.x).toBe(start.x);
    expect(g.from.y).toBe(start.y);
    expect(g.left).toBeGreaterThan(290);
    // Standing on it as it opens does not take him: step off, look at it.
    await wg.stepOff(page, 6, 26);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/gear-portal-open.jpg`, type: 'jpeg', quality: 85, clip: await keeperClip(page, 120) });

    // Step in: out by the nearest hearth, beside the portal's twin.
    expect(await wg.stepOn(page, 'from')).toBe(true);
    await expect(canvas(page)).toHaveAttribute('data-waygate-trips', '1', { timeout: 5000 });
    await expect(canvas(page)).toHaveAttribute('data-waygate-at', 'town');
    const there = await wg.where(page);
    expect(Math.hypot(there.x - g.town.x, there.y - g.town.y)).toBeLessThan(40);
    // No portal opens inside a town (a scroll read here is refused the same way, and kept).
    expect(await wg.read(page)).toBe('waytown');
    // A step aside, to see the twin standing by the hearth.
    await wg.stepOff(page, 4, 26);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/gear-portal-town.jpg`, type: 'jpeg', quality: 85, clip: await keeperClip(page, 130) });

    // Back through: the exact spot, and the pair closes.
    expect(await wg.stepOn(page, 'town')).toBe(true);
    await expect(canvas(page)).toHaveAttribute('data-waygate-trips', '2', { timeout: 5000 });
    await expect(canvas(page)).toHaveAttribute('data-waygate', '');
    const back = await wg.where(page);
    expect(back.continent).toBe(start.continent);
    expect(back.level).toBe(start.level);
    expect(back.x).toBe(start.x);
    expect(back.y).toBe(start.y);
    expect(await wg.gate(page)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('a Waygate Scroll: read from the satchel in the field, it opens the portal and is spent', async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const base = ledger({ 'waygate-scroll': 2 }) as { records: unknown[]; hlc: number };
    await enter(page, { 'godforge-inventory': { ...base, records: [...base.records, ...ITEMS], hlc: base.hlc + 200 } });
    expect(await wg.field(page)).not.toBeNull();
    await page.keyboard.press('i');
    const cell = page.locator('button.pocket[aria-label^="Waygate Scroll"]').first();
    await expect(cell).toBeVisible({ timeout: 10000 });
    await cell.click();
    const card = page.locator('.d2tip--pinned');
    await expect(card).toContainText('a Waygate opens where you stand');
    await card.locator('button[data-read-scroll]').click();
    await expect(canvas(page)).toHaveAttribute('data-waygate', 'open', { timeout: 5000 });
    await expect.poll(() => stackQty(page, 'waygate-scroll'), { timeout: 5000 }).toBe(1);
  });
});
