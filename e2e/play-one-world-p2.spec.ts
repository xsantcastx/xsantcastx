/**
 * play-one-world-p2.spec.ts — One World, Phase 2 (docs/design/one-world.md §2.2,
 * §2.4, §2.6; docs/handoff/one-world-p2.md), played the way a player does, at
 * 1280×800 (keys) and 390×844 (touch):
 *
 *   - the onboarding beat keeps its shape: the Quarry Gate is barred (a swing
 *     stops a walk; a swing gets its refusal, scripts/one-world.test.cjs) until the beacon burns; then
 *     the Keeper walks through into the Ember Quarry (no arch, no passage);
 *   - the Homestead is west along the same street: walk in, its Gold list is
 *     there, its Forge strikes;
 *   - parkour on cells in the Delve: a pit too deep to jump is climbed out by
 *     catching its lip and mantling.
 *
 * Screenshots go to output/one-world-p2/ (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, ERA, focusWorld, hotbarCount, loginAt, openPlay, playerX, seed, walkTo, WORLD_COL } from './play-helpers';

const EN = { 'preferred-language': 'en' };
const BEACON_LIT = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };
/** The Quarry Gate's west face (ember.world.ts QUARRY_GATE_COL 160). */
const GATE_X = 160 * 32;
const PLOT_FORGE_X = -1700 + 720 / 2;

async function y(page: Page): Promise<number> { return Number(await canvas(page).getAttribute('data-player-y')); }
async function shot(page: Page, name: string): Promise<void> { await page.screenshot({ path: `output/one-world-p2/${name}.png` }); }

/** Hold a key for `ms`. */
async function hold(page: Page, keys: string[], ms: number): Promise<void> {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
}

test.describe('One World P2 — desktop keys', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.describe.configure({ timeout: 150000 });

  test('the Quarry Gate is barred until the beacon burns; then the Keeper walks into the Ember Quarry', async ({ page }) => {
    // On the Quarry Road, the beacon not yet rekindled.
    await seed(page, { ...EN, ...loginAt(WORLD_COL.roadMaws + 20) });
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-region', 'quarry-road');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Quarry Road');
    await focusWorld(page);
    await hold(page, ['d'], 2500);
    expect(await playerX(page), 'the bars stop the Keeper').toBeLessThan(GATE_X);
    await shot(page, 'desktop-gate-barred');

    // The beacon burns (the same `restored` the old east passage read): the bars are lifted.
    await seed(page, { ...EN, ...BEACON_LIT, ...loginAt(WORLD_COL.roadMaws + 20) });
    await openPlay(page);
    await focusWorld(page);
    await walkTo(page, GATE_X + 8 * 32, 30);
    await expect(canvas(page)).toHaveAttribute('data-region', 'ember-quarry');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry');
    await shot(page, 'desktop-gate-open');
    // The Quarry: its nodes on the street, the High Roads over it.
    await walkTo(page, 166 * 32 + 16, 16);
    await expect(page.locator('.prompt.armed')).toBeVisible();
    await walkTo(page, (WORLD_COL.highRoads + 12) * 32, 30);
    await page.waitForTimeout(600);
    await shot(page, 'desktop-quarry-high-roads');
  });

  test('the Homestead is west along the street: walk in, the Gold list is there, the Forge strikes', async ({ page }) => {
    await seed(page, EN);
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
    await focusWorld(page);
    await walkTo(page, PLOT_FORGE_X, 30);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Your Homestead');
    await expect(canvas(page)).toHaveAttribute('data-region', 'homestead');
    await expect(page.locator('.hc-toggle')).toBeVisible();
    await expect(page.locator('.prompt')).toContainText(/Strike the Forge/i, { timeout: 10000 });
    const gold = () => page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold ?? 0));
    const before = await gold();
    for (let i = 0; i < 6; i++) { await page.keyboard.press('e'); await page.waitForTimeout(200); }
    await expect.poll(gold, { timeout: 8000 }).toBeGreaterThan(before);
    await shot(page, 'desktop-homestead');
  });

  test('parkour in the Delve: a pit four rows deep is climbed out by the hands on its lip', async ({ page }) => {
    await seed(page, EN);
    await openPlay(page);
    await focusWorld(page);
    await walkTo(page, 260, 8);
    // Dig straight down: eight dirt blocks are four rows of two columns.
    await page.keyboard.down('s'); await page.keyboard.down('j');
    try { await expect.poll(() => hotbarCount(page, 'Dirt block'), { timeout: 30000, intervals: [100] }).toBeGreaterThanOrEqual(8); }
    finally { await page.keyboard.up('j'); await page.keyboard.up('s'); }
    await page.waitForTimeout(600);
    const bottom = await y(page);
    expect(bottom).toBeGreaterThanOrEqual(610 + 4 * 32);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
    // Jump into the wall: the hands catch the lip (hang), Jump mantles onto the street.
    await page.keyboard.down('a'); await page.keyboard.down('Space');
    await page.waitForFunction(() => {
      const el = document.querySelector('.viewport canvas');
      return el?.getAttribute('data-climb') === 'hang' || el?.getAttribute('data-climb') === 'mantle' || Number(el?.getAttribute('data-player-y')) <= 610;
    }, null, { polling: 'raf', timeout: 8000 });
    await page.keyboard.up('Space'); await page.keyboard.up('a');
    if (await canvas(page).getAttribute('data-climb') === 'hang') { await shot(page, 'desktop-delve-hang'); await page.keyboard.press('Space'); }
    await expect.poll(() => y(page), { timeout: 5000 }).toBeLessThanOrEqual(610);
  });
});

test.describe('One World P2 — phone, touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the Quarry, the gate open: the move row carries Down on the world, and the High Roads are in view', async ({ page }) => {
    test.setTimeout(120000);
    await seed(page, { ...EN, ...BEACON_LIT, ...loginAt(WORLD_COL.highRoads + 2) });
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry');
    // One World reports the Keeper's climb state everywhere on cells: the Down button is in the move row.
    await expect(canvas(page)).toHaveAttribute('data-climb', 'free');
    const down = page.locator('.touch .tb--down');
    await expect(down).toBeVisible();
    expect(Math.min(...Object.values((await down.boundingBox())!).slice(2))).toBeGreaterThanOrEqual(44);
    await shot(page, 'phone-quarry');
  });
});
