import { expect, test } from '@playwright/test';
import { INVENTORY_ERA } from '../src/app/shared/rpg/inventory.model';

test('world renders, permits backtracking through portals, and restarts without a soft lock', async ({ page }) => {
  test.setTimeout(45000);
  await page.addInitScript(era => {
    localStorage.setItem('xsantcastx_consent', 'denied');
    localStorage.setItem('eclipse-seamworks-world-v1', JSON.stringify({ restored: true, era, resetAt: null }));
  }, INVENTORY_ERA);
  await page.goto('/play');
  const canvas = page.locator('.viewport canvas');
  await expect.poll(() => canvas.evaluate(c => (c as HTMLCanvasElement).getContext('2d')!.getImageData(10, 10, 1, 1).data[3])).toBe(255);
  await page.keyboard.down('d');
  await expect.poll(async () => Number(await canvas.getAttribute('data-player-x')), { timeout: 15000 }).toBeGreaterThan(2500);
  await page.keyboard.up('d');
  await page.keyboard.press('e');
  await expect(canvas).toHaveAttribute('data-area', 'Ember Quarry');
  await page.keyboard.down('a');
  await expect.poll(async () => Number(await canvas.getAttribute('data-player-x'))).toBeLessThan(200);
  await page.keyboard.up('a');
  await page.keyboard.press('e');
  await expect(canvas).toHaveAttribute('data-area', 'Basalt Seamworks');
  await page.getByRole('button', { name: 'Return to camp', exact: true }).first().click();
  await expect(canvas).toHaveAttribute('data-player-x', '160');
  await page.keyboard.down('d');
  await expect.poll(async () => Number(await canvas.getAttribute('data-player-x'))).toBeGreaterThan(220);
  await page.keyboard.up('d');
  await page.getByRole('button', { name: 'Restart hunt', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-player-x', '160');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Game paused')).toHaveCount(0);
  await page.keyboard.down('d');
  await expect.poll(async () => Number(await canvas.getAttribute('data-player-x'))).toBeGreaterThan(220);
  await page.keyboard.up('d');
});
