/**
 * play-celestial-delve.spec.ts — the Orrery Wells (docs/handoff/celestial-delve.md), played at
 * 1280×800 (keyboard and mouse) and 390×844 (touch-first phone):
 *
 *   find the Celestial Rift Gate in the Magma Halls (Glim notices it), attune it with
 *   the Celestial Sigil, step through, mine the starsteel outcrop, then live the
 *   broken rule in the Turning Room: walk in and drop into its pit (its rings are
 *   blue), turn the pit's ring (E) and fall up to the tunnel's ceiling, walk the
 *   ceiling east out of the field and land on the far floor; walk back over the
 *   ceiling and out through the gate to stand beside it.
 *
 * The host's canvas reports the Keeper's down (`data-gravity`, what a follower such
 * as a pet hangs from) and `data-realm-rule` = "<down>/<flips>/<ephemeris>".
 * The save is built with the game's own pure code, as play-realm-delves.spec does.
 * Screenshots go to output/celestial-delve/ when REALM_SHOTS is set.
 */
import { expect, test, type Page } from '@playwright/test';
import { activity, DelveFixture, DELVE_SEED, SPEC, xpForLevel } from './play-delve-fixtures';
import { canvas, ERA, focusWorld, ledger, messageLine, openPlay, playerX, seed, stackQty, walkTo, type Blobs, SHAFT_X } from './play-helpers';
import { WARDEN_FLAG, nodeIndex } from '../src/app/play/engine/terrain';
import { latticePlans, sectorContext } from '../src/app/play/engine/sector-gen';
import { CORE_GATE, CORE_SEAM } from '../src/app/play/engine/realm-kit';
import { TURNING_ROOM } from '../src/app/play/engine/celestial-gen';
import { encodeRuns } from '../src/app/shared/delve/delve-region.model';
import { UNSEALED_FLAG } from '../src/app/shared/delve/underhearth.model';
import { RIFT_GATES } from '../src/app/shared/delve/rift-gates.model';

const SHOTS = process.env['REALM_SHOTS'];
const CELL = 32;
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/celestial-delve/${name}.png` });
}
const attr = async (page: Page, name: string) => (await canvas(page).getAttribute(name)) ?? '';

function gatePlan() {
  return latticePlans(sectorContext(SPEC, DELVE_SEED), RIFT_GATES.celestial.place.cell).find(p => p.kind === 'rift-gate')!;
}
/** The Delve save: the core (the seal open), and a camp east of the gate, on the chamber's frame floor. */
function delveWithCampAtGate(): Blobs {
  const plan = gatePlan();
  const camp = { col: plan.col + 7, row: plan.row + 4 };
  const core = new DelveFixture();
  core.claimed = [WARDEN_FLAG, UNSEALED_FLAG, 'underhearth-reached'];
  const sx = Math.floor(camp.col / 32), sy = Math.floor(camp.row / 32);
  const local = (camp.row - sy * 32) * 32 + (camp.col - sx * 32);
  const now = Date.now();
  return {
    ...core.blobs(),
    'godforge-delve-r0': {
      v: 1, seed: DELVE_SEED, rx: Math.floor(sx / 8), ry: Math.floor(sy / 8), t: now,
      sectors: { [`${sx},${sy}`]: { g: 1, t: now, c: encodeRuns(new Map([[local, nodeIndex('camp')]])) } },
    },
  };
}
function gear(id: string, definitionId: string, name: string, i: number): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'epic', soulbound: true,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: {}, sellValue: 0, econ: 3, location: { kind: 'bag' },
  };
}
function satchel(stacks: Record<string, number>, items: unknown[] = []): Blobs {
  const base = ledger(stacks) as { records: unknown[]; hlc: number };
  return { 'godforge-realm-era': String(ERA), 'godforge-inventory': { ...base, records: [...base.records, ...items], hlc: base.hlc + 200 } };
}
async function tap(page: Page, key: string, ms = 80): Promise<void> {
  await focusWorld(page);
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
}
/** E: the prompt's button on a phone, the key on desktop. */
async function use(page: Page, touch: boolean): Promise<void> {
  if (touch) await page.locator('.prompt button', { hasText: /Interact|Interactuar/ }).first().tap();
  else await tap(page, 'e');
}
async function standAt(page: Page, col: number): Promise<void> {
  await walkTo(page, (col + .5) * CELL, 8);
  await page.waitForTimeout(300);
}

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`The Orrery Wells (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });
    test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('preferred-language', 'en')); });

    test('attune the Celestial gate, mine starsteel, fall into the Turning Room, turn the ring, walk the ceiling across, walk back out', async ({ page }) => {
      test.setTimeout(180_000);
      const g = RIFT_GATES.celestial;
      await seed(page, {
        ...delveWithCampAtGate(),
        ...satchel({ [g.sigil]: 1, torch: 4 }, [gear('e2e-pick-4', 'pickaxe-4', 'Pickaxe IV', 1)]),
        ...activity({ mining: xpForLevel(60), exploration: xpForLevel(g.delving) }),
        'preferred-language': 'en',
      });
      await openPlay(page);
      const button = page.getByRole('button', { name: /Descend to your camp/ });
      await expect(async () => {
        await walkTo(page, SHAFT_X, 12);
        await expect(button).toBeVisible({ timeout: 4000 });
      }).toPass({ timeout: 40_000 });
      await button.click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
      await page.waitForTimeout(1200);
      // Find the gate: Glim notices it.
      await expect(canvas(page)).toHaveAttribute('data-gate', /^celestial:/, { timeout: 10_000 });
      // Glim notices it (a Pim bounty for reaching the sector can take the line in the same second: One World counts the sector too).
      await expect(messageLine(page)).toContainText(/Celestial|Bounty done/, { timeout: 6000 });
      await shot(page, `${label}-gate-found`);
      // Attune with the sigil, and step through.
      await standAt(page, gatePlan().col + 4);
      await use(page, touch);
      await expect(canvas(page)).toHaveAttribute('data-area', 'The Orrery Wells', { timeout: 8000 });
      await expect(canvas(page)).toHaveAttribute('data-realm', 'celestial:open');
      await expect(canvas(page)).toHaveAttribute('data-gravity', 'down');
      expect(await stackQty(page, g.sigil)).toBe(0);
      await page.waitForTimeout(800);
      await shot(page, `${label}-arrive`);

      // Mine the starsteel outcrop east of the arrival.
      const before = await stackQty(page, 'starsteel');
      await standAt(page, CORE_SEAM.col - 1);
      await tap(page, 'd', 40);
      await focusWorld(page);
      await page.keyboard.down('j');
      await expect.poll(() => stackQty(page, 'starsteel'), { timeout: 30_000 }).toBeGreaterThan(before);
      await page.keyboard.up('j');

      // The Turning Room: its rings are blue, so walking in drops the Keeper into the pit (no harm done).
      const T = TURNING_ROOM;
      await walkTo(page, (T.pit.col + 2.5) * CELL, 12);
      await expect(canvas(page)).toHaveAttribute('data-depth', String(T.pit.row + T.pit.h), { timeout: 5000 });
      await expect(canvas(page)).toHaveAttribute('data-gravity', 'down');
      await shot(page, `${label}-in-the-pit`);
      // The pit's ring: E turns every ring of the field; the Keeper falls up to the tunnel's ceiling.
      await expect(async () => {
        await standAt(page, T.pitRing.col);
        await use(page, touch);
        await expect(canvas(page)).toHaveAttribute('data-gravity', 'up', { timeout: 2000 });
      }).toPass({ timeout: 30_000 });
      await expect(canvas(page)).toHaveAttribute('data-realm-rule', /^-1\/[1-9]\d*\//);
      await page.waitForTimeout(900);
      await shot(page, `${label}-on-the-ceiling`);
      // Walk the ceiling east out of the field: the ordinary down comes back, on the floor past the pit.
      await walkTo(page, (T.field.col + T.field.w + 1.5) * CELL, 12);
      await expect(canvas(page)).toHaveAttribute('data-gravity', 'down', { timeout: 4000 });
      await expect(canvas(page)).toHaveAttribute('data-depth', String(T.ring.row + 2), { timeout: 4000 });
      expect(await playerX(page)).toBeGreaterThan((T.pit.col + T.pit.w) * CELL);
      await shot(page, `${label}-across`);

      // Back over the ceiling, and out through the gate to stand beside it.
      await expect(async () => {
        await standAt(page, CORE_GATE.col + 1);
        await use(page, touch);
        await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 3000 });
      }).toPass({ timeout: 60_000 });
      await expect(canvas(page)).toHaveAttribute('data-realm', '');
      await expect(canvas(page)).toHaveAttribute('data-gravity', 'down');
      const x = await playerX(page);
      expect(Math.abs(x - (gatePlan().col + 6.5) * CELL)).toBeLessThan(CELL * 2);
      expect(await attr(page, 'data-area')).toBe('Ember Delve');
      await page.waitForTimeout(600);
      await shot(page, `${label}-back-beside-gate`);
    });
  });
}
