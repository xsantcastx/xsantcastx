/**
 * td-feedback.spec.ts — the Game Menu and "Send feedback" (owner's backlog 2026-10-21).
 *
 * The Map shows only the map; the Game Menu (Esc, or the Menu button) holds the Keeper's own things and the settings,
 * grouped, with Send feedback among the settings. The form is a short cozy sheet: type, a note of 10–1000 characters, an
 * optional screenshot of the canvas shown before it goes. A guest is told plainly that feedback needs a signed-in Keeper
 * (the rules cannot rate-limit an anonymous create); the send itself is specced against a stubbed Firestore (karma).
 * Screenshots: docs/handoff/cozy-ui/feedback-{desktop,phone}.jpg, menu-game.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { openMenu, seed } from './play-helpers';

const canvas = (page: Page) => page.locator('.viewport canvas');
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

async function boot(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
}

async function form(page: Page, shot: string): Promise<void> {
  await openMenu(page);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/menu-game.jpg', type: 'jpeg', quality: 86 });
  await page.locator('#game-menu [data-open="feedback"]').click();
  const sheet = page.locator('[data-feedback]');
  await expect(sheet).toBeVisible();
  // A guest: told so, and Send waits.
  await expect(page.locator('[data-feedback-signin]')).toBeVisible();
  await expect(page.locator('[data-feedback-send]')).toBeDisabled();
  await page.locator('[data-feedback-type="idea"]').click();
  await expect(page.locator('[data-feedback-type="idea"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('[data-feedback-message]').fill('More fireflies by the Seamworks fountain at dusk, please.');
  await expect(page.locator('[data-feedback-count]')).toContainText('/ 1000');
  await page.locator('[data-feedback-shot]').check();
  await expect(page.locator('[data-feedback-preview]')).toBeVisible();
  // The picture fits the budget: 150 KB of JPEG at most.
  const bytes = await page.locator('[data-feedback-preview]').evaluate(img => Math.floor(((img as HTMLImageElement).src.split(',')[1] ?? '').length * 3 / 4));
  expect(bytes).toBeGreaterThan(500);
  expect(bytes).toBeLessThanOrEqual(150 * 1024);
  await page.screenshot({ path: shot, type: 'jpeg', quality: 88 });
}

test('the Map holds only the map, and the Game Menu holds the rest', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page);
  await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
  await page.keyboard.press('m');
  await expect(page.locator('#places-list')).toBeVisible();
  await expect(page.locator('#places-list [data-open]')).toHaveCount(0);
  await openMenu(page);
  await expect(page.locator('#places-list')).toHaveCount(0);
  for (const k of ['character', 'glass', 'bestiary', 'lore', 'friends', 'sound', 'loot', 'account', 'feedback', 'characters']) {
    await expect(page.locator(`#game-menu [data-open="${k}"]`), k).toBeVisible();
  }
  // Each row is a big target.
  const small = await page.locator('#game-menu [data-open]').evaluateAll(els => els.filter(e => e.getBoundingClientRect().height < 44).length);
  expect(small).toBe(0);
  // Escape folds it; Escape again opens it.
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-menu')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-menu')).toBeVisible();
});

test('the feedback form on a desktop', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page);
  await form(page, 'docs/handoff/cozy-ui/feedback-desktop.jpg');
});

test('the feedback form on a phone', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, baseURL: String(info.project.use.baseURL), storageState: info.project.use.storageState as never });
  const page = await ctx.newPage();
  try {
    await boot(page);
    await form(page, 'docs/handoff/cozy-ui/feedback-phone.jpg');
    // The Send button is the last control and is reachable.
    const send = page.locator('[data-feedback-send]');
    await send.scrollIntoViewIfNeeded();
    const r = (await send.boundingBox())!;
    expect(r.y + r.height).toBeLessThanOrEqual(844);
  } finally { await ctx.close(); }
});
