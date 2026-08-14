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

  test('the atlas opens existing dossiers from hotspots and the mobile list', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/world', { waitUntil: 'load' });
    const map = page.locator('.atlas__link');
    await expect(map).toHaveCount(5);
    await expect(map.nth(1)).toHaveAttribute('href', /\/world\/realms\/luminous/);
    await expect(map.nth(1)).toHaveAttribute(
      'aria-label',
      'Luminous Realm — dawn-lit terraces, prism spires, and crystal light',
    );
    await map.nth(1).focus();
    await expect(map.nth(1)).toBeFocused();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () =>
      page.locator('.atlas__pin').first().evaluate(el => getComputedStyle(el).animationName),
    ).toBe('none');

    await page.setViewportSize({ width: 375, height: 812 });
    const list = page.locator('.atlas__item');
    await expect(list).toHaveCount(5);
    await expect(list.nth(4)).toBeVisible();
    await expect(list).toContainText([
      'Celestial Realm',
      'Luminous Realm',
      'Infernal Realm',
      'Umbral Realm',
      'Verdant Realm',
    ]);
    await list.nth(4).click();
    await expect(page).toHaveURL(/\/world\/realms\/verdant/);
    await expect(page.locator('h1')).toHaveText('Verdant');
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
