/**
 * play-underhearth.spec.ts — the Underhearth (Phase 8; docs/handoff/underhearth.md),
 * played at 1280×800 (keyboard and mouse) and 390×844 (touch-first phone):
 *
 *   1. the gate: the Banked seal in the fragment chamber's floor refuses a
 *      Keeper below Delving 15 (and says so), then opens to a Pickaxe IV, and
 *      the Keeper drops into the Underhearth;
 *   2. Kael's rail: board the Seam Cart at the Banked Door (E), ride the line
 *      down the tunnel and over the Furnace Hall's trestles to the gantry;
 *   3. a Rift Anchor: set one down, climb home through it, and step back down
 *      from the Delve shaft's "Descend to an anchor";
 *   4. the Banked Furnace: wake it at its hearth with the Four Hammer-Marks,
 *      douse its four vents with water, strike its core, walk out of its
 *      breath, and put it out (once-per-player flag in the save).
 *
 * Saves are built with the game's own pure code: the core diff by
 * play-delve-fixtures.ts, the deep sectors' diffs by delve-region.model's own
 * encoder, filed in the cloud slot blob the Delve save reads first. Screenshots
 * go to output/underhearth/ when UNDERHEARTH_SHOTS is set (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { activity, DelveFixture, withSectors, xpForLevel } from './play-delve-fixtures';
import { canvas, ERA, focusWorld, ledger, messageLine, openPlay, playerX, seed, stackQty as stackQtyOf, walkTo, type Blobs, SHAFT_X } from './play-helpers';
import { WARDEN_FLAG } from '../src/app/play/engine/terrain';
import { FURNACE, GANTRY, LANDING } from '../src/app/play/engine/underhearth-gen';
import { FURNACE_FLAG, UNSEALED_FLAG } from '../src/app/shared/delve/underhearth.model';

const SHOTS = process.env['UNDERHEARTH_SHOTS'];
const CELL = 32;
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/underhearth/${name}.png` });
}
const depth = async (page: Page) => Number(await canvas(page).getAttribute('data-depth'));
const attr = async (page: Page, name: string) => (await canvas(page).getAttribute(name)) ?? '';

/** A tool or a weapon instance in the satchel (or worn). */
function gear(id: string, definitionId: string, name: string, i: number, extra: Record<string, unknown> = {}): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'epic', soulbound: true,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: {}, sellValue: 0, econ: 3, location: { kind: 'bag' }, ...extra,
  };
}
/** Stacks, plus instances (tools, a weapon). */
function satchel(stacks: Record<string, number>, items: unknown[] = []): Blobs {
  const base = ledger(stacks) as { records: unknown[]; hlc: number };
  return { 'godforge-realm-era': String(ERA), 'godforge-inventory': { ...base, records: [...base.records, ...items], hlc: base.hlc + 200 } };
}
const PICK_IV = gear('e2e-pick-4', 'pickaxe-4', 'Pickaxe IV', 1);
/** Strike 5 (the 60 damage ceiling) and a little ward: a Keeper geared for the Underhearth. */
const BLADE = gear('e2e-blade', 'eclipse-longblade', 'Eclipse Longblade', 2, { category: 'equipment', tags: ['equipment', 'weapon'], type: 'artifact', soulbound: false, stats: { strikePower: 5, ward: 15 }, location: { kind: 'equipped', slotId: 'weapon' } });

async function descend(page: Page): Promise<void> {
  await openPlay(page);
  const button = page.getByRole('button', { name: /Descend to your camp/ });
  // The Keeper can settle by the Material Vendor next door: step back onto the shaft until it offers the camp.
  await expect(async () => {
    await walkTo(page, SHAFT_X, 12);
    await expect(button).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 40_000 });
  await button.click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await page.waitForTimeout(1200);
  await focusWorld(page);
}
/** Press a key for a beat. */
async function tap(page: Page, key: string, ms = 80): Promise<void> {
  await focusWorld(page);
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
}
/** Choose a hotbar slot by its name (a click on desktop, a tap on the phone). */
async function choose(page: Page, touch: boolean, name: string): Promise<void> {
  const slot = page.locator(`.hotbar .hot[title="${name}"]`);
  await expect(slot).toBeVisible();
  if (touch) await slot.tap(); else await slot.click();
  await focusWorld(page);
}
/** E: the prompt's button on a phone, the key on desktop. */
async function use(page: Page, touch: boolean): Promise<void> {
  if (touch) await page.locator('.prompt button', { hasText: /Interact|Interactuar/ }).first().tap();
  else await tap(page, 'e');
}

const LEVELS = { mining: xpForLevel(45), exploration: xpForLevel(15), woodcutting: xpForLevel(1) };

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`The Underhearth (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });

    test('the Banked seal refuses below Delving 15, then opens to a Pickaxe IV and drops the Keeper into the Underhearth', async ({ page }) => {
      test.setTimeout(120_000);
      const core = new DelveFixture().camp(96, 50);
      core.claimed = [WARDEN_FLAG, UNSEALED_FLAG];
      await seed(page, { ...core.blobs(), ...satchel({}, [PICK_IV]), ...activity({ ...LEVELS, exploration: xpForLevel(14) }) });
      await descend(page);
      await walkTo(page, 100 * CELL, 8);
      await focusWorld(page);
      await page.keyboard.down('s'); await page.keyboard.down('j');
      await expect(messageLine(page)).toContainText(/Delving 15/, { timeout: 8000 });
      await page.keyboard.up('j'); await page.keyboard.up('s');
      await shot(page, `${label}-gate-refused`);

      // Delving 15: the seal opens and the Keeper falls through into the Underhearth.
      await seed(page, { ...core.blobs(), ...satchel({}, [PICK_IV]), ...activity(LEVELS) });
      await descend(page);
      await walkTo(page, 100 * CELL, 8);
      await focusWorld(page);
      await page.keyboard.down('s'); await page.keyboard.down('j');
      await expect.poll(() => depth(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(56);
      await page.keyboard.up('j'); await page.keyboard.up('s');
      await expect(canvas(page)).toHaveAttribute('data-biome', 'The Underhearth');
      await page.waitForTimeout(600);
      await shot(page, `${label}-banked-door`);
    });

    test('Kael\'s rail: board the Seam Cart at the Banked Door and ride it down over the Furnace Hall to the gantry', async ({ page }) => {
      test.setTimeout(120_000);
      const core = new DelveFixture();
      core.claimed = [WARDEN_FLAG, UNSEALED_FLAG, 'underhearth-reached'];
      await seed(page, { ...withSectors(core, [{ col: 107, row: 64, id: 'camp' }]), ...satchel({ 'seam-cart': 1 }), ...activity(LEVELS) });
      await descend(page);
      expect(await depth(page)).toBe(LANDING.row + LANDING.h);
      await walkTo(page, 100.5 * CELL, 10);
      await expect(page.locator('.prompt strong')).toContainText(/Ride the rail|Montar en el riel/);
      await use(page, touch);
      await expect(canvas(page)).toHaveAttribute('data-riding', 'true');
      await focusWorld(page);
      await page.keyboard.down('a');
      await expect.poll(() => depth(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(78);
      await shot(page, `${label}-rail-trestles`);
      await expect.poll(() => depth(page), { timeout: 30_000 }).toBe(GANTRY.row);
      await page.keyboard.up('a');
      await expect.poll(async () => Math.floor(await playerX(page) / CELL), { timeout: 15_000 }).toBe(GANTRY.col);
      await expect(canvas(page)).toHaveAttribute('data-riding', 'true');
      await shot(page, `${label}-rail-gantry`);
      // Jump leaps out of the cart.
      await tap(page, 'w');
      await expect(canvas(page)).toHaveAttribute('data-riding', 'false');
    });

    test('a Rift Anchor: set one down, climb home through it, and step back down from the shaft', async ({ page }) => {
      test.setTimeout(120_000);
      const core = new DelveFixture();
      core.claimed = [WARDEN_FLAG, UNSEALED_FLAG, 'underhearth-reached'];
      await seed(page, { ...withSectors(core, [{ col: 107, row: 64, id: 'camp' }]), ...satchel({ 'rift-anchor': 1 }), ...activity(LEVELS) });
      await descend(page);
      await walkTo(page, 109.3 * CELL, 6);
      await tap(page, 'd', 40);
      await choose(page, touch, 'Rift Anchor');
      if (touch) await page.locator('.tb--use.tb--phone').tap(); else await tap(page, 'b');
      await expect(messageLine(page)).toContainText(/Rift Anchor placed|Colocado/);
      await page.waitForTimeout(300);
      await use(page, touch);
      const sheet = page.locator('.anchor-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('.anchor-row')).toHaveCount(2);
      await shot(page, `${label}-anchor-sheet`);
      await sheet.locator('.anchor-row--home').click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
      await walkTo(page, SHAFT_X, 30);
      const down = page.getByRole('button', { name: /Descend to an anchor/ });
      await expect(down).toBeVisible();
      await down.click();
      await expect(sheet).toBeVisible();
      await sheet.locator('.anchor-row').first().click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
      await expect.poll(() => depth(page)).toBe(LANDING.row + LANDING.h);
      expect(Math.abs(Math.floor(await playerX(page) / CELL) - 110)).toBeLessThanOrEqual(1);
    });

    test('the Banked Furnace: wake it with the Four Hammer-Marks, douse its vents, strike its core, and put it out', async ({ page }) => {
      test.setTimeout(420_000);
      const core = new DelveFixture();
      core.claimed = [WARDEN_FLAG, UNSEALED_FLAG, 'underhearth-reached', 'hammer-mark-1', 'hammer-mark-2', 'hammer-mark-3', 'hammer-mark-4'];
      await seed(page, {
        ...withSectors(core, [{ col: 40, row: FURNACE.floorRow - 1, id: 'camp' }]),
        ...satchel({ 'four-hammer-marks': 1, 'seam-bucket-water': 10 }, [BLADE]),
        ...activity(LEVELS),
      });
      await descend(page);
      const mouth = (FURNACE.col + .5) * CELL;
      // Settle at the hearth (the walk can coast a step past its reach): retry until it offers to wake.
      await expect(async () => {
        await walkTo(page, mouth, 6);
        await expect(page.locator('.prompt strong')).toContainText(/Wake the Banked Furnace|Despertar/, { timeout: 3000 });
      }).toPass({ timeout: 40_000 });
      await use(page, touch);
      await expect.poll(() => attr(page, 'data-furnace')).toMatch(/^banked:0000/);
      await shot(page, `${label}-furnace-wakes`);
      await choose(page, touch, 'Bucket of water');

      const vents = [...FURNACE.vents];
      const state = async () => { const [phase, bits, breathing] = (await attr(page, 'data-furnace')).split(':'); return { phase, bits: bits ?? '', breathing: breathing === '1' }; };
      // Pour on vent n: stand in the column west of it, facing east, and press B (the bucket pours ahead).
      const douse = async (n: number): Promise<void> => {
        const v = vents[n];
        await walkTo(page, (v - 3) * CELL, 20);
        await walkTo(page, (v - 1) * CELL + 9, 5);
        await tap(page, 'd', 30);
        if ((await state()).bits[n] === '1') return;
        if (touch) await page.locator('.tb--use.tb--phone').tap(); else await tap(page, 'b');
        await page.waitForTimeout(250);
      };
      const deadline = Date.now() + 360_000;
      let hits = 0;
      // J is held the whole fight: the Keeper swings at whatever is in reach (the spilled embers, the open core).
      await focusWorld(page); await page.keyboard.down('j');
      while (Date.now() < deadline) {
        const s = await state();
        if (!s.phase) break; // it is out
        // It breathes in: walk out of its reach on whichever side we are (the fight's one rule of feet).
        if (s.breathing) {
          // (J stays held: whatever ember follows us out gets swung at.)
          const x = await playerX(page);
          await walkTo(page, x < mouth ? mouth - 420 : mouth + 420, 40);
          continue;
        }
        if (s.phase === 'banked') {
          const n = s.bits.indexOf('0');
          if (n >= 0) await douse(n);
          continue;
        }
        // Open: strike the core from just outside the mouth; step back while it breathes in.

        await walkTo(page, mouth - 46, 8);
        await tap(page, 'd', 20);
        await page.waitForTimeout(1400);
        hits++;
        if (hits === 3) await shot(page, `${label}-furnace-open`);
      }
      await page.keyboard.up('j');
      await expect.poll(() => attr(page, 'data-furnace'), { timeout: 5000 }).toBe('');
      // What it banked spills out where it stood (picked up on the way past), and the fall is saved for good.
      await walkTo(page, mouth + 110, 20); await walkTo(page, mouth - 110, 20);
      await expect.poll(async () => (await stackQtyOf(page, 'emberheart-ore')), { timeout: 8000 }).toBeGreaterThan(0);
      await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('godforge-world') ?? '{}'))).claimed ?? [], { timeout: 5000 }).toContain(FURNACE_FLAG);
      await shot(page, `${label}-furnace-out`);
    });
  });
}
