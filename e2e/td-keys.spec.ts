/**
 * td-keys.spec.ts — the keymap (shared/keys): the Esc menu as the options hub with a keycap on each row, no "One World"
 * in it, the Controls list, rebinding (the new key works, the old one does not), clashes, reset, and the typing guard
 * holding with a rebound key. Phones show the list read-only.
 */
import { expect, test, type Page } from '@playwright/test';
import { focusWorld, openMenu, seed } from './play-helpers';

async function enter(page: Page): Promise<void> {
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForTimeout(600);
}
async function openControls(page: Page): Promise<void> {
  await openMenu(page);
  await page.locator('#game-menu [data-open="controls"]').click();
  await expect(page.locator('[data-controls]')).toBeVisible();
}
const row = (page: Page, action: string) => page.locator(`[data-controls] [data-action="${action}"]`);
const book = (page: Page) => page.locator('.spellbook, .sbt').first();

test.describe('keys', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Esc opens the Menu: Resume first, a keycap on the rows that have a key, no One World', async ({ page }) => {
    await enter(page);
    await openMenu(page);
    const menu = page.locator('#game-menu');
    await expect(menu.locator('h2')).toHaveText('Menu');
    await expect(menu.locator('.win-body button').first()).toHaveAttribute('data-open', 'resume');
    for (const [open, cap] of [['map', 'M'], ['character', 'C'], ['bestiary', 'B'], ['lore', 'L'], ['friends', 'G'], ['sound', 'O']] as const) {
      await expect(menu.locator(`[data-open="${open}"] .kc`), `${open} shows its key`).toHaveText(cap);
    }
    await expect(menu.locator('[data-open="controls"]')).toBeVisible();
    await expect(menu.locator('[data-open="oneworld"]')).toHaveCount(0);
    await expect(menu).not.toContainText(/one world/i);
    // Resume closes it.
    await menu.locator('[data-open="resume"]').click();
    await expect(menu).toHaveCount(0);
  });

  test('the new defaults open their windows', async ({ page }) => {
    await enter(page);
    await focusWorld(page);
    await page.keyboard.press('l');
    await expect(page.locator('.ksheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('g');
    await expect(page.locator('.friends-host')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('o');
    await expect(page.locator('.sound-host')).toBeVisible();
    await page.keyboard.press('F2');
    await expect(page.locator('.sound-host')).toHaveCount(0);
  });

  test('rebind the Spellbook: the new key opens it, the old one no longer does', async ({ page }) => {
    await enter(page);
    await openControls(page);
    await row(page, 'spellbook').locator('button[data-slot="0"]').click();
    await page.keyboard.press('u');
    await expect(row(page, 'spellbook').locator('button[data-slot="0"]')).toHaveText('U');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-controls]')).toHaveCount(0);
    await focusWorld(page);
    await page.keyboard.press('k');
    await page.waitForTimeout(300);
    await expect(book(page)).toHaveCount(0);
    await page.keyboard.press('u');
    await expect(book(page)).toBeVisible();
    // The dock's tooltip and the Menu follow the new key; it was saved with the settings and survives a reload.
    await expect(page.locator('[data-hb="spellbook"]')).toHaveAttribute('data-tip', /U$/);
    await page.keyboard.press('Escape');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('godforge-sound') ?? '{}'));
    expect(saved.keys).toEqual({ spellbook: ['KeyU'] });
  });

  test('a clash shows, and Swap or Take it resolves it; Reset puts the defaults back', async ({ page }) => {
    await enter(page);
    await openControls(page);
    await row(page, 'spellbook').locator('button[data-slot="0"]').click();
    await page.keyboard.press('i');
    await expect(page.locator('[data-key-clash]')).toBeVisible();
    await expect(row(page, 'spellbook').locator('button[data-slot="0"]')).toHaveText('K');
    await page.locator('[data-clash="swap"]').click();
    await expect(row(page, 'spellbook').locator('button[data-slot="0"]')).toHaveText('I');
    await expect(row(page, 'bag').locator('button[data-slot="0"]')).toHaveText('K');
    await row(page, 'lore').locator('button[data-slot="0"]').click();
    await page.keyboard.press('i');
    await page.locator('[data-clash="clear"]').click();
    await expect(row(page, 'spellbook').locator('button[data-slot]')).toHaveCount(1);
    await expect(row(page, 'spellbook').locator('.kc--add')).toHaveText('none');
    await page.locator('[data-controls-reset]').click();
    await expect(row(page, 'spellbook').locator('button[data-slot="0"]')).toHaveText('K');
    await expect(row(page, 'lore').locator('button[data-slot="0"]')).toHaveText('L');
  });

  test('Esc cannot be bound, and cancels a listening row', async ({ page }) => {
    await enter(page);
    await openControls(page);
    await row(page, 'bag').locator('button[data-slot="0"]').click();
    await page.keyboard.press('Escape');
    await expect(row(page, 'bag').locator('button[data-slot="0"]')).toHaveText('I');
    await expect(page.locator('[data-controls]')).toBeVisible();
  });

  test('typing guard: a rebound key typed into a text field opens nothing and moves nothing', async ({ page }) => {
    await enter(page);
    await openControls(page);
    await row(page, 'spellbook').locator('button[data-slot="0"]').click();
    await page.keyboard.press('u');
    await page.keyboard.press('Escape');
    await focusWorld(page);
    const canvas = page.locator('canvas').first();
    const before = [await canvas.getAttribute('data-player-x'), await canvas.getAttribute('data-player-y')];
    // A text field that exists offline: the feedback sheet's message box.
    await openMenu(page);
    await page.locator('#game-menu [data-open="feedback"]').click();
    const field = page.locator('.feedback-host textarea').first();
    await field.click();
    await expect(field).toBeFocused();
    await page.keyboard.type('uuu kkk wasd');
    await expect(field).toHaveValue('uuu kkk wasd');
    await page.waitForTimeout(300);
    await expect(book(page)).toHaveCount(0);
    expect([await canvas.getAttribute('data-player-x'), await canvas.getAttribute('data-player-y')]).toEqual(before);
  });

  test('the bottom bar: eight skill slots with their keys, the belt, the menu buttons', async ({ page }) => {
    await enter(page);
    const bar = page.locator('[data-hud-bar]');
    await expect(bar).toBeVisible();
    await expect(bar.locator('.hb__slotkey')).toHaveText(['5', '6', '7', '8', '1', '2', '3', '4']);
    await expect(bar.locator('.td-pot')).toHaveCount(3);
    await expect(bar.locator('[data-xp-bar]')).toBeVisible();
    await expect(bar.locator('.td-dock button')).toHaveCount(8);
    await expect(bar.locator('[data-orb="hp"]')).toBeVisible();
    await expect(bar.locator('[data-orb="mana"]')).toBeVisible();
  });
});

test.describe('keys on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the Controls list is read-only, there is no desktop bar', async ({ page }) => {
    await enter(page);
    await expect(page.locator('[data-hud-bar]')).toHaveCount(0);
    await page.locator('[data-game-menu-toggle]').first().tap();
    await page.locator('#game-menu [data-open="controls"]').tap();
    await expect(page.locator('[data-controls]')).toBeVisible();
    await expect(page.locator('[data-controls] button[data-slot]')).toHaveCount(0);
  });
});

test.describe('keys in a narrow desktop window', () => {
  test.use({ viewport: { width: 800, height: 700 } });
  test('the bottom bar steps aside, the touch pieces stay', async ({ page }) => {
    await enter(page);
    await expect(page.locator('[data-hud-bar]')).toHaveCount(0);
    await expect(page.locator('.td-dock')).toBeVisible();
  });
});
