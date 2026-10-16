/**
 * play-casino.spec.ts — the Croupier's other three games in the Nocturne Archive:
 * Rune Drop (Plinko), Seam Sweeper (Mines) and Eclipse Ascent (Crash).
 *
 * Each plays one round on a pinned seed (the next play's seed is `secret:0`,
 * so the outcome is known here from the same pure model the app runs), checks
 * the Gold, then reloads: nothing is paid twice, an open seam resumes with the
 * same cells dug, and a launch keeps rising on the clock. Desktop walks to Rune
 * Drop; the phone deep-links. Screenshots go to output/casino/ (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { blob, canvas, focusWorld, openPlay, placePanel, purse, seed, walkTo } from './play-helpers';
import { seededRng } from '../src/app/shared/games/seeded-rng';
import { playRuneDrop } from '../src/app/shared/rune-drop/rune-drop.model';
import { drawSeam, seamMultiplier } from '../src/app/shared/seam-sweeper/seam-sweeper.model';
import { drawAscent } from '../src/app/shared/eclipse-ascent/eclipse-ascent.model';
import { wholeGold } from '../src/app/shared/games/rtp-sim';

const SHOTS = resolve('output/casino');
const START = 1_000;

// Gold reaches storage on the economy's 5 s write throttle (spends flush at once; pagehide flushes on reload), so polls wait 10 s.
/** The first `e2e-<game>-<i>` secret whose first play satisfies `ok`. */
function secretWhere(game: string, ok: (seed: string) => boolean): string {
  for (let i = 0; i < 5_000; i++) if (ok(`e2e-${game}-${i}:0`)) return `e2e-${game}-${i}`;
  throw new Error(`no pinned seed for ${game}`);
}

function pinned(secret: string): Record<string, unknown> {
  return { ...purse(START), 'godforge-games': { version: 1, secret, nonce: 0, plays: {}, totals: {} } };
}

async function gold(page: Page): Promise<number> {
  return ((await blob<{ gold: number }>(page, 'godforge-economy'))?.gold) ?? -1;
}

interface Play { win: number; paid: boolean; open?: boolean; state?: { dug?: number[]; cashedAt?: number } }
async function plays(page: Page): Promise<Play[]> {
  return Object.values((await blob<{ plays: Record<string, Play> }>(page, 'godforge-games'))?.plays ?? {});
}

async function minSide(page: Page, selector: string): Promise<number> {
  const boxes = await page.locator(selector).evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  return Math.min(...boxes);
}

const panel = (page: Page, tag: string) => placePanel(page).locator(tag);
const primary = (page: Page, tag: string, cls: string) => panel(page, tag).locator(`.${cls} .ab__btn`);

for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const phone = size.width < 768;
  test.describe(`the casino at ${size.width}×${size.height}`, () => {
    test.describe.configure({ timeout: 150000 });

    test('Rune Drop: the rune lands where its seed says, paid once', async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize(size);
      const secret = secretWhere('drop', s => playRuneDrop(seededRng(s), 10, 'medium', 12).tenths >= 19);
      const expected = playRuneDrop(seededRng(`${secret}:0`), 10, 'medium', 12);
      await seed(page, pinned(secret));

      if (phone) {
        await openPlay(page, '?at=rune-drop');
      } else {
        await openPlay(page, '?at=waystone');
        await page.locator('.waystone-road', { hasText: 'Umbral' }).click();
        await expect(canvas(page)).toHaveAttribute('data-area', 'Nocturne Archive');
        await expect(placePanel(page)).toBeHidden();
        await focusWorld(page);
        await walkTo(page, 1105, 40);
        await page.keyboard.press('e');
      }
      await expect(placePanel(page)).toBeVisible();
      await expect(page.locator('#place-title')).toHaveText('Rune Drop');
      await expect(page).toHaveURL(/[?&]at=rune-drop/);
      const drop = primary(page, 'app-rune-drop', 'rd-drop');
      await expect(drop).toHaveCount(1);
      await expect(drop).toContainText('Drop');
      await expect(drop).toContainText('10');
      await expect.poll(() => minSide(page, 'app-rune-drop .gs__btn')).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: resolve(SHOTS, `rune-drop-${size.width}-ready.png`) });

      await drop.click();
      await expect(panel(page, 'app-rune-drop').locator('.rd-result')).toContainText(`Landed on ×${expected.tenths / 10}: ${expected.win} Gold.`, { timeout: 10000 });
      await expect(panel(page, 'app-rune-drop').locator('.rd-bins li.is-lit')).toHaveText(String(expected.tenths / 10));
      await expect.poll(() => gold(page), { timeout: 10000 }).toBe(START - 10 + expected.win);
      await page.screenshot({ path: resolve(SHOTS, `rune-drop-${size.width}-landed.png`) });

      await panel(page, 'app-rune-drop').locator('.ss__help, app-details-drawer summary').first().click();
      await expect(panel(page, 'app-rune-drop').locator('.rd-pay li')).toHaveCount(13);
      await expect(panel(page, 'app-rune-drop').locator('.rd-proof')).toContainText('95.1%');

      const after = await gold(page);
      await page.reload();
      await expect(placePanel(page)).toBeVisible({ timeout: 15000 });
      await expect(panel(page, 'app-rune-drop').locator('.rd-result')).toContainText('Last drop');
      await page.waitForTimeout(1000);
      expect(await gold(page)).toBe(after);
      expect((await plays(page)).length).toBe(1);
    });

    test('Seam Sweeper: dig, reload mid-seam, resume, cash out once', async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize(size);
      const secret = 'e2e-seam-0';
      const seam = drawSeam(seededRng(`${secret}:0`), 3);
      const safe = Array.from({ length: 25 }, (_, i) => i).filter(c => !seam.layout.includes(c));
      await seed(page, pinned(secret));
      await openPlay(page, '?at=seam-sweeper');
      await expect(page.locator('#place-title')).toHaveText('Seam Sweeper');
      const game = panel(page, 'app-seam-sweeper');
      const act = primary(page, 'app-seam-sweeper', 'ss-act');
      await expect(act).toContainText('Dig');
      await expect.poll(() => minSide(page, 'app-seam-sweeper .ss-cell')).toBeGreaterThanOrEqual(44);
      await act.click();
      await expect.poll(() => gold(page), { timeout: 10000 }).toBe(START - 10);
      await game.locator(`.ss-cell[data-cell="${safe[0]}"]`).click();
      await expect(game.locator(`.ss-cell[data-cell="${safe[0]}"]`)).toHaveAttribute('data-view', 'ore');
      await page.screenshot({ path: resolve(SHOTS, `seam-${size.width}-dug.png`) });

      // Reload mid-round: the same seam, the same cell dug, nothing re-rolled.
      await page.reload();
      await expect(placePanel(page)).toBeVisible({ timeout: 15000 });
      await expect(game.locator('.ss-result')).toContainText('still open');
      await expect(game.locator(`.ss-cell[data-cell="${safe[0]}"]`)).toHaveAttribute('data-view', 'ore');
      await game.locator(`.ss-cell[data-cell="${safe[1]}"]`).click();
      const x = seamMultiplier(3, 2);
      await expect(act).toContainText(`Cash out ×${x.toFixed(2)}`);
      await act.click();
      const win = wholeGold(10 * x, seam.u);
      await expect(game.locator('.ss-result')).toContainText(`${win} Gold`);
      await expect.poll(() => gold(page), { timeout: 10000 }).toBe(START - 10 + win);
      // Every collapse is shown once the round ends.
      await expect(game.locator('.ss-cell[data-view="shown-collapse"]')).toHaveCount(3);
      await page.screenshot({ path: resolve(SHOTS, `seam-${size.width}-cashed.png`) });

      await page.reload();
      await expect(placePanel(page)).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      expect(await gold(page)).toBe(START - 10 + win);
      const all = await plays(page);
      expect(all.length).toBe(1);
      expect(all[0].paid).toBe(true);
    });

    test('Eclipse Ascent: launch, reload mid-flight, auto cash-out pays once', async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize(size);
      // A break point well past ×2.00 so the ×2.00 target always holds.
      const secret = secretWhere('ascent', s => drawAscent(seededRng(s)).crash >= 400);
      const o = drawAscent(seededRng(`${secret}:0`));
      await seed(page, pinned(secret));
      await openPlay(page, '?at=eclipse-ascent');
      await expect(page.locator('#place-title')).toHaveText('Eclipse Ascent');
      const game = panel(page, 'app-eclipse-ascent');
      const act = primary(page, 'app-eclipse-ascent', 'ea-act');
      await expect(act).toContainText('Launch');
      // Auto cash-out: Off → ×1.20 → ×1.50 → ×2.00.
      const more = game.locator('app-game-stepper').first().locator('.gs__btn').last();
      for (let i = 0; i < 3; i++) await more.click();
      await expect(game.locator('app-game-stepper').first()).toContainText('×2.00');
      await act.click();
      await expect(act).toContainText('Cash out');
      await page.screenshot({ path: resolve(SHOTS, `ascent-${size.width}-rising.png`) });
      // Reload in flight: the round is still open and keeps rising on the clock.
      await page.reload();
      await expect(placePanel(page)).toBeVisible({ timeout: 15000 });
      const win = wholeGold(10 * 2, o.u);
      await expect(game.locator('.ea-result')).toContainText(`Cashed out at ×2.00: ${win} Gold.`, { timeout: 15000 });
      await expect.poll(() => gold(page), { timeout: 10000 }).toBe(START - 10 + win);
      await page.screenshot({ path: resolve(SHOTS, `ascent-${size.width}-cashed.png`) });

      await page.reload();
      await expect(placePanel(page)).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      expect(await gold(page)).toBe(START - 10 + win);
      const all = await plays(page);
      expect(all.length).toBe(1);
      expect(all[0].state?.cashedAt).toBe(200);
    });
  });
}
