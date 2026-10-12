/**
 * play-hunting.spec.ts — hunt a Rivet Maw in Ember Quarry with J and the arrow
 * keys, walk over its drops, and check what the kill paid.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, ERA, focusWorld, openPlay, playerX, seed, stackQty, walkTo } from './play-helpers';

/** The beacon is already lit, so the East Passage is open. */
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
  await seed(page, BEACON_LIT);
  await openPlay(page);
  // The Places list walks the Keeper to the passage and through it.
  await page.getByRole('button', { name: 'Places' }).click();
  await page.locator('#places-list button', { hasText: 'East Passage' }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry', { timeout: 60000 });
  await page.waitForTimeout(500);
  await focusWorld(page);
}

/** Swing with J; when the swings stop landing, take a step. Ends when the Defeated count rises. */
async function huntOne(page: Page): Promise<void> {
  const start = await kills(page);
  await walkTo(page, 1100, 40);
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
  expect(await kills(page), 'the Maw never fell').toBe(start + 1);
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

  // BUG (playtest-findings.md P-3): no code path grants Hunting XP for a kill (or Mining
  // XP for a picked-up ore drop). `godforge-activity` is never even created by a hunt.
  test.fixme('a kill trains Hunting (and the ore pickup trains Mining)', async ({ page }) => {
    await toQuarry(page);
    const hunting = await xp(page, 'hunting');
    await huntOne(page);
    await sweep(page);
    await expect.poll(() => xp(page, 'hunting'), { timeout: 8000 }).toBeGreaterThan(hunting);
  });

  // BUG (playtest-findings.md P-4): monster coins are an engine-only session counter.
  // onLoot ignores coin drops, so they never reach the Gold purse and are gone on reload.
  test.fixme('coins picked up from a kill are kept (they reach the purse and survive a reload)', async ({ page }) => {
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
