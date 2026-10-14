/**
 * play-bounties.spec.ts — the Board Herald's daily Delve bounties, played
 * (docs/handoff/bounties-map-v2.md; delve-and-beyond.md §7.2, Phase 7.5).
 *
 *   - in the Delve, Delve work counts toward today's bounties: a torch placed
 *     in the Root Hollows finishes a torch bounty and the HUD says so; a reach
 *     bounty reads the explored frontier off the save;
 *   - at the Quest Board, Pim Larkin's Bounties tab lists today's three; a
 *     claim pays Gold once (receipt first) and the first one ever comes with the
 *     Broken Astral Compass; a second claim pays nothing, after a reload too;
 *   - on a 390×844 phone the tab and its one Claim button are 44px targets,
 *     inside the screen, and the Details count days visited (never a streak).
 *
 * Today's board is seeded (bounty.model drawBounties is pinned in Karma and the
 * node tests); what is played here is the wiring: events, the gateway, the
 * receipt and the reward. Screenshots go to output/bounties/ when
 * BOUNTY_SHOTS is set (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, canvas, focusWorld, messageLine, openPlay, seed, stackQty } from './play-helpers';
import { DelveFixture } from './play-delve-fixtures';

const SHOTS = process.env['BOUNTY_SHOTS'];
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/bounties/${name}.png` });
}
/** Today on this machine's calendar (the browser shares its clock and zone). */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's board: reach sector 1 east (sx 4), break one Cinder Ore vein, light one torch, all in the Root Hollows. */
function board(day: string) {
  return {
    day, deepest: 0, list: [
      { id: `${day}:0:reach:east:1`, slot: 0, kind: 'reach', tier: 1, stratum: 0, target: 'east', n: 1, sx: 4 },
      { id: `${day}:1:dig:cinder-vein:1`, slot: 1, kind: 'dig', tier: 2, stratum: 0, target: 'cinder-vein', n: 1 },
      { id: `${day}:2:torch:torch:1`, slot: 2, kind: 'torch', tier: 1, stratum: 0, target: 'torch', n: 1 },
    ],
  };
}
/** The explored frontier: sector column 4 (east of the core) has been walked. */
const FRONTIER = { 'godforge-delve-r0': { v: 1, seed: 424242, rx: 0, ry: 0, t: 1, sectors: { '4,0': { g: 1, t: 1, f: '0000000000000001' } } } };

async function savedGold(page: Page): Promise<number> {
  return page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold ?? 0));
}
async function bounties(page: Page) {
  return blob<{ claimed: string[]; kit: string[]; progress: Record<string, string[]>; days: number; total: number }>(page, 'godforge-bounties');
}
/** The Quest Board in the Rootglass Canopy, on its Bounties tab. */
async function openBounties(page: Page): Promise<void> {
  await openPlay(page, '?at=quests');
  await expect(page.locator('#place-title')).toHaveText('Quest Board', { timeout: 15000 });
  await expect(page.locator('section.place app-station-shell.qb')).toBeVisible({ timeout: 15000 });
  await page.locator('section.place app-station-tabs').getByRole('button', { name: /^Bounties/ }).click();
}
async function claimRow(page: Page, text: string | RegExp, touch = false): Promise<void> {
  const row = page.locator('section.place app-journal-list .jl__row', { hasText: text }).first();
  if (touch) await row.tap(); else await row.click();
  const claim = page.locator('section.place .qb-detail .ab__btn');
  await expect(claim).not.toHaveAttribute('aria-disabled', 'true');
  if (touch) await claim.tap(); else await claim.click();
  await expect(page.locator('section.place app-reward-pop .rp')).toBeVisible();
}

test.describe('The Board Herald\'s bounties (desktop, 1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.describe.configure({ timeout: 150000 });

  test('a torch in the Root Hollows counts; Pim pays each bounty once, the first with the compass', async ({ page }) => {
    const day = today();
    const f = new DelveFixture().carve(14, 34, 6, 8).floor(14, 34, 9).camp(22, 8);
    const progress = { [`${day}:1:dig:cinder-vein:1`]: ['31,7'] };
    await seed(page, {
      ...f.blobs(), ...FRONTIER, ...bag({ torch: 3 }),
      'godforge-bounties': { version: 1, board: board(day), progress, claimed: [], kit: [], days: 1, lastDay: day, claimDays: 0, lastClaimDay: '', total: 0, deepest: 0 },
    });

    // ── In the Delve: a torch beside the camp finishes the torch bounty. ──
    await openPlay(page, '?at=delve');
    await page.getByRole('button', { name: /Descend to your camp/ }).click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
    await page.waitForTimeout(1800);
    await focusWorld(page);
    await page.keyboard.press('Digit3');
    await expect(messageLine(page)).toContainText('Torch ready');
    await page.keyboard.press('b');
    await expect.poll(async () => (await bounties(page))?.progress[`${day}:2:torch:torch:1`]?.length ?? 0, { timeout: 8000 }).toBe(1);
    await expect(messageLine(page)).toContainText('Bounty done');
    await shot(page, 'desktop-delve');

    // ── At the Quest Board: three ready, each claimed once. ──
    await page.waitForTimeout(1500);
    const goldBefore = await savedGold(page);
    await openBounties(page);
    const rows = page.locator('section.place app-journal-list .jl__row');
    await expect(rows).toHaveCount(3);
    await expect(rows.filter({ hasText: 'Ready!' })).toHaveCount(3);
    await expect(page.locator('section.place .qb-who')).toContainText('Pim Larkin');
    await claimRow(page, 'Reach sector 1 east of the core');
    await expect(page.locator('section.place app-reward-pop')).toContainText('Broken Astral Compass');
    await shot(page, 'desktop-claim');
    await claimRow(page, 'Break 1 Cinder Ore veins');
    await claimRow(page, 'Light 1 torches');
    await expect.poll(async () => (await bounties(page))?.claimed.length ?? 0).toBe(3);
    const saved = await bounties(page);
    expect(saved!.kit).toContain('compass');
    expect(saved!.total).toBe(3);
    await expect.poll(() => stackQty(page, 'broken-astral-compass')).toBe(1);
    await expect.poll(() => savedGold(page), { timeout: 10000 }).toBeGreaterThan(goldBefore);

    // Claimed is claimed: the button says so, before and after a reload.
    await page.locator('section.place app-journal-list .jl__row').first().click();
    await expect(page.locator('section.place .qb-detail')).toContainText('Already claimed');
    await page.waitForTimeout(1500);
    const goldAfter = await savedGold(page);
    await openBounties(page);
    await expect(rows.filter({ hasText: 'Done' })).toHaveCount(3);
    await expect(page.locator('section.place .qb-detail .ab__btn')).toHaveAttribute('aria-disabled', 'true');
    expect((await bounties(page))!.claimed.length).toBe(3);
    expect(await savedGold(page)).toBe(goldAfter);
    expect(await stackQty(page, 'broken-astral-compass')).toBe(1);
  });
});

test.describe('The Board Herald\'s bounties (phone, 390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.describe.configure({ timeout: 150000 });

  test('the Bounties tab and its one Claim button are 44px and on screen; Details count days, never a streak', async ({ page }) => {
    const day = today();
    const f = new DelveFixture().camp(22, 8);
    const progress = { [`${day}:1:dig:cinder-vein:1`]: ['31,7'], [`${day}:2:torch:torch:1`]: ['23,8'] };
    await seed(page, {
      ...f.blobs(), ...FRONTIER,
      'godforge-bounties': { version: 1, board: board(day), progress, claimed: [], kit: ['compass'], days: 7, lastDay: day, claimDays: 6, lastClaimDay: '2026-01-01', total: 18, deepest: 0 },
    });
    await openPlay(page, '?at=quests');
    await expect(page.locator('section.place app-station-shell.qb')).toBeVisible({ timeout: 15000 });
    const tab = page.locator('section.place app-station-tabs').getByRole('button', { name: /^Bounties/ });
    const tabBox = await tab.boundingBox();
    expect(tabBox!.height, 'the Bounties tab is a 44px target').toBeGreaterThanOrEqual(44);
    await tab.tap();
    const row = page.locator('section.place app-journal-list .jl__row', { hasText: 'Light 1 torches' }).first();
    await row.tap();
    const claim = page.locator('section.place .qb-detail .ab__btn');
    await claim.scrollIntoViewIfNeeded();
    const b = await claim.boundingBox();
    expect(b!.height, 'the Claim button is a 44px target').toBeGreaterThanOrEqual(44);
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(390);
    await claim.tap();
    await expect(page.locator('section.place app-reward-pop .rp')).toBeVisible();
    // A seventh claim day (six before, months ago): Pim adds a Rift Map Fragment. No streak was kept or lost.
    await expect(page.locator('section.place app-reward-pop')).toContainText('Rift Map Fragment');
    await expect.poll(() => stackQty(page, 'rift-map-fragment')).toBe(1);
    const saved = await bounties(page);
    expect(saved!.days).toBe(7);
    await shot(page, 'phone-claim');
    // Details: days visited and claimed, said as counts.
    await page.locator('section.place').getByText('Details', { exact: true }).tap();
    await expect(page.locator('section.place [data-bounty-counts]')).toContainText('Days visited: 7');
    await expect(page.locator('section.place [data-bounty-counts]')).toContainText('Bounties claimed: 19');
  });
});
