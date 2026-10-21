/**
 * lobby-glass-exit.spec.ts — leaving New Keeper makes nothing (owner, 2026-10-21: exiting the creation screen created
 * a hero anyway).
 *
 * A Keeper exists only once "Become this Keeper" is pressed: the roster row is written then, not when the Glass opens.
 * Every other way out — the window's ×, "Back to the list", Escape, the browser's (or the phone's) back, leaving the
 * page altogether — goes back to the list as it was: the same Keepers, no row for the abandoned one, and none of the
 * `<key>@<id>` save the page began for it.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';

const lobby = (page: Page, mode: string) => page.locator(`.lobby[data-lobby="${mode}"]`);

/** One Keeper on this device (Aster, character #1), a returning offline player: /play opens on the list. */
async function oneKeeper(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'eclipse-lobby-guest': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Aster', vocation: 'warlock', updatedAt: 1 },
  });
  await page.evaluate(() => localStorage.removeItem('eclipse-lobby'));
}

async function openGlass(page: Page, tap = false): Promise<void> {
  await page.goto('/play?td=1&hour=12');
  const list = lobby(page, 'select');
  await expect(list).toBeVisible({ timeout: 30000 });
  await expect(list.locator('[data-character]')).toHaveCount(1);
  if (tap) await list.locator('[data-lobby-new]').tap(); else await list.locator('[data-lobby-new]').click();
  await expect(lobby(page, 'create')).toBeVisible({ timeout: 30000 });
  // Nothing on the list yet: the row comes with Become.
  const rows = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('eclipse-characters') || '{"chars":{}}').chars));
  expect(rows).toEqual(['c1']);
  await lobby(page, 'create').locator('.km__name input').fill('Ghost');
  // The page already plays the new Keeper's namespace (its services boot into it): that is what a way out must clear.
  const id = await page.evaluate(() => localStorage.getItem('eclipse-active-character'));
  expect(id).toMatch(/^k[a-z0-9]{7}$/);
  await expect.poll(() => page.evaluate(k => Object.keys(localStorage).filter(x => x.endsWith('@' + k)).length, id)).toBeGreaterThan(0);
}

/** Back on the list, as it was: one Keeper, Aster in play, no row and no save for the one that was never made. */
async function unchanged(page: Page): Promise<void> {
  const list = lobby(page, 'select');
  await expect(list).toBeVisible({ timeout: 30000 });
  await expect(list.locator('[data-character]')).toHaveCount(1);
  await expect(list.locator('[data-character="c1"]')).toHaveAttribute('data-name', 'Aster');
  const state = await page.evaluate(() => ({
    rows: Object.keys(JSON.parse(localStorage.getItem('eclipse-characters') || '{"chars":{}}').chars),
    scoped: Object.keys(localStorage).filter(k => k.includes('@')),
    active: localStorage.getItem('eclipse-active-character'),
  }));
  expect(state.rows).toEqual(['c1']);
  expect(state.scoped).toEqual([]);
  expect(state.active ?? 'c1').toBe('c1');
  expect(await page.locator('text=Ghost').count()).toBe(0);
}

test.describe('leaving New Keeper makes nothing (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the window\'s ×', async ({ page }) => {
    test.setTimeout(90_000);
    await oneKeeper(page);
    await openGlass(page);
    await page.locator('[data-lobby-close]').click();
    await unchanged(page);
  });

  test('Back to the list', async ({ page }) => {
    test.setTimeout(90_000);
    await oneKeeper(page);
    await openGlass(page);
    await page.locator('[data-lobby-back]').click();
    await unchanged(page);
  });

  test('Escape', async ({ page }) => {
    test.setTimeout(90_000);
    await oneKeeper(page);
    await openGlass(page);
    await page.locator('.km__name input').blur();
    await page.keyboard.press('Escape');
    await unchanged(page);
  });

  test('the browser\'s back', async ({ page }) => {
    test.setTimeout(90_000);
    await oneKeeper(page);
    await openGlass(page);
    await page.goBack();
    await unchanged(page);
  });

  test('leaving the page, then coming back', async ({ page }) => {
    test.setTimeout(90_000);
    await oneKeeper(page);
    await openGlass(page);
    await page.waitForTimeout(1500);
    await page.goto('/robots.txt');
    await page.goto('/play?td=1&hour=12');
    await unchanged(page);
  });

  test('a first Keeper on a new device: × leaves the list empty', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/robots.txt');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('preferred-language', 'en'); localStorage.setItem('xsantcastx_consent', 'denied'); localStorage.setItem('eclipse-lobby-guest', '1'); });
    await page.goto('/play?hour=12');
    await lobby(page, 'select').locator('[data-lobby-new]').click();
    await expect(lobby(page, 'create')).toBeVisible({ timeout: 30000 });
    await page.locator('[data-lobby-close]').click();
    await expect(lobby(page, 'select').locator('[data-select-empty]')).toBeVisible();
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('eclipse-characters') || '{"chars":{}}').chars))).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('@')))).toEqual([]);
    // And making one afterwards still works: Become puts it on the list.
    await lobby(page, 'select').locator('[data-lobby-new]').click();
    await lobby(page, 'create').locator('.km__name input').fill('Real');
    await lobby(page, 'create').locator('.km__keep').click();
    await expect(page.locator('.viewport canvas')).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('eclipse-characters') || '{}').chars?.c1?.name)).toBe('Real');
  });
});

test.describe('leaving New Keeper makes nothing (Android phone)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the × by tap, and the phone\'s back', async ({ page }) => {
    test.setTimeout(120_000);
    await oneKeeper(page);
    await openGlass(page, true);
    await page.locator('[data-lobby-close]').tap();
    await unchanged(page);
    await lobby(page, 'select').locator('[data-lobby-new]').tap();
    await expect(lobby(page, 'create')).toBeVisible({ timeout: 30000 });
    await page.goBack();
    await unchanged(page);
  });
});
