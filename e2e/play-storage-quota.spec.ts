/**
 * play-storage-quota.spec.ts — a full localStorage must not refuse pickups.
 *
 * The owner's phone filled its quota (the economy op log grew ~260 KB an hour
 * on a device that never synced) and every pickup after that said "That
 * pickup could not be saved". Here the browser's own quota is filled for real:
 * a filler key takes every byte that is left, then the Keeper digs.
 *
 *  1. Full disk: the dug blocks still land in the satchel, the HUD says the
 *     device is out of save space (not "could not be saved"), and once there
 *     is room again the held save reaches the disk and survives a reload.
 *  2. The owner's case: a bloated economy log fills the disk. Loading the game
 *     folds it (compactLocalLedger), which frees the room, so the very next
 *     pickups are on disk without anything else being cleared.
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, canvas, focusWorld, hotbarCount, messageLine, openPlay, seed, stackQty, walkTo } from './play-helpers';
import { applyOp, emptyLedger, snapshotOf, type EconomyLedger, type EconomyOp } from '../src/app/shared/economy/economy-ops';

const SEED = 424242;
const FRESH_DELVE = { 'godforge-delve': { version: 1, seed: SEED, createdAt: 1, areas: {}, claimed: [] } };
const ARRIVE_X = 260;
const DEVICE = 'e2e-phone';

async function enterDelve(page: Page): Promise<void> {
  await walkTo(page, 590, 30);
  await page.keyboard.press('e');
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await expect.poll(() => canvas(page).getAttribute('data-player-x').then(Number)).toBe(ARRIVE_X);
  await page.waitForTimeout(400);
  await focusWorld(page);
}

/** Hold S + J (dig below) until the satchel holds `blocks` dirt blocks. */
async function digDown(page: Page, blocks: number): Promise<void> {
  await page.keyboard.down('s');
  await page.keyboard.down('j');
  try {
    await expect.poll(() => hotbarCount(page, 'Dirt block'), { timeout: 30000, intervals: [100] }).toBeGreaterThanOrEqual(blocks);
  } finally {
    await page.keyboard.up('j');
    await page.keyboard.up('s');
  }
  await page.waitForTimeout(600);
}

/** Take every byte of localStorage that is left with one filler key; returns its length. */
async function fillDisk(page: Page): Promise<number> {
  return page.evaluate(() => {
    const fits = (n: number) => {
      try { localStorage.setItem('zz-filler', 'x'.repeat(n)); return true; } catch { return false; }
    };
    let lo = 0, hi = 12_000_000;
    while (hi - lo > 64) { const mid = (lo + hi) >> 1; if (fits(mid)) lo = mid; else hi = mid; }
    fits(lo);
    // Nothing more fits: a one-character key is refused.
    try { localStorage.setItem('zz-probe', 'x'.repeat(256)); localStorage.removeItem('zz-probe'); return -1; } catch { return lo; }
  });
}

/** A never-synced economy log of `ops` credits, as the old five-second persist wrote it. */
function bloatedEconomy(ops: number): EconomyLedger {
  const origin = emptyLedger();
  const state = emptyLedger();
  const log: EconomyOp[] = [];
  for (let seq = 1; seq <= ops; seq++) {
    const op: EconomyOp = { id: `${DEVICE}:${seq}`, deviceId: DEVICE, seq, kind: 'credit-gold', amount: 7, hlc: 1_760_000_000_000 + seq, wall: 1_760_000_000_000 + seq };
    applyOp(state, op);
    log.push(op);
  }
  return { ...state, ops: log, origin: snapshotOf(origin), hlc: log[log.length - 1].hlc, lastIdleAt: Date.now() };
}

test.describe('a full localStorage', () => {
  test.describe.configure({ timeout: 150000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  });

  test('pickups still land, the HUD says why, and the save reaches the disk once there is room', async ({ page }) => {
    await seed(page, { ...FRESH_DELVE, ...bag({}), 'godforge-device-id': DEVICE });
    await openPlay(page);
    await enterDelve(page);

    expect(await fillDisk(page)).toBeGreaterThan(0);
    await digDown(page, 2);
    await expect(messageLine(page)).not.toContainText('could not be saved');
    await expect(page.getByText('out of save space').first()).toBeVisible({ timeout: 10000 });
    const held = await hotbarCount(page, 'Dirt block');
    expect(held).toBeGreaterThanOrEqual(2);
    // The disk still holds the bag from before the dig: the satchel is in memory.
    expect(await stackQty(page, 'dirt-block')).toBe(0);

    // Room again (the player cleared space): the next write puts the held save down.
    await page.evaluate(() => localStorage.removeItem('zz-filler'));
    await digDown(page, held + 1);
    await expect.poll(() => stackQty(page, 'dirt-block'), { timeout: 10000 }).toBeGreaterThanOrEqual(held + 1);

    await page.waitForTimeout(2500);
    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
    // The game booted from that disk and wrote over it again: the blocks are still there.
    await page.waitForTimeout(3000);
    expect(await stackQty(page, 'dirt-block')).toBeGreaterThanOrEqual(held + 1);
  });

  test('a bloated economy log is folded on load, which frees the room for pickups', async ({ page }) => {
    await seed(page, { ...FRESH_DELVE, ...bag({}), 'godforge-device-id': DEVICE, 'godforge-economy': bloatedEconomy(6000) });
    const before = (await page.evaluate(() => localStorage.getItem('godforge-economy')!.length));
    expect(before).toBeGreaterThan(700_000);
    await page.evaluate(() => {
      // Fill what is left, as the owner's phone was.
      const fits = (n: number) => { try { localStorage.setItem('zz-filler', 'x'.repeat(n)); return true; } catch { return false; } };
      let lo = 0, hi = 12_000_000;
      while (hi - lo > 64) { const mid = (lo + hi) >> 1; if (fits(mid)) lo = mid; else hi = mid; }
      fits(lo);
    });

    await openPlay(page);
    // The first persist folds the never-synced log down (economy-ops compactLocalLedger).
    await expect.poll(async () => (await blob<{ ops: unknown[] }>(page, 'godforge-economy'))?.ops.length ?? 1e9, { timeout: 15000 }).toBeLessThan(128);
    await enterDelve(page);
    await digDown(page, 2);
    await expect(messageLine(page)).not.toContainText('could not be saved');
    // On disk now, with the filler still in place.
    await expect.poll(() => stackQty(page, 'dirt-block'), { timeout: 10000 }).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => localStorage.getItem('zz-filler') !== null)).toBe(true);
  });
});
