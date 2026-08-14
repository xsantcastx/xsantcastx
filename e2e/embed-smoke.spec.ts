import { test, expect } from '@playwright/test';

// Embed surface retired: every /embed URL lands on /world.

const retiredEmbeds = [
  '/embed/json-formatter',
  '/embed/gradient-generator',
  '/embed/uuid-generator',
];

for (const path of retiredEmbeds) {
  test(`retired embed ${path} redirects to /world`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/world/);
  });
}
