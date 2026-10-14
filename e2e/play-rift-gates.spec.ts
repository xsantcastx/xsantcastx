/**
 * play-rift-gates.spec.ts — the Rift Gates and the Ink Deeps (docs/handoff/rift-gates.md),
 * played at 1280×800 (keyboard and mouse) and 390×844 (touch-first phone):
 *
 *   find the Umbral Rift Gate in the Underhearth (Glim notices it), attune it
 *   with an Umbral Sigil, step through into the Ink Deeps (the Umbral's
 *   underside: its own world, at low tide), mine the inkstone seam in the Gate
 *   Hollow's floor (an ink ore into the satchel), and walk back out through the
 *   gate to stand beside it in the Ember Delve.
 *
 * The save is built with the game's own pure code: a camp beside the gate (the
 * deep sector's diff, encoded by delve-region.model's run encoder, filed in the
 * cloud slot the Delve save reads first), so "Descend to your camp" lands the
 * Keeper at the gate. Screenshots go to output/rift-gates/ when RIFT_SHOTS is set.
 */
import { expect, test, type Page } from '@playwright/test';
import { activity, DelveFixture, DELVE_SEED, SPEC, xpForLevel } from './play-delve-fixtures';
import { canvas, ERA, focusWorld, ledger, messageLine, openPlay, playerX, seed, stackQty, walkTo, type Blobs } from './play-helpers';
import { WARDEN_FLAG, nodeIndex } from '../src/app/play/engine/terrain';
import { sectorContext } from '../src/app/play/engine/sector-gen';
import { deepPlans } from '../src/app/play/engine/underhearth-gen';
import { GATE_HOLLOW, INK_SEAM, RETURN_GATE } from '../src/app/play/engine/realm-gen';
import { encodeRuns } from '../src/app/shared/delve/delve-region.model';
import { UNSEALED_FLAG } from '../src/app/shared/delve/underhearth.model';
import { RIFT_GATES } from '../src/app/shared/delve/rift-gates.model';

const SHOTS = process.env['RIFT_SHOTS'];
const CELL = 32;
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/rift-gates/${name}.png` });
}
const attr = async (page: Page, name: string) => (await canvas(page).getAttribute(name)) ?? '';

/** The Umbral gate's chamber for the fixture's seed (the generator's own plan). */
const PLAN = deepPlans(sectorContext(SPEC, DELVE_SEED), RIFT_GATES.umbral.place.cell).find(p => p.kind === 'rift-gate')!;
/** The camp: east of the gate, on the chamber's frame floor. */
const CAMP = { col: PLAN.col + 7, row: PLAN.row + 4 };

/** The Delve save: the core (the seal open), and a camp beside the Umbral gate in its deep sector. */
function delveWithCampAtGate(): Blobs {
  const core = new DelveFixture();
  core.claimed = [WARDEN_FLAG, UNSEALED_FLAG, 'underhearth-reached'];
  const sx = Math.floor(CAMP.col / 32), sy = Math.floor(CAMP.row / 32);
  const local = (CAMP.row - sy * 32) * 32 + (CAMP.col - sx * 32);
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
/** Walk onto a world column's centre and settle there. */
async function standAt(page: Page, col: number): Promise<void> {
  await walkTo(page, (col + .5) * CELL, 8);
  await page.waitForTimeout(300);
}

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`The Rift Gates (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });
    test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('preferred-language', 'en')); });

    test('find the Umbral gate, attune it, step into the Ink Deeps, mine an ink ore, and walk back out', async ({ page }) => {
      test.setTimeout(150_000);
      await seed(page, {
        ...delveWithCampAtGate(),
        ...satchel({ 'umbral-sigil': 1, torch: 4 }, [gear('e2e-pick-4', 'pickaxe-4', 'Pickaxe IV', 1)]),
        ...activity({ mining: xpForLevel(50), exploration: xpForLevel(20) }),
        'preferred-language': 'en',
      });
      await openPlay(page);
      const button = page.getByRole('button', { name: /Descend to your camp/ });
      await expect(async () => {
        await walkTo(page, 590, 12);
        await expect(button).toBeVisible({ timeout: 4000 });
      }).toPass({ timeout: 40_000 });
      await button.click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
      await page.waitForTimeout(1200);

      // Glim notices the gate (its first sighting is filed once).
      await expect(canvas(page)).toHaveAttribute('data-gate', /^umbral:/, { timeout: 10_000 });
      await expect(messageLine(page)).toContainText(/Umbral/, { timeout: 6000 });
      await shot(page, `${label}-gate-found`);

      // Step onto the gate's opening and use it: the sigil attunes it, and the Keeper steps through.
      await standAt(page, PLAN.col + 4);
      await use(page, touch);
      await expect(canvas(page)).toHaveAttribute('data-area', 'The Ink Deeps', { timeout: 8000 });
      await expect(canvas(page)).toHaveAttribute('data-realm', 'umbral:low');
      expect(await stackQty(page, 'umbral-sigil')).toBe(0);
      await page.waitForTimeout(800);
      await shot(page, `${label}-ink-deeps-arrive`);

      // The inkstone outcrop in the Gate Hollow, east of the arrival: face it and swing.
      const before = await stackQty(page, 'inkstone');
      await standAt(page, INK_SEAM.col - 1);
      await tap(page, 'd', 40);
      await focusWorld(page);
      await page.keyboard.down('j');
      await expect.poll(() => stackQty(page, 'inkstone'), { timeout: 30_000 }).toBeGreaterThan(before);
      await page.keyboard.up('j');
      await page.waitForTimeout(400);
      await shot(page, `${label}-ink-ore`);

      // Back to the return gate (west along the hollow) and out.
      await expect(async () => {
        await standAt(page, RETURN_GATE.col + 1);
        await use(page, touch);
        await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 3000 });
      }).toPass({ timeout: 40_000 });
      await expect(canvas(page)).toHaveAttribute('data-realm', '');
      const x = await playerX(page);
      expect(Math.abs(x - (PLAN.col + 6.5) * CELL)).toBeLessThan(CELL * 2);
      await page.waitForTimeout(600);
      await shot(page, `${label}-back-beside-gate`);
      void GATE_HOLLOW;
    });
  });
}
