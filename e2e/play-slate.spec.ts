/**
 * play-slate.spec.ts — the Mirror Slate, played (docs/handoff/mirror-slate.md).
 *
 * Earn it: nine plays are already on the games ledger, so the tenth, a pinned
 * spin at Lune Coyne's Reels, has her hand the Slate over (her counter says so
 * and the HUD grows a Slate button). Then travel to the Seamworks, go down into
 * the Ember Delve and open the Slate there (P on desktop, the button on a
 * phone): the world goes on round it (owner 2026-10-19), the Reels are on the glass, and a second pinned spin
 * lands on the same ledger (one record, paid once). The Homestead tab collects
 * the receipt and builds the next building. A reload keeps the Slate, the plays
 * and the purchase, and pays nothing again. Screenshots go to output/slate/ (not
 * committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { bag, blob, canvas, focusWorld, openPlay, placePanel, purse, seed, stackQty, walkTo } from './play-helpers';
import { playReels } from '../src/app/shared/reels/reels.model';
import { seededRng } from '../src/app/shared/games/seeded-rng';

const SHOTS = resolve('output/slate');
const START = 2_000;

/** A secret whose first two spins at 10 Gold are plain (no Eclipse Round, no win banner) and the second is a line win. */
function secret(): string {
  for (let i = 0; i < 20_000; i++) {
    const s = `e2e-slate-${i}`;
    const a = playReels(seededRng(`${s}:0`), 10), b = playReels(seededRng(`${s}:1`), 10);
    if (!a.bonus && !b.bonus && a.win < 100 && b.win > 0 && b.win < 100) return s;
  }
  throw new Error('no pinned seed for the Slate');
}

interface Play { game: string; win: number; paid: boolean; seq: number }
async function plays(page: Page): Promise<Play[]> {
  return Object.values((await blob<{ plays: Record<string, Play> }>(page, 'godforge-games'))?.plays ?? {});
}
async function totalPlays(page: Page): Promise<number> {
  const totals = (await blob<{ totals: Record<string, { plays: number }> }>(page, 'godforge-games'))?.totals ?? {};
  return Object.values(totals).reduce((n, t) => n + t.plays, 0);
}
async function upgrades(page: Page): Promise<number> {
  const u = (await blob<{ upgrades?: Record<string, number> }>(page, 'godforge-economy'))?.upgrades ?? {};
  return Object.values(u).reduce((a, b) => a + b, 0);
}

const slateBtn = (page: Page) => page.locator('.slate-btn');
const reels = (page: Page) => placePanel(page).locator('app-reels');
const spin = (page: Page) => reels(page).locator('.rl-spin .ab__btn');

async function openSlate(page: Page, phone: boolean): Promise<void> {
  if (phone) await slateBtn(page).click();
  else { await focusWorld(page); await page.keyboard.press('p'); }
  await expect(placePanel(page)).toBeVisible();
  await expect(page.locator('#place-title')).toHaveText('The Mirror Slate');
  await expect(placePanel(page)).toHaveClass(/place--slate/);
  // Let the panel's open transition settle before anything is measured or photographed.
  await page.waitForTimeout(500);
}

for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const phone = size.width < 768;
  test.describe(`the Mirror Slate at ${size.width}×${size.height}`, () => {
    test.describe.configure({ timeout: 180000 });

    test('earn the Slate at Lune\'s tables, open it in the Delve, spin, collect and build, and a reload pays nothing twice', async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize(size);
      const pin = secret();
      const first = playReels(seededRng(`${pin}:0`), 10);
      const second = playReels(seededRng(`${pin}:1`), 10);
      await seed(page, {
        // Ten Ember Stokers: 10 Gold a second, so the Homestead has a receipt to collect.
        'godforge-economy': { version: 3, gold: START, totalGoldEarned: START, runGoldEarned: START, upgrades: { 'ember-stoker': 10 } },
        // Nine plays already at Lune's tables: the next one is the tenth.
        'godforge-games': { version: 1, secret: pin, nonce: 0, plays: {}, totals: { 'rune-drop': { plays: 6, wagered: 60, paid: 57 }, 'seam-sweeper': { plays: 3, wagered: 30, paid: 28 } } },
      });

      // ── Earn it: the tenth play at the Reels ──
      await openPlay(page, '?at=reels');
      await expect(placePanel(page)).toBeVisible();
      await expect(slateBtn(page)).toHaveCount(0);
      const counter = placePanel(page).locator('[data-slate-counter="croupier"]');
      await expect(counter).toContainText('1 to go');
      await expect(counter.locator('.sc__btn')).toContainText('Buy the Slate');
      await page.screenshot({ path: resolve(SHOTS, `${size.width}-1-offer.png`) });
      await spin(page).click();
      if (first.win) await expect(reels(page).locator('.rl-result')).toContainText(`You won ${first.win} Gold.`, { timeout: 10000 });
      await expect.poll(() => totalPlays(page), { timeout: 10000 }).toBe(10);
      await expect(counter).toContainText('Lune Coyne slides you the Mirror Slate');
      await expect(slateBtn(page)).toHaveCount(1);
      expect(await totalPlays(page)).toBe(10);
      await page.screenshot({ path: resolve(SHOTS, `${size.width}-2-awarded.png`) });
      await page.keyboard.press('Escape');
      await expect(placePanel(page)).toBeHidden();
      await expect(slateBtn(page)).toBeVisible();
      if (phone) await expect.poll(async () => { const b = (await slateBtn(page).boundingBox())!; return Math.min(b.width, b.height); }).toBeGreaterThanOrEqual(44);

      // ── Into the Ember Delve: Waystone to the Seamworks, walk to the shaft ──
      await openPlay(page, '?at=waystone');
      await page.locator('.waystone-road', { hasText: 'Infernal' }).click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
      await expect(placePanel(page)).toBeHidden();
      await focusWorld(page);
      await walkTo(page, 590, 30);
      await page.keyboard.press('e');
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 15000 });
      await page.waitForTimeout(600);

      // ── Open it in the Delve: the world waits, the Reels are on the glass ──
      await openSlate(page, phone);
      const x = await canvas(page).getAttribute('data-player-x');
      await expect(placePanel(page).locator('[data-slate-tier="1"]')).toBeVisible();
      // It opens on a few big choices: Lune's four tables and the Homestead (no map at tier I).
      await expect(placePanel(page).locator('.sl-tile--game')).toHaveText(['Reels', 'Rune Drop', 'Seam Sweeper', 'Eclipse Ascent', 'Cascade']);
      await expect(placePanel(page).locator('.sl-tile[data-face="factory"]')).toBeVisible();
      await expect(placePanel(page).locator('.sl-tile[data-face="map"]')).toHaveCount(0);
      if (phone) {
        for (const b of await placePanel(page).locator('.sl-tile').all()) {
          await expect.poll(async () => { const r = (await b.boundingBox())!; return Math.min(r.width, r.height); }).toBeGreaterThanOrEqual(44);
        }
      }
      await page.screenshot({ path: resolve(SHOTS, `${size.width}-3a-delve-home.png`) });
      // One tap onto the Reels.
      await placePanel(page).locator('.sl-tile[data-game="reels"]').click();
      await expect(spin(page)).toBeVisible({ timeout: 15000 });
      await expect(reels(page).locator('.rl-result')).toContainText('Last spin');
      if (phone) {
        // The phone alone (no window around it) fits the viewport; Back at least 44px.
        const box = (await placePanel(page).locator('[data-slate-phone]').boundingBox())!;
        expect(box.width).toBeLessThanOrEqual(size.width);
        expect(box.height).toBeLessThanOrEqual(size.height);
        const back = (await placePanel(page).locator('.sl-back').boundingBox())!;
        expect(Math.min(back.width, back.height)).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: resolve(SHOTS, `${size.width}-3-delve-tables.png`) });
      await spin(page).click();
      await expect(reels(page).locator('.rl-result')).toContainText(`You won ${second.win} Gold.`, { timeout: 10000 });
      await expect.poll(async () => (await plays(page)).filter(p => p.seq === 1 && p.paid && p.win === second.win).length, { timeout: 10000 }).toBe(1);
      expect(await totalPlays(page)).toBe(11);
      // The world runs on round the Slate, but nothing walked the Keeper: they stand where they were.
      expect(await canvas(page).getAttribute('data-player-x')).toBe(x);

      // ── The Homestead tab: collect the receipt, build the next building ──
      await placePanel(page).locator('.sl-back').click();
      await placePanel(page).locator('.sl-tile[data-face="factory"]').click();
      const factory = placePanel(page).locator('.sl-factory');
      await expect(factory.locator('.sl-rate')).toContainText('Gold/s');
      await expect(factory.locator('.sl-waiting__line')).toContainText('since you were last here', { timeout: 15000 });
      await page.screenshot({ path: resolve(SHOTS, `${size.width}-4-homestead.png`) });
      await factory.locator('.sl-collect').click();
      await expect(factory.locator('.sl-notice')).toContainText('Counted: +');
      const before = await upgrades(page);
      await factory.locator('.sl-next .ab__btn').click();
      await expect(factory.locator('.sl-notice')).toContainText('built');
      await expect.poll(() => upgrades(page), { timeout: 10000 }).toBe(before + 1);
      await page.screenshot({ path: resolve(SHOTS, `${size.width}-5-built.png`) });

      // P (desktop) or Close folds it; the world moves again.
      if (phone) await page.keyboard.press('Escape');
      else await page.keyboard.press('p');
      await expect(placePanel(page)).toBeHidden();

      // ── Reload: the Slate is still carried, nothing is paid or bought twice ──
      const records = (await plays(page)).length;
      const built = await upgrades(page);
      await page.reload();
      await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
      await expect(slateBtn(page)).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      await openSlate(page, phone);
      await placePanel(page).locator('.sl-tile[data-game="reels"]').click();
      await expect(reels(page).locator('.rl-result')).toContainText('Last spin', { timeout: 15000 });
      expect((await plays(page)).length).toBe(records);
      expect(await totalPlays(page)).toBe(11);
      expect((await plays(page)).every(p => p.paid)).toBe(true);
      expect(await upgrades(page)).toBe(built);
    });

    test('Kael binds the second face at the Rune Forge: the Slate gains the map and Pim\'s bounties', async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize(size);
      await seed(page, { ...purse(START), ...bag({ 'mirror-slate': 1, glowcap: 6, 'slag-fragment': 12, 'obsidian-block': 4 }) });
      await openPlay(page, '?at=runes');
      await expect(placePanel(page)).toBeVisible();
      const kael = placePanel(page).locator('[data-slate-counter="kael"]');
      await expect(kael).toContainText('wake its second face');
      await page.screenshot({ path: resolve(SHOTS, `${size.width}-6-kael.png`) });
      await kael.locator('.sc__btn').click();
      await expect(kael).toContainText('Kael binds the second face');
      await expect.poll(() => stackQty(page, 'mirror-slate-ii')).toBe(1);
      expect(await stackQty(page, 'mirror-slate')).toBe(0);
      expect(await stackQty(page, 'glowcap')).toBe(0);
      await page.keyboard.press('Escape');
      await expect(placePanel(page)).toBeHidden();
      await expect(slateBtn(page)).toHaveAttribute('data-slate-tier', '2');

      await openSlate(page, phone);
      await expect(page.locator('.place-head .realm-tag')).toContainText('tier II');
      await placePanel(page).locator('.sl-tile[data-face="map"]').click();
      await expect(placePanel(page).locator('.sl-map .sl-list').first().locator('li')).toHaveCount(3);
      await expect(placePanel(page).locator('.sl-map')).toContainText('No pins yet');
      await page.screenshot({ path: resolve(SHOTS, `${size.width}-7-map-bounties.png`) });
    });
  });
}
