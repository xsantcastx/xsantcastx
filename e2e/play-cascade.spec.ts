/**
 * play-cascade.spec.ts — the Eclipse Cascade (the Mirror Slate's 10×10 cluster machine), auto spin,
 * and the Orrery Tumbler found in the Orrery Wells (docs/handoff/eclipse-cascade.md), at 1280×800
 * (keyboard) and 390×844 (touch).
 *
 *   1. A pinned spin with a multiplier spot pays exactly its win, once; a reload pays nothing more.
 *   2. A pinned bonus opens its free spins, and the round pays once (Skip).
 *   3. Auto spin ×10 plays ten paid spins and stops by itself; the purse is exact.
 *   4. The Orrery Tumbler: through the Celestial gate, walk to it, E — found, it opens, a pinned
 *      spin pays — and the Slate now has its app (also after a reload).
 *
 * The expected numbers come from the game's own pure model (cascade.model.ts) on the same seeds.
 * Screenshots go to output/eclipse-cascade/ (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { activity, DelveFixture, DELVE_SEED, SPEC, xpForLevel } from './play-delve-fixtures';
import { bag, blob, canvas, ERA, focusWorld, ledger, messageLine, openPlay, placePanel, purse, seed, walkTo, type Blobs } from './play-helpers';
import { ECLIPSE_CASCADE, ORRERY_TUMBLER, playCascade } from '../src/app/shared/cascade/cascade.model';
import { BUILT_REALM_MACHINES } from '../src/app/shared/cascade/realm-machines.model';
import { seededRng } from '../src/app/shared/games/seeded-rng';
import { WARDEN_FLAG, nodeIndex } from '../src/app/play/engine/terrain';
import { latticePlans, sectorContext } from '../src/app/play/engine/sector-gen';
import { encodeRuns } from '../src/app/shared/delve/delve-region.model';
import { UNSEALED_FLAG } from '../src/app/shared/delve/underhearth.model';
import { RIFT_GATES } from '../src/app/shared/delve/rift-gates.model';

const SHOTS = resolve('output/eclipse-cascade');
const START = 5_000;
const CELL = 32;
const SPOT = 'e2e-cascade-241';
const BONUS = 'e2e-cascade-402';
const SUPER = 'e2e-cascade-4526';
const TUMBLE = 'e2e-tumbler-10';

const games = (secret: string) => ({ 'godforge-games': { version: 1, secret, nonce: 0, plays: {}, totals: {} } });
function slateSave(secret: string, gold = START): Blobs {
  return { 'preferred-language': 'en', ...bag({ 'mirror-slate': 1 }), ...purse(gold), ...games(secret) };
}
async function gold(page: Page): Promise<number> {
  return ((await blob<{ gold: number }>(page, 'godforge-economy'))?.gold) ?? -1;
}
async function plays(page: Page, game?: string): Promise<number> {
  const all = (await blob<{ plays: Record<string, { game: string }> }>(page, 'godforge-games'))?.plays ?? {};
  return Object.values(all).filter(p => !game || p.game === game).length;
}
const shot = (page: Page, name: string) => page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
const machine = (page: Page, id = ECLIPSE_CASCADE.id) => placePanel(page).locator(`app-cascade .cz[data-machine="${id}"]`);

async function openSlate(page: Page, phone: boolean): Promise<void> {
  if (phone) await page.locator('.slate-btn').click();
  else { await focusWorld(page); await page.keyboard.press('KeyP'); }
  await expect(placePanel(page)).toHaveClass(/place--slate/);
}
async function openApp(page: Page, phone: boolean, game: string): Promise<void> {
  await openSlate(page, phone);
  await placePanel(page).locator(`[data-game="${game}"]`).click();
  await expect(machine(page, game)).toBeVisible({ timeout: 15000 });
  // The board sizes itself once the panel has opened.
  await page.waitForTimeout(500);
}
async function atLeast44(page: Page, selector: string): Promise<void> {
  for (const el of await placePanel(page).locator(selector).all()) {
    await expect.poll(async () => { const b = (await el.boundingBox())!; return Math.min(b.width, b.height); }, { message: selector }).toBeGreaterThanOrEqual(44);
  }
}
/** Nothing to scroll to: the Spin button and the board sit inside the viewport. */
async function onScreen(page: Page, size: { width: number; height: number }): Promise<void> {
  for (const sel of ['.cz-board', '[data-spin]', '[data-auto="open"]']) {
    const b = (await placePanel(page).locator(sel).first().boundingBox())!;
    expect(b.y + b.height, sel).toBeLessThanOrEqual(size.height + 1);
    expect(b.x + b.width, sel).toBeLessThanOrEqual(size.width + 1);
  }
}

for (const size of [{ width: 1280, height: 800, phone: false }, { width: 390, height: 844, phone: true }]) {
  test.describe(`the Eclipse Cascade at ${size.width}×${size.height}`, () => {
    test.describe.configure({ timeout: 150000 });
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.phone });
    test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

    test('a pinned cascade with a multiplier spot pays exactly once, and a reload never re-pays', async ({ page }) => {
      const expected = playCascade(ECLIPSE_CASCADE, seededRng(`${SPOT}:0`), 10);
      expect(expected.base.steps.some(s => s.wins.some(w => w.mult >= 2))).toBeTruthy();
      await seed(page, slateSave(SPOT));
      await openPlay(page);
      await openApp(page, size.phone, ECLIPSE_CASCADE.id);
      // ≤2 taps: one Spin button with its price; every control ≥44 px; nothing to scroll.
      await expect(machine(page).locator('[data-spin]')).toHaveText('Spin · 10 Gold');
      await atLeast44(page, '.cz [data-spin], .cz .gs__btn, .cz .bc__chip, .cz [data-help], .cz [data-auto="open"]');
      await onScreen(page, size);
      await shot(page, `cascade-${size.width}-ready`);

      await machine(page).locator('[data-spin]').click();
      await expect(machine(page)).toHaveAttribute('data-phase', 'spin');
      await page.waitForTimeout(1300);
      await shot(page, `cascade-${size.width}-tumble`);
      await expect(machine(page).locator('.cz-result')).toContainText(`You won ${expected.win} Gold.`, { timeout: 20000 });
      await expect(machine(page)).toHaveAttribute('data-last-win', String(expected.win));
      await expect(machine(page)).toHaveAttribute('data-window', /^[a-hWS]{100}$/);
      await expect.poll(() => gold(page)).toBe(START - 10 + expected.win);
      expect(await plays(page)).toBe(1);
      await shot(page, `cascade-${size.width}-paid`);

      // "?" opens the pay table and the odds over the board.
      await machine(page).locator('[data-help]').click();
      await expect(machine(page).locator('[data-help-sheet] .cz-pay tbody tr')).toHaveCount(8);
      await expect(machine(page).locator('[data-help-sheet]')).toContainText('94.2%');
      await shot(page, `cascade-${size.width}-help`);

      await page.reload();
      await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
      await page.waitForTimeout(800);
      expect(await gold(page)).toBe(START - 10 + expected.win);
      await openApp(page, size.phone, ECLIPSE_CASCADE.id);
      await expect(machine(page).locator('.cz-result')).toContainText(`Last spin: bet 10, won ${expected.win}.`);
      await page.waitForTimeout(800);
      expect(await gold(page)).toBe(START - 10 + expected.win);
      expect(await plays(page)).toBe(1);
    });

    test('a pinned bonus opens its free spins and pays the round once', async ({ page }) => {
      const expected = playCascade(ECLIPSE_CASCADE, seededRng(`${BONUS}:0`), 10);
      expect(expected.bonus?.kind).toBe('free');
      await seed(page, slateSave(BONUS));
      await openPlay(page);
      await openApp(page, size.phone, ECLIPSE_CASCADE.id);
      await machine(page).locator('[data-spin]').click();
      await expect(machine(page)).toHaveAttribute('data-bonus', 'free', { timeout: 15000 });
      await expect(machine(page).locator('[data-banner]')).toBeVisible();
      await shot(page, `cascade-${size.width}-free-spins`);
      await page.waitForTimeout(2500);
      await shot(page, `cascade-${size.width}-free-spin-running`);
      await machine(page).locator('[data-skip]').click();
      await expect(machine(page).locator('.cz-result')).toContainText(`You won ${expected.win.toLocaleString('en-US')} Gold.`);
      await expect(machine(page).locator('[data-spins]')).toContainText(`${expected.bonus!.spins.length}/${expected.bonus!.spins.length}`);
      await expect.poll(() => gold(page)).toBe(START - 10 + expected.win);
      if (expected.win >= 100) await expect(machine(page).locator('.wc__banner')).toBeVisible();
      await shot(page, `cascade-${size.width}-free-paid`);
    });

    test('auto spin ×10 plays ten paid spins, stops by itself, and the purse is exact', async ({ page }) => {
      // A save whose first ten spins open no round (stop-on-bonus stays on by default).
      let secret = '';
      let total = 0;
      for (let k = 0; !secret; k++) {
        const outs = Array.from({ length: 10 }, (_, n) => playCascade(ECLIPSE_CASCADE, seededRng(`e2e-auto-${k}:${n}`), 10));
        if (outs.every(o => !o.bonus && o.win < 100)) { secret = `e2e-auto-${k}`; total = outs.reduce((s, o) => s + o.win, 0); }
      }
      await seed(page, slateSave(secret));
      await openPlay(page);
      await openApp(page, size.phone, ECLIPSE_CASCADE.id);
      await machine(page).locator('[data-auto="open"]').click();
      await expect(machine(page).locator('.as__sheet')).toBeVisible();
      await shot(page, `cascade-${size.width}-auto-sheet`);
      await machine(page).locator('[data-count="10"]').click();
      await expect(machine(page).locator('[data-auto="stop"]')).toBeVisible();
      await shot(page, `cascade-${size.width}-auto-running`);
      await expect(machine(page).locator('.cz-result')).toContainText('Auto spin done: 10 spins', { timeout: 90000 });
      await expect(machine(page).locator('[data-auto="stop"]')).toHaveCount(0);
      expect(await plays(page)).toBe(10);
      await expect.poll(() => gold(page)).toBe(START - 100 + total);
    });
  });
}

test.describe('the Super Bonus', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('a pinned Super Bonus starts every spot at ×2 and pays once', async ({ page }) => {
    test.setTimeout(120000);
    mkdirSync(SHOTS, { recursive: true });
    const expected = playCascade(ECLIPSE_CASCADE, seededRng(`${SUPER}:0`), 10);
    expect(expected.bonus?.kind).toBe('super');
    await seed(page, slateSave(SUPER));
    await openPlay(page);
    await openApp(page, true, ECLIPSE_CASCADE.id);
    await machine(page).locator('[data-spin]').click();
    await expect(machine(page)).toHaveAttribute('data-bonus', 'super', { timeout: 15000 });
    await expect(machine(page)).toHaveAttribute('data-spots', '100', { timeout: 15000 });
    await shot(page, 'cascade-390-super');
    await machine(page).locator('[data-skip]').click();
    await expect.poll(() => gold(page)).toBe(START - 10 + expected.win);
    await shot(page, 'cascade-390-super-paid');
  });
});

test.describe('a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  test('the board, Spin and Auto all fit at 844×390', async ({ page }) => {
    test.setTimeout(90000);
    mkdirSync(SHOTS, { recursive: true });
    await seed(page, slateSave(SPOT));
    await openPlay(page);
    await openApp(page, true, ECLIPSE_CASCADE.id);
    await shot(page, 'cascade-844-landscape');
    await onScreen(page, { width: 844, height: 390 });
    await atLeast44(page, '.cz [data-spin], .cz .gs__btn');
  });
});

test.describe('auto spin at the Reels', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('quick bets and ×10 auto spin at the Croupier\'s Reels', async ({ page }) => {
    test.setTimeout(120000);
    await seed(page, { 'preferred-language': 'en', ...purse(START), ...games('e2e-reels-auto') });
    await openPlay(page, '?at=reels');
    const reels = placePanel(page).locator('app-reels');
    await expect(reels.locator('app-bet-chips')).toBeVisible();
    await reels.locator('[data-chip="max"]').click();
    await expect(reels.locator('.rl-bet__val')).toContainText('50');
    await reels.locator('[data-chip="min"]').click();
    await reels.locator('[data-auto="open"]').click();
    await reels.locator('[data-count="10"]').click();
    await expect(reels.locator('[data-auto="stop"]')).toBeVisible();
    await expect(reels.locator('.rl-result')).toContainText(/Auto spin (done|stopped)/, { timeout: 90000 });
    const n = await plays(page, 'reels');
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(10);
  });
});

// ── The Orrery Tumbler, found in the Orrery Wells ────────────────────────────

function gatePlan() {
  return latticePlans(sectorContext(SPEC, DELVE_SEED), RIFT_GATES.celestial.place.cell).find(p => p.kind === 'rift-gate')!;
}
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
async function act(page: Page, phone: boolean): Promise<void> {
  const button = page.locator('.prompt.armed > button').first();
  await expect(button).toBeEnabled();
  if (phone) await button.click(); else { await focusWorld(page); await page.keyboard.press('KeyE'); }
}

for (const size of [{ width: 1280, height: 800, phone: false }, { width: 390, height: 844, phone: true }]) {
  test.describe(`the Orrery Tumbler at ${size.width}×${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.phone, isMobile: size.phone });
    test('found in the Orrery Wells, it plays at the machine and installs on the Slate', async ({ page }) => {
      test.setTimeout(200000);
      mkdirSync(SHOTS, { recursive: true });
      const g = RIFT_GATES.celestial;
      const tumbler = BUILT_REALM_MACHINES[0];
      const expected = playCascade(ORRERY_TUMBLER, seededRng(`${TUMBLE}:0`), 10);
      const base = ledger({ [g.sigil]: 1, 'mirror-slate': 1 }) as { records: unknown[] };
      await seed(page, {
        ...delveWithCampAtGate(),
        'godforge-realm-era': String(ERA), 'godforge-inventory': base,
        ...activity({ exploration: xpForLevel(g.delving) }),
        ...purse(START), ...games(TUMBLE),
        'preferred-language': 'en',
      });
      await openPlay(page);
      const descend = page.getByRole('button', { name: /Descend to your camp/ });
      await expect(async () => {
        await walkTo(page, 590, 12);
        await expect(descend).toBeVisible({ timeout: 4000 });
      }).toPass({ timeout: 40_000 });
      await descend.click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
      await expect(canvas(page)).toHaveAttribute('data-gate', /^celestial:/, { timeout: 10_000 });
      // Attune with the sigil and step through.
      await expect(async () => {
        await walkTo(page, (gatePlan().col + 4.5) * CELL, 8);
        await page.waitForTimeout(300);
        await act(page, size.phone);
        await expect(canvas(page)).toHaveAttribute('data-area', 'The Orrery Wells', { timeout: 4000 });
      }).toPass({ timeout: 40_000 });
      await page.waitForTimeout(800);

      // West through the Gate Hollow to the surveyors' machine; E finds it and opens it.
      await walkTo(page, (tumbler.col + 2.5) * CELL, 10);
      await page.waitForTimeout(300);
      await shot(page, `tumbler-${size.width}-machine`);
      await walkTo(page, (tumbler.col + 0.5) * CELL, 10);
      await expect(canvas(page)).toHaveAttribute('data-machine', 'orrery-tumbler:new', { timeout: 5000 });
      await act(page, size.phone);
      await expect(messageLine(page)).toContainText('You found the Orrery Tumbler');
      await expect(machine(page, ORRERY_TUMBLER.id)).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);
      await atLeast44(page, '.cz [data-spin], .cz .gs__btn');
      await machine(page, ORRERY_TUMBLER.id).locator('[data-spin]').click();
      await expect(machine(page, ORRERY_TUMBLER.id).locator('.cz-result')).toContainText(`You won ${expected.win} Gold.`, { timeout: 20000 });
      await expect.poll(() => gold(page)).toBe(START - 10 + expected.win);
      await shot(page, `tumbler-${size.width}-paid`);
      await page.locator('.place-close').first().click();
      await expect(placePanel(page)).toBeHidden({ timeout: 5000 });
      await expect(canvas(page)).toHaveAttribute('data-machine', 'orrery-tumbler:found');

      // The Slate now carries it, and keeps it across a reload.
      await openSlate(page, size.phone);
      await expect(placePanel(page).locator('[data-game="orrery-tumbler"]')).toBeVisible();
      await shot(page, `tumbler-${size.width}-slate-app`);
      await page.reload();
      await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
      await page.waitForTimeout(600);
      await openApp(page, size.phone, ORRERY_TUMBLER.id);
      await expect(machine(page, ORRERY_TUMBLER.id).locator('.cz-result')).toContainText(`Last spin: bet 10, won ${expected.win}.`);
      expect(await gold(page)).toBe(START - 10 + expected.win);
      expect(await plays(page, ORRERY_TUMBLER.id)).toBe(1);
    });
  });
}
