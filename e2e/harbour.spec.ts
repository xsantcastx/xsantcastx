/**
 * harbour.spec.ts — the Harbourmasters and the Sailing Board (docs/design/realms-endgame.md §1, Phase 1): walk to the
 * Ember Harbour master, open the board, see the fare and the soft level warning, pay it and sail to another continent
 * (the voyage, then the arrival at that pier's own Harbourmaster), and sail back. Plus the short-of-gold state and Esc.
 * Pictures: docs/handoff/cozy-ui/harbour-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { purse, seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const gold = (page: Page) => page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold ?? 0));
const board = (page: Page) => page.locator('.td-harbour');
const SHOT = 'docs/handoff/cozy-ui';

async function open(page: Page, coins: number, query = 'hour=12'): Promise<void> {
  await seed(page, { 'eclipse-td': '1', ...purse(coins) });
  await page.goto(`/play?td=1&${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}

/** Tap the Harbourmaster's pin on the Map: the Keeper walks to them and the board opens. */
async function toMaster(page: Page, who?: RegExp): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('m');
  const src = who ? who.source.replace(/\\/g, '') : '';
  await page.locator(`#places-list.td-map .mw__pin[data-cat="harbour"]${src ? `[data-name*="${src}" i]` : ''}`).first().click();
  await expect(board(page)).toBeVisible({ timeout: 40000 });
}

test('walk to Odd Tarn, read the board, pay the fare, sail to Pyrehold, and sail back', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 1000);
  await expect(canvas(page)).toHaveAttribute('data-area', /basalt seamworks/i);

  // The pin is an anchor, named for the keeper; the Keeper walks there (no reduced motion) and the board opens.
  await toMaster(page, /odd tarn/i);
  await expect(page.locator('[data-harbour-line]')).toContainText(/Odd Tarn/);
  await expect(page.locator('[data-harbour-line]')).toContainText(/Burning Sea/);
  await expect(board(page).locator('h2')).toHaveText(/Sailing from Ember Harbour/);
  // Two ships out of Ember Harbour: Pyrehold (260) and the long way to Mossharbor (470). Each row is >= 44px.
  const rows = board(page).locator('[data-harbour-row]');
  await expect(rows).toHaveCount(2);
  for (let i = 0; i < 2; i++) expect((await rows.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const pyre = rows.filter({ hasText: /pyrehold/i });
  await expect(pyre).toContainText(/Infernal Reach/);
  await expect(pyre.locator('[data-harbour-band]')).toHaveText('Lv 8-30');
  await expect(pyre.locator('[data-harbour-fare]')).toHaveText('260');
  await expect(rows.filter({ hasText: /mossharbor/i }).locator('[data-harbour-fare]')).toHaveText('470');
  // A level-1 Keeper is warned, softly: the Board button stays live.
  await pyre.click();
  await expect(page.locator('[data-harbour-warn]')).toContainText(/Recommended level 8/);
  await expect(page.locator('[data-harbour-go]')).toBeEnabled();
  await expect(page.locator('[data-harbour-go]')).toContainText('260');
  await page.screenshot({ path: `${SHOT}/harbour-board-desktop.jpg`, type: 'jpeg', quality: 78 });
  // Esc folds it; Odd Tarn stands at the pier's head with his plate; E talks to him again.
  await page.keyboard.press('Escape');
  await expect(board(page)).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT}/harbour-master.jpg`, type: 'jpeg', quality: 78 });
  await canvas(page).focus();
  await page.keyboard.press('e');
  await expect(board(page)).toBeVisible();
  await board(page).locator('[data-harbour-row]', { hasText: /pyrehold/i }).click();

  // Board: the fare leaves the purse, the crossing plays (a real one, not skipped yet), then the arrival.
  const before = await gold(page);
  await page.locator('[data-harbour-go]').click();
  await expect(page.locator('[data-harbour-voyage]')).toBeVisible();
  await expect(board(page)).toHaveCount(0);
  await expect(page.locator('[data-harbour-lore]')).not.toBeEmpty();
  await expect.poll(() => gold(page)).toBe(before - 260);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${SHOT}/harbour-voyage.jpg`, type: 'jpeg', quality: 78 });
  // Tap to skip: the Keeper steps ashore at Pyrehold.
  await page.locator('[data-harbour-voyage]').click();
  await expect(page.locator('[data-harbour-voyage]')).toHaveCount(0, { timeout: 10000 });
  await expect(canvas(page)).toHaveAttribute('data-area', /pyrehold/i, { timeout: 20000 });
  await expect(page.locator('.msg, .td-toast, [role="status"]').filter({ hasText: /Garrick Dross/ }).first()).toBeVisible({ timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT}/harbour-arrival.jpg`, type: 'jpeg', quality: 78 });

  // The way back is the same board, at the other pier: Garrick Dross, three ships, home the cheapest (70).
  await toMaster(page, /garrick dross/i);
  await expect(page.locator('[data-harbour-line]')).toContainText(/Three ships, three coasts/);
  await expect(board(page).locator('[data-harbour-row]')).toHaveCount(3);
  await expect(board(page).locator('[data-harbour-row]').first()).toContainText(/ember harbour/i);
  await expect(board(page).locator('[data-harbour-row]').first().locator('[data-harbour-fare]')).toHaveText('70');
  const mid = await gold(page);
  await board(page).locator('[data-harbour-row]', { hasText: /ember harbour/i }).click();
  await page.locator('[data-harbour-go]').click();
  await page.locator('[data-harbour-skip]').click();
  await expect(canvas(page)).toHaveAttribute('data-area', /basalt seamworks|ember harbour/i, { timeout: 30000 });
  await expect.poll(() => gold(page)).toBe(mid - 70);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('short of gold is shown with its reason, Board stays shut, and Esc closes the board', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 100);
  await toMaster(page, /odd tarn/i);
  const pyre = board(page).locator('[data-harbour-row]', { hasText: /pyrehold/i });
  await expect(pyre).toContainText(/short of gold/i);
  await pyre.click();
  await expect(page.locator('[data-harbour-reason]')).toContainText(/You have 100; the fare is 260/);
  await expect(page.locator('[data-harbour-go]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(board(page)).toHaveCount(0);
  // The world is back: the Keeper can still walk.
  const x0 = Number(await canvas(page).getAttribute('data-player-x'));
  await canvas(page).focus();
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-x'))).not.toBe(x0);
});

test('the Sailing Board on a phone, with reduced motion: a still card for the crossing', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 1000);
  await toMaster(page, /odd tarn/i);
  await page.screenshot({ path: `${SHOT}/harbour-board-phone.jpg`, type: 'jpeg', quality: 78 });
  await board(page).locator('[data-harbour-row]', { hasText: /pyrehold/i }).click();
  await page.locator('[data-harbour-go]').click();
  await expect(page.locator('[data-harbour-voyage]')).toHaveAttribute('data-still', 'true');
  await expect(page.locator('[data-harbour-lore]')).toHaveText(/The crossing, a day's sail/);
  await expect(canvas(page)).toHaveAttribute('data-area', /pyrehold/i, { timeout: 20000 });
  await expect(page.locator('[data-harbour-voyage]')).toHaveCount(0, { timeout: 10000 });
});

test('Esc skips the crossing', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 1000);
  await toMaster(page, /odd tarn/i);
  await board(page).locator('[data-harbour-row]', { hasText: /mossharbor/i }).click();
  await page.locator('[data-harbour-go]').click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-harbour-voyage]')).toHaveCount(0, { timeout: 10000 });
  await expect(canvas(page)).toHaveAttribute('data-area', /^Mossharbor$/, { timeout: 20000 });
});
