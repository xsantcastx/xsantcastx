import { expect, test, type Page } from '@playwright/test';
import { INVENTORY_ERA } from '../src/app/shared/rpg/inventory.model';

// The engine caps a frame delta at 100 ms. Advance one frame deliberately so
// software-rendered CI and a busy GPU exercise the same simulation time.
async function openWorld(page: Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-10-10T12:00:00Z') });
  await page.goto('/play');
  await expect(page.locator('.viewport canvas')).toHaveAttribute('data-player-x', '160');
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 100));
}

async function walk(page: Page, key: 'a' | 'd', target: number): Promise<void> {
  const canvas = page.locator('.viewport canvas');
  await page.keyboard.down(key);
  try {
    await expect.poll(async () => {
      await page.clock.fastForward(100);
      const x = Number(await canvas.getAttribute('data-player-x'));
      return key === 'd' ? x > target : x < target;
    }, { timeout: 60000, intervals: [0] }).toBe(true);
  } finally {
    await page.keyboard.up(key);
  }
}

test('fresh Keeper mines, forges and manages the blade in the satchel', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => localStorage.setItem('xsantcastx_consent', 'denied'));
  await openWorld(page);
  const canvas = page.locator('.viewport canvas');
  await expect(canvas).toHaveAttribute('data-player-x', '160');
  await walk(page, 'd', 390);
  const interact = page.getByRole('button', { name: 'Interact', exact: true });
  for (let count = 1; count <= 8; count++) {
    await page.clock.fastForward(3500);
    await expect(interact).toBeEnabled();
    await interact.click();
    await expect(page.locator('.satchel p').filter({ hasText: 'Cinder ore' }).locator('b')).toHaveText(String(count));
  }
  await walk(page, 'd', 840);
  await interact.click();
  await page.keyboard.press('i');
  const book = page.locator('#satchel-book');
  await expect(book).toBeVisible();
  await book.getByRole('button', { name: 'Basalt Edge', exact: true }).click();
  await book.getByRole('button', { name: 'Equip', exact: true }).click();
  await expect(page.locator('.satchel p').filter({ hasText: 'Edge' }).locator('b')).toHaveText('Worn');
  await book.getByRole('button', { name: 'Stow', exact: true }).click();
  await expect(page.locator('.satchel p').filter({ hasText: 'Edge' }).locator('b')).toHaveText('Satchel');
  await page.reload();
  await page.clock.fastForward(100);
  await expect(page.locator('.satchel p').filter({ hasText: 'Edge' }).locator('b')).toHaveText('Satchel');
  await page.keyboard.press('i');
  await expect(book).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(book).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
});

test('world renders, permits backtracking through portals, and restarts without a soft lock', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(era => {
    localStorage.setItem('xsantcastx_consent', 'denied');
    localStorage.setItem('eclipse-seamworks-world-v1', JSON.stringify({ restored: true, era, resetAt: null }));
  }, INVENTORY_ERA);
  await openWorld(page);
  const canvas = page.locator('.viewport canvas');
  await expect.poll(() => canvas.evaluate(c => (c as HTMLCanvasElement).getContext('2d')!.getImageData(10, 10, 1, 1).data[3])).toBe(255);
  await walk(page, 'd', 2500);
  await page.keyboard.press('e');
  await expect(canvas).toHaveAttribute('data-area', 'Ember Quarry');
  await walk(page, 'a', 200);
  await page.keyboard.press('e');
  await expect(canvas).toHaveAttribute('data-area', 'Basalt Seamworks');
  await page.getByRole('button', { name: 'Return to camp', exact: true }).first().click();
  await expect(canvas).toHaveAttribute('data-player-x', '160');
  await walk(page, 'd', 220);
  await page.getByRole('button', { name: 'Restart hunt', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-player-x', '160');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Game paused')).toHaveCount(0);
  await walk(page, 'd', 220);
});
