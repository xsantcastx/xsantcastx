/**
 * td-chat-box.spec.ts — the OSRS-style chat box (owner 2026-10-20): Game tab lines from the HUD (no server), a Chat tab
 * for the Hearth room, hide to a tab and back. Screenshot: docs/handoff/cozy-ui/chat-box.jpg.
 */
import { expect, test } from '@playwright/test';
import { seed } from './play-helpers';

test('the chat box: the Game tab hears the world, hides to a tab and comes back', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  const box = page.locator('.td-chat');
  await expect(box).toBeVisible();
  // Sail: the engine says so, and the Game tab keeps the line.
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button', { hasText: /ship to pyrehold/i }).first().click();
  await expect(page.locator('canvas').first()).toHaveAttribute('data-area', /pyrehold/i, { timeout: 30000 });
  await expect(box.locator('.td-chat__game').first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'docs/handoff/cozy-ui/chat-box.jpg', type: 'jpeg', quality: 78 });
  await box.locator('.td-chat__x').click();
  await expect(page.locator('.td-chat-tab')).toBeVisible();
  await page.locator('.td-chat-tab').click();
  await expect(box).toBeVisible();
});
