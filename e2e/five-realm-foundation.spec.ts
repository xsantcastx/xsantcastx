import { test, expect } from '@playwright/test';

test.describe('five-realm World foundation', () => {
  test('World names the five places and continues in Luminous', async ({ page }) => {
    await page.goto('/world', { waitUntil: 'load' });
    await expect(page.locator('.gf-station__name')).toHaveText([
      'Luminous', 'Celestial', 'Infernal', 'Umbral', 'Verdant',
    ]);
    await expect(page.locator('.gf-door--primary')).toHaveAttribute('href', /\/world\/realms\/luminous/);
    await expect(page.locator('.gf-door--primary')).toContainText('Enter Luminous');
  });

  test('a realm dossier exposes inspectable static narrative', async ({ page }) => {
    await page.goto('/world/realms/luminous', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('Luminous');
    await expect(page.locator('#rl-faction')).toHaveText('The Dawn Archive');
    await expect(page.locator('.rl__dl')).toContainText('Heliograph Court');
    await expect(page.locator('.rl__dl')).toContainText('Afterimage drift');
    await expect(page.locator('.rl__dl')).toContainText('Dawn glass');
    await expect(page.locator('.rl__dl')).toContainText('The Pale Refrain');
    await expect(page.locator('#rl-conflict')).toBeVisible();
    await expect(page.locator('.rl__continue')).toHaveAttribute('href', /\/world\/realms\/celestial/);
  });

  test('an unknown realm id stays honest', async ({ page }) => {
    await page.goto('/world/realms/verge', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('This place is not on the map');
    await expect(page.locator('a[href="/world"]')).toBeVisible();
  });

  test('Fivefold Lock is inspectable and locked', async ({ page }) => {
    await page.goto('/world/fivefold-lock', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('The Fivefold Lock');
    await expect(page.locator('.fl__status')).toContainText('Locked');
  });
});
