/**
 * play-realm-delves.spec.ts — the Root Deeps and the Prism Mines (docs/handoff/realm-delves.md),
 * played at 1280×800 (keyboard and mouse) and 390×844 (touch-first phone), each realm:
 *
 *   find its Rift Gate in the Ember Delve (Glim notices it), attune it with the
 *   realm's sigil, step through into the realm's own Delve, live its broken rule,
 *   mine its ore, and walk back out through the gate to stand beside it.
 *
 *   - The Root Deeps: the rootglass outcrop beside the arrival; the hole it leaves
 *     grows back (verdant.ts) while the Keeper waits beside it.
 *   - The Prism Mines: the prismite outcrop; then the Sunwell Crossing: turn the
 *     mirror on the pit's lip (E) and walk across the pit on the bridge of light
 *     the beam lays (luminous.ts), never dropping into it.
 *
 * The save is built with the game's own pure code, as play-rift-gates.spec does: a
 * camp beside the gate (the sector's diff, run-encoded, in the slot the Delve save
 * reads first). Screenshots go to output/realm-delves/ when REALM_SHOTS is set.
 */
import { expect, test, type Page } from '@playwright/test';
import { activity, DelveFixture, DELVE_SEED, SPEC, xpForLevel } from './play-delve-fixtures';
import { canvas, ERA, focusWorld, ledger, messageLine, openPlay, playerX, seed, stackQty, walkTo, type Blobs, SHAFT_X } from './play-helpers';
import { WARDEN_FLAG, nodeIndex } from '../src/app/play/engine/terrain';
import { latticePlans, sectorContext } from '../src/app/play/engine/sector-gen';
import { CORE_GATE, CORE_SEAM } from '../src/app/play/engine/realm-kit';
import { CROSSING } from '../src/app/play/engine/luminous-gen';
import { encodeRuns } from '../src/app/shared/delve/delve-region.model';
import { UNSEALED_FLAG } from '../src/app/shared/delve/underhearth.model';
import { RIFT_GATES } from '../src/app/shared/delve/rift-gates.model';

const SHOTS = process.env['REALM_SHOTS'];
const CELL = 32;
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/realm-delves/${name}.png` });
}
const attr = async (page: Page, name: string) => (await canvas(page).getAttribute(name)) ?? '';

type Realm = 'verdant' | 'luminous';
/** A realm's gate chamber for the fixture's seed (the generator's own plan). */
function gatePlan(realm: Realm) {
  return latticePlans(sectorContext(SPEC, DELVE_SEED), RIFT_GATES[realm].place.cell).find(p => p.kind === 'rift-gate')!;
}
/** The Delve save: the core (the seal open), and a camp east of the gate, on the chamber's frame floor. */
function delveWithCampAtGate(realm: Realm): Blobs {
  const plan = gatePlan(realm);
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

/** Camp at the realm's gate, Glim notices it, attune with the sigil, step through. */
async function intoRealm(page: Page, realm: Realm, touch: boolean, label: string): Promise<void> {
  const g = RIFT_GATES[realm];
  await seed(page, {
    ...delveWithCampAtGate(realm),
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
  await expect(canvas(page)).toHaveAttribute('data-gate', new RegExp(`^${realm}:`), { timeout: 10_000 });
  await expect(messageLine(page)).toContainText(new RegExp(g.name), { timeout: 6000 });
  await shot(page, `${label}-${realm}-gate-found`);
  await standAt(page, gatePlan(realm).col + 4);
  await use(page, touch);
  await expect(canvas(page)).toHaveAttribute('data-area', realm === 'verdant' ? 'The Root Deeps' : 'The Prism Mines', { timeout: 8000 });
  await expect(canvas(page)).toHaveAttribute('data-realm', `${realm}:open`);
  expect(await stackQty(page, g.sigil)).toBe(0);
  await page.waitForTimeout(800);
  await shot(page, `${label}-${realm}-arrive`);
}
/** Face the core's outcrop from the west and swing until its ore is in the satchel. */
async function mineSeam(page: Page, ore: string): Promise<void> {
  const before = await stackQty(page, ore);
  await standAt(page, CORE_SEAM.col - 1);
  await tap(page, 'd', 40);
  await focusWorld(page);
  await page.keyboard.down('j');
  await expect.poll(() => stackQty(page, ore), { timeout: 30_000 }).toBeGreaterThan(before);
  await page.keyboard.up('j');
}
/** Back to the return gate and out; beside the gate it came in by. */
async function walkBackOut(page: Page, realm: Realm, touch: boolean, label: string): Promise<void> {
  await expect(async () => {
    await standAt(page, CORE_GATE.col + 1);
    await use(page, touch);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 3000 });
  }).toPass({ timeout: 40_000 });
  await expect(canvas(page)).toHaveAttribute('data-realm', '');
  const x = await playerX(page);
  expect(Math.abs(x - (gatePlan(realm).col + 6.5) * CELL)).toBeLessThan(CELL * 2);
  await page.waitForTimeout(600);
  await shot(page, `${label}-${realm}-back-beside-gate`);
}

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`The realm Delves (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });
    test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('preferred-language', 'en')); });

    test('the Root Deeps: attune the Verdant gate, mine rootglass, watch the hole grow back, walk back out', async ({ page }) => {
      test.setTimeout(180_000);
      await intoRealm(page, 'verdant', touch, label);
      await mineSeam(page, 'rootglass');
      await page.waitForTimeout(400);
      await shot(page, `${label}-verdant-dug`);
      // The broken rule: the hole grows back (roots reach in, then wood), while the Keeper waits beside it.
      await expect(canvas(page)).toHaveAttribute('data-realm-rule', /^[1-9]\d*\/0$/, { timeout: 5000 });
      await page.waitForTimeout(14_000);
      await shot(page, `${label}-verdant-roots-reaching`);
      await expect(canvas(page)).toHaveAttribute('data-realm-rule', /^0\/[1-9]/, { timeout: 15_000 });
      await shot(page, `${label}-verdant-grown-back`);
      await walkBackOut(page, 'verdant', touch, label);
    });

    test('the Prism Mines: attune the Luminous gate, mine prismite, turn the mirror and cross the pit on light, walk back out', async ({ page }) => {
      test.setTimeout(180_000);
      await intoRealm(page, 'luminous', touch, label);
      await mineSeam(page, 'prismite');
      // The broken rule: the crossing's sun is a ladder of light; the mirror on the lip turns it into a bridge.
      await standAt(page, CROSSING.mirror.col - 1);
      const before = Number((await attr(page, 'data-realm-rule')).split('/')[1] ?? 0);
      await shot(page, `${label}-luminous-lip`);
      await use(page, touch);
      await expect.poll(async () => Number((await attr(page, 'data-realm-rule')).split('/')[1] ?? 0), { timeout: 5000 })
        .toBeGreaterThanOrEqual(before + CROSSING.pit.w);
      await page.waitForTimeout(300);
      await shot(page, `${label}-luminous-bridge`);
      // Across, on the light: never down in the pit (its floor is two rows lower).
      await walkTo(page, (CROSSING.pit.col + CROSSING.pit.w + 1.5) * CELL, 12);
      expect(await playerX(page)).toBeGreaterThan((CROSSING.pit.col + CROSSING.pit.w) * CELL);
      await expect(canvas(page)).toHaveAttribute('data-depth', String(CROSSING.mirror.row));
      await shot(page, `${label}-luminous-across`);
      await walkTo(page, (CROSSING.mirror.col - 1.5) * CELL, 12);
      await expect(canvas(page)).toHaveAttribute('data-depth', String(CROSSING.mirror.row));
      await walkBackOut(page, 'luminous', touch, label);
    });
  });
}
