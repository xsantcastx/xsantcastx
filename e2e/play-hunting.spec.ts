/**
 * play-hunting.spec.ts — hunt a Rivet Maw in the Ember Quarry with J and the
 * arrow keys, walk over its drops, and check what the kill paid. One World
 * (P2): the Quarry is a region of the Ember world, east of the Quarry Gate;
 * the Keeper logs in there (the resume point) with the beacon already lit.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, ERA, focusWorld, loginAt, openPlay, playerX, seed, stackQty, walkTo, WORLD_COL } from './play-helpers';

/** The beacon is already lit, so the Quarry Gate is up. */
const BEACON_LIT = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };

async function tally(page: Page): Promise<string> {
  return (await page.locator('.satchel .tally').innerText()).replace(/\s+/g, ' ').toUpperCase();
}
async function kills(page: Page): Promise<number> {
  return Number(/DEFEATED (\d+)/.exec(await tally(page))?.[1] ?? 0);
}
async function coins(page: Page): Promise<number> {
  return Number(/COINS (\d+)/.exec(await tally(page))?.[1] ?? 0);
}
async function enemyHp(page: Page): Promise<number> {
  const text = (await page.locator('.vitals').innerText()).replace(/\s+/g, ' ').toUpperCase();
  return Number(/MAW (\d+)/.exec(text)?.[1] ?? -1);
}
async function xp(page: Page, discipline: string): Promise<number> {
  return page.evaluate(d => {
    const ledger = JSON.parse(localStorage.getItem('godforge-activity') || '{}');
    return Number(ledger?.progress?.xpByDiscipline?.[d] ?? 0);
  }, discipline);
}

async function toQuarry(page: Page): Promise<void> {
  await seed(page, { ...BEACON_LIT, ...loginAt(WORLD_COL.quarry) });
  await openPlay(page);
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry', { timeout: 20000 });
  await page.waitForTimeout(500);
  await focusWorld(page);
}

/**
 * Swing with J; when the swings stop landing, take a step. Ends when the
 * Defeated count rises, and returns by how much.
 *
 * Usually by one. A swing hits every Maw in reach, though, and a Maw walks up
 * to stand ~95 px in front of the Keeper, so a second Maw can arrive on the
 * same spot and take every blow the first one takes: then one J fells both and
 * Defeated rises by two. That is the cleave, not a double count (each kill has
 * its own id and pays once; seamworks-engine.test.cjs "one swing that fells two
 * stacked Maws"). It happens when the walk to x=1100 overshoots on a busy
 * machine, which is why this used to fail a different test each run.
 */
async function huntOne(page: Page): Promise<number> {
  const start = await kills(page);
  // The Quarry's own Maws roam under the High Roads (x 6420…7480).
  await walkTo(page, WORLD_COL.quarryMaws * 32, 40);
  let last = await enemyHp(page), stale = 0, moves = 0;
  let dir: 'd' | 'a' = 'd';
  for (let i = 0; i < 200 && (await kills(page)) === start; i++) {
    await page.keyboard.press('j');
    await page.waitForTimeout(200);
    const hp = await enemyHp(page);
    if (hp >= 0 && hp < last) { stale = 0; last = hp; continue; }
    last = hp;
    if (++stale >= 3) {
      stale = 0;
      await page.keyboard.down(dir); await page.waitForTimeout(180); await page.keyboard.up(dir);
      if (++moves % 12 === 0) dir = dir === 'd' ? 'a' : 'd';
    }
  }
  const felled = (await kills(page)) - start;
  expect(felled, 'the Maw never fell').toBeGreaterThanOrEqual(1);
  expect(felled, 'one swing reaches at most the Maws standing in front of the Keeper').toBeLessThanOrEqual(3);
  return felled;
}

/** Pace back and forth over the kill site so the drops are walked over. */
async function sweep(page: Page): Promise<void> {
  const x = await playerX(page);
  await walkTo(page, x - 120, 20);
  await walkTo(page, x + 120, 20);
  await walkTo(page, x, 20);
  await page.waitForTimeout(1500); // flights to the satchel
}

test.describe('Hunting, played', () => {
  test.describe.configure({ timeout: 180000 });

  test('kill a Rivet Maw: coins and Cinder Ore drop and reach the satchel', async ({ page }) => {
    await toQuarry(page);
    await huntOne(page);
    await expect(page.locator('.objective')).toContainText(/Rivet Maw defeated|Collected/);
    await sweep(page);
    expect(await coins(page)).toBeGreaterThan(0);
    await expect.poll(() => stackQty(page, 'cinder-ore')).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.satchel .ore-count')).not.toHaveText('0');
  });

  // Was playtest-findings.md P-3: a kill pays Hunting XP, and an ore drop walked over
  // is booked like a vein (ore + Mining XP in one gateway write).
  test('a kill trains Hunting (and the ore pickup trains Mining)', async ({ page }) => {
    await toQuarry(page);
    const hunting = await xp(page, 'hunting');
    const mining = await xp(page, 'mining');
    const felled = await huntOne(page);
    await sweep(page);
    await expect.poll(() => xp(page, 'hunting'), { timeout: 8000 }).toBeGreaterThan(hunting);
    // Never paid twice: a 60 HP Maw is worth 12 Hunting XP (skills/hunting.ts), once per kill.
    expect(await xp(page, 'hunting') - hunting).toBeLessThanOrEqual(12 * felled);
    await expect.poll(() => xp(page, 'mining'), { timeout: 8000 }).toBeGreaterThan(mining);
  });

  // Was playtest-findings.md P-4: coin drops are credited to the Gold purse (once per
  // drop), and the satchel's coin count is saved with the town.
  test('coins picked up from a kill are kept (they reach the purse and survive a reload)', async ({ page }) => {
    await toQuarry(page);
    await huntOne(page);
    await sweep(page);
    const picked = await coins(page);
    expect(picked).toBeGreaterThan(0);
    await page.waitForTimeout(6000);
    const gold = await page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold ?? 0));
    expect(gold).toBeGreaterThanOrEqual(picked);
    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/);
    expect(await coins(page)).toBeGreaterThanOrEqual(picked);
  });
});
