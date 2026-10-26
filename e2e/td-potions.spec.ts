/**
 * td-potions.spec.ts — the potion belt (shared/potions): Q drinks the best Health potion held, R the best Mana potion,
 * one sip every two seconds; the belt sits beside the skill bar on a desktop and as two buttons on a phone; the hover
 * card says what a potion does; Edrin Kade's counter (the Material Vendor) sells them for Gold.
 * Screenshots land in docs/handoff/cozy-ui/potions-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed, stackQty } from './play-helpers';

const BAG = { 'minor-health-potion': 3, 'lesser-health-potion': 2, 'minor-mana-potion': 4, 'cinder-ore': 2 };

async function open(page: Page, gold = 0): Promise<void> {
  await seed(page, {
    'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), 'godforge-inventory': ledger(BAG),
    ...(gold ? { 'godforge-economy': { version: 3, goldEra: 1, gold, totalGoldEarned: gold, runGoldEarned: gold } } : {}),
  });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await expect(page.locator('.td-belt')).toBeVisible({ timeout: 10000 });
}

const slot = (page: Page, kind: 'health' | 'mana') => page.locator(`.td-pot[data-kind="${kind}"]`);

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Q drinks the best Health potion, R a Mana potion, one sip every two seconds', async ({ page }) => {
    await open(page);
    // The belt shows the best potion held for each key, with its count.
    await expect(slot(page, 'health').locator('.td-pot__n')).toHaveText('2');
    await expect(slot(page, 'mana').locator('.td-pot__n')).toHaveText('4');
    await expect(slot(page, 'health')).toHaveAttribute('aria-label', /Lesser Health Potion \(Q\)/);
    await page.screenshot({ path: 'docs/handoff/cozy-ui/potions-belt-1280x800.jpg', type: 'jpeg', quality: 80 });

    await page.keyboard.press('q');
    await expect.poll(() => stackQty(page, 'lesser-health-potion')).toBe(1);
    await expect(slot(page, 'health').locator('.td-pot__n')).toHaveText('1');
    // Straight away again: still swallowing, nothing spent.
    await page.keyboard.press('r');
    await page.waitForTimeout(300);
    expect(await stackQty(page, 'minor-mana-potion')).toBe(4);
    await expect(page.locator('.td-toast')).toContainText(/swallowing/i);
    // After the cooldown, R drinks.
    await page.waitForTimeout(2000);
    await page.keyboard.press('r');
    await expect.poll(() => stackQty(page, 'minor-mana-potion')).toBe(3);
    // The last Lesser goes, then Q falls back to the Minor ones.
    await page.waitForTimeout(2100);
    await page.keyboard.press('q');
    await expect.poll(() => stackQty(page, 'lesser-health-potion')).toBe(0);
    await expect(slot(page, 'health')).toHaveAttribute('aria-label', /Minor Health Potion \(Q\)/);
    await expect(slot(page, 'health').locator('.td-pot__n')).toHaveText('3');
  });

  test('the hover card says what a potion does and which key drinks it', async ({ page }) => {
    await open(page);
    await page.keyboard.press('i');
    const cell = page.locator('button.pocket[aria-label^="Minor Mana Potion"]').first();
    await expect(cell).toBeVisible({ timeout: 10000 });
    await cell.hover();
    const card = page.locator('.d2tip');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Pours back 30 mana');
    await expect(card).toContainText('Drink: R');
    const box = (await card.boundingBox())!;
    await page.screenshot({ path: 'docs/handoff/cozy-ui/potions-card.jpg', type: 'jpeg', quality: 80,
      clip: { x: Math.max(0, box.x - 120), y: Math.max(0, box.y - 60), width: Math.min(1280 - Math.max(0, box.x - 120), box.width + 200), height: Math.min(800 - Math.max(0, box.y - 60), box.height + 100) } });
  });

  test('Edrin Kade sells potions for Gold at his General Store', async ({ page }) => {
    await open(page, 1000);
    await page.keyboard.press('e');
    await expect(page).toHaveURL(/[?&]at=shop-general/, { timeout: 10000 });
    const offer = page.locator('[data-shop-shelf] [data-offer="gen-minor-health"]');
    await expect(offer).toBeVisible();
    await offer.click();
    await page.screenshot({ path: 'docs/handoff/cozy-ui/potions-vendor-1280x800.jpg', type: 'jpeg', quality: 80 });
    await page.locator('[data-shop-buy]').click();
    await expect.poll(() => stackQty(page, 'minor-health-potion')).toBe(4);
  });
});

for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) test.describe(`phone ${size.width}x${size.height}`, () => {
  test.use({ viewport: size, hasTouch: true, isMobile: true });

  test('two potion buttons, clear of the spells, the menu grid and the chat; a tap drinks', async ({ page }) => {
    await open(page);
    await page.screenshot({ path: `docs/handoff/cozy-ui/potions-belt-${size.width}x${size.height}.jpg`, type: 'jpeg', quality: 80 });
    const belt = (await page.locator('.td-belt').boundingBox())!;
    for (const other of ['.td-skills', '.td-dock', '.td-chat', '.td-chat-tab', '.touch-act']) {
      const el = page.locator(other).first();
      if (!(await el.isVisible().catch(() => false))) continue;
      const b = (await el.boundingBox())!;
      const overlap = belt.x < b.x + b.width && b.x < belt.x + belt.width && belt.y < b.y + b.height && b.y < belt.y + belt.height;
      expect(overlap, `potion belt overlaps ${other}`).toBe(false);
    }
    for (const kind of ['health', 'mana'] as const) {
      const b = (await slot(page, kind).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    expect(belt.y + belt.height).toBeLessThanOrEqual(size.height);
    await slot(page, 'health').tap();
    await expect.poll(() => stackQty(page, 'lesser-health-potion')).toBe(1);
  });

  test('the General Store\'s potion has its Buy button in plain view', async ({ page }) => {
    await open(page, 1000);
    await page.keyboard.press('e');
    await expect(page).toHaveURL(/[?&]at=shop-general/, { timeout: 10000 });
    await page.locator('[data-shop-shelf] [data-offer="gen-minor-health"]').tap();
    const buy = page.locator('[data-shop-buy]');
    await buy.scrollIntoViewIfNeeded();
    await expect(buy).toBeInViewport();
    await page.screenshot({ path: `docs/handoff/cozy-ui/potions-vendor-${size.width}x${size.height}.jpg`, type: 'jpeg', quality: 80 });
    await buy.tap();
    await expect.poll(() => stackQty(page, 'minor-health-potion')).toBe(4);
  });
});
