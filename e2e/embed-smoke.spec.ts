import { test, expect } from '@playwright/test';

// Embed surface retired: every /embed URL lands in the game (/play).

const retiredEmbeds = [
  '/embed/json-formatter',
  '/embed/gradient-generator',
  '/embed/uuid-generator',
];

for (const path of retiredEmbeds) {
  test(`retired embed ${path} redirects to /play`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/play/);
  });
}
