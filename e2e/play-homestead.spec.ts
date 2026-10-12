/**
 * play-homestead.spec.ts — play the Homestead and the first minutes of the v3
 * economy in a real browser: strike the Forge with E, watch Gold rise, buy the
 * first building from the column, and upgrade the home Anvil.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, focusWorld, openPlay, purse, seed, walkTo } from './play-helpers';

async function enterHomestead(page: Page): Promise<void> {
  await walkTo(page, 1075, 40);
  await page.keyboard.press('e');
  await expect(canvas(page)).toHaveAttribute('data-area', 'Your Homestead');
}

function goldOf(text: string | null): number {
  const raw = (text ?? '').replace(/Gold/i, '').trim();
  const m = /([\d.,]+)\s*([KMBT]?)/i.exec(raw);
  if (!m) return NaN;
  const n = Number(m[1].replace(/,/g, ''));
  const mult = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase() as '' | 'K' | 'M' | 'B' | 'T'];
  return n * mult;
}

async function purseGold(page: Page): Promise<number> {
  return goldOf(await page.locator('.hc-purse').textContent());
}

async function openColumn(page: Page): Promise<void> {
  const toggle = page.locator('.hc-toggle');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(page.locator('.hc-rows')).toBeVisible();
  await focusWorld(page);
}

test.describe('Homestead, played', () => {
  test('fresh save: the first Forge Bellows is affordable within ~15 s of striking', async ({ page }) => {
    test.setTimeout(90000);
    await seed(page);
    await openPlay(page);
    await enterHomestead(page);
    await openColumn(page);
    // The Forge stands at x 720; strike it with E like a player at a human 5/s.
    await walkTo(page, 720, 60);
    const bellows = page.locator('.hc-row', { hasText: 'Forge Bellows' }).locator('.hc-buy');
    await expect(bellows).toBeVisible();
    const start = Date.now();
    const before = await purseGold(page);
    let affordable = false;
    while (Date.now() - start < 20000) {
      await focusWorld(page);
      await page.keyboard.press('e');
      await page.waitForTimeout(200);
      if (await bellows.isEnabled()) { affordable = true; break; }
    }
    const seconds = (Date.now() - start) / 1000;
    test.info().annotations.push({ type: 'pacing', description: `first Bellows affordable after ${seconds.toFixed(1)} s of striking` });
    console.log(`pacing: first Bellows affordable after ${seconds.toFixed(1)} s`);
    expect(affordable, 'Bellows never became affordable').toBe(true);
    expect(seconds).toBeLessThanOrEqual(15);
    expect(await purseGold(page)).toBeGreaterThan(before);
    await bellows.click();
    await expect(page.locator('.hc-notice')).toContainText(/Forge Bellows built/);
    await expect(page.locator('.hc-row', { hasText: 'Forge Bellows' })).toContainText('x1');
  });

  test('clicking the Forge on the canvas strikes it and Gold rises', async ({ page }) => {
    test.setTimeout(60000);
    await seed(page);
    await openPlay(page);
    await enterHomestead(page);
    await openColumn(page);
    await walkTo(page, 720, 60);
    const before = await purseGold(page);
    // Find the Forge the way a mouse player does: hover until the station card names it.
    const box = (await canvas(page).boundingBox())!;
    const tip = page.locator('.station-tip b');
    let spot: { x: number; y: number } | null = null;
    for (let fy = 0.3; fy <= 0.9 && !spot; fy += 0.05) {
      for (let fx = 0.2; fx <= 0.8 && !spot; fx += 0.05) {
        const x = box.x + box.width * fx, y = box.y + box.height * fy;
        await page.mouse.move(x, y);
        if (await tip.isVisible() && /forge/i.test(await tip.textContent() ?? '')) spot = { x, y };
      }
    }
    expect(spot, 'hovering never named the Forge').not.toBeNull();
    let gained = false;
    for (let i = 0; i < 5 && !gained; i++) {
      await page.mouse.click(spot!.x, spot!.y);
      await page.waitForTimeout(200);
      gained = (await purseGold(page)) > before;
    }
    expect(gained, 'no click on the canvas struck the Forge').toBe(true);
  });

  test('buy a building from the column: owned count, rate and purse move', async ({ page }) => {
    test.setTimeout(60000);
    await seed(page, purse(5_000));
    await openPlay(page);
    await enterHomestead(page);
    await openColumn(page);
    const row = page.locator('.hc-row', { hasText: 'Ember Stoker' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('x0');
    const before = await purseGold(page);
    await row.locator('.hc-buy').click();
    await expect(page.locator('.hc-notice')).toContainText(/Ember Stoker built/);
    await expect(row).toContainText('x1');
    await expect.poll(() => purseGold(page)).toBeLessThan(before);
    // The rate under the purse is now positive.
    await expect(page.locator('.hc-toggle small')).toContainText(/[1-9]/);
  });

  test('home Anvil tier upgrade from the column, kept over a reload', async ({ page }) => {
    test.setTimeout(90000);
    await seed(page, purse(6_000_000));
    await openPlay(page);
    await enterHomestead(page);
    await openColumn(page);
    const anvil = page.locator('.hc-row--home').first();
    await expect(anvil).toContainText(/Anvil/);
    await expect(anvil).toContainText(/Tier I(?!I)/);
    const button = anvil.locator('.hc-buy--home');
    await expect(button).toBeEnabled();
    await expect(button).toContainText(/II/);
    const before = await purseGold(page);
    await button.click();
    await expect(page.locator('.hc-notice')).toBeVisible();
    await expect(anvil).toContainText(/Tier II(?!I)/);
    await expect.poll(() => purseGold(page)).toBeLessThanOrEqual(before - 4_000_000);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('godforge-home-forge') || '{}').anvil)).toBe(2);
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/);
    await page.waitForTimeout(400);
    await focusWorld(page);
    // Back in town after a reload: walk to the plot again.
    if ((await canvas(page).getAttribute('data-area')) !== 'Your Homestead') await enterHomestead(page);
    await openColumn(page);
    await expect(page.locator('.hc-row--home').first()).toContainText(/Tier II(?!I)/);
  });
});
