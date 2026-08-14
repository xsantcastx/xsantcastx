import { expect, test, type Page } from '@playwright/test';

async function openSettled(page: Page, url: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.sessionStorage.setItem('visit-counted', '1');
  });
  await page.goto(url, { waitUntil: 'load' });
}

test.describe('Quick Inspect', () => {
  test('desktop side dialog opens from Market and keeps filters', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSettled(page, '/market');
    const inspect = page.locator('app-inspect-button').first();
    await expect(inspect).toBeVisible();
    await inspect.click();
    await expect(page).toHaveURL(/inspect=market-listing:/);
    const dialog = page.locator('.qi');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#qi-title')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.qi :focus')).toHaveCount(1);
    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(360);
    expect(box?.width ?? 0).toBeLessThanOrEqual(440);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/inspect=/);
  });

  test('375px uses a bottom sheet and reduced motion still shows state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSettled(page, '/world?inspect=realm:luminous');
    const dialog = page.locator('.qi');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.qi-root')).toHaveClass(/qi-root--sheet/);
    await expect(dialog).toContainText('Heliograph Court');
    await expect.poll(async () =>
      dialog.evaluate(el => getComputedStyle(el).animationName),
    ).toBe('none');
  });

  test('unknown inspect ids stay on the source page', async ({ page }) => {
    await openSettled(page, '/market?inspect=item:does-not-exist');
    await expect(page).toHaveURL(/\/market/);
    await expect(page.locator('#qi-title')).toHaveText('Record unavailable');
    await page.getByRole('button', { name: 'Close' }).first().click();
    await expect(page.locator('.qi')).toHaveCount(0);
  });

  test('Back closes Inspect before leaving the page', async ({ page }) => {
    await openSettled(page, '/world');
    await page.locator('app-inspect-button').first().click();
    await expect(page).toHaveURL(/inspect=realm:/);
    await page.goBack();
    await expect(page.locator('.qi')).toHaveCount(0);
    await expect(page).toHaveURL(/\/world/);
    await expect(page).not.toHaveURL(/inspect=/);
  });
});
