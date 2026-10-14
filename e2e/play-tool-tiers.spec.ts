/**
 * play-tool-tiers.spec.ts — owner report 2026-10-13: "I equipped a pickaxe and
 * mining speed is still the same… how do I see my character's stats?"
 *
 * Played in a real browser: a fresh save holds the Worn Pickaxe (the starter
 * pace, 0.52 s); forging Pickaxe I makes the swing faster (0.46 s) without
 * equipping it; the satchel card and Character & stats → Tools both say so.
 * The pace is read off the canvas (`data-swing-pickaxe`, written from the same
 * value the engine is handed) — the production build has no `ng` global.
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, canvas, focusWorld, openPlay, placePanel, purse, seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

const exactName = (name: string) => new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`);

async function craftPickaxeI(page: Page): Promise<void> {
  await openPlay(page, '?at=crafting');
  const panel = placePanel(page);
  await expect(panel.locator('.cb-hero')).toBeVisible({ timeout: 15000 });
  await panel.getByText('Details', { exact: true }).click();
  await panel.getByPlaceholder('Search recipes and materials').fill('Pickaxe');
  await panel.locator('.cb-card', { hasText: exactName('Pickaxe I') }).first().click();
  await expect(panel.locator('.cb-hero .dh__name')).toHaveText('Pickaxe I');
  // The recipe card: power, pace, what it opens, and the satchel rule.
  const card = panel.locator('.cb-hero .cb-tool');
  await expect(card).toContainText('Mining power 1');
  await expect(card).toContainText('0.46 s per swing');
  await expect(card).toContainText('Digs Cinder veins');
  await expect(card).toContainText('Tools work from your satchel — no need to equip.');
  const make = panel.locator('.cb-hero .ab__btn');
  await expect(make).not.toHaveAttribute('aria-disabled', 'true');
  await make.click();
  const skip = panel.locator('app-anvil-game .mg__skip');
  const reward = panel.locator('app-reward-pop .rp');
  await expect(skip.or(reward)).toBeVisible({ timeout: 15000 });
  if (await skip.isVisible()) await skip.click();
  await expect(reward).toContainText('Pickaxe I', { timeout: 20000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
}

async function slipFor(page: Page, name: string) {
  await focusWorld(page);
  await page.keyboard.press('i');
  const book = page.locator('#satchel-book');
  await expect(book).toBeVisible();
  await book.locator('.pocket', { hasText: '' }).and(page.locator(`[aria-label="${name}"]`)).first().click();
  const slip = book.locator('.slip');
  await expect(slip.locator('h3')).toHaveText(name);
  return slip;
}

test.describe('tool tiers: a forged pickaxe swings faster, and the stats say so', () => {
  test('fresh save holds the Worn Pickaxe; Pickaxe I swings faster from the satchel; Character & stats shows it', async ({ page }) => {
    await seed(page, { ...bag({ 'cinder-ore': 8, 'starlight-herb': 2 }), ...purse(10_000) });
    await openPlay(page);
    // A fresh save is handed the starter set: it digs at the slowest pace.
    await expect(canvas(page)).toHaveAttribute('data-swing-pickaxe', '0.52', { timeout: 10000 });
    const worn = await slipFor(page, 'Worn Pickaxe');
    await expect(worn).toContainText('0.52 s per swing (slowest)');
    await expect(worn).toContainText('Tools work from your satchel — no need to equip.');
    await page.keyboard.press('Escape');

    await craftPickaxeI(page);
    // Not equipped — just held — and the swing is faster.
    await expect(canvas(page)).toHaveAttribute('data-swing-pickaxe', '0.46', { timeout: 10000 });
    const forged = await slipFor(page, 'Pickaxe I');
    await expect(forged).toContainText('Mining power 1');
    await expect(forged).toContainText('0.46 s per swing');
    await expect(forged).toContainText('Digs Cinder veins');
    await expect(forged.getByRole('button', { name: 'Equip', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Character & stats from the top bar's Places menu → the Tools block.
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button[data-open="character"]').click();
    const tools = placePanel(page).locator('app-tool-stats');
    await expect(tools).toBeVisible({ timeout: 15000 });
    await expect(tools).toContainText('Tools work from your satchel — no need to equip.');
    const pick = tools.locator('.tst__row[data-family="pickaxe"]');
    await expect(pick).toContainText('Pickaxe · tier I');
    await expect(pick).toContainText('0.46 s per swing');
    await expect(tools.locator('.tst__row[data-family="axe"]')).toContainText('0.52 s per swing (slowest)');
  });

  test('Mining 42 sharpens the Worn Pickaxe: a faster swing, a harder hit, and the cards show the split', async ({ page }) => {
    await seed(page, { ...bag({ 'cinder-ore': 2 }), ...activity({ mining: xpForLevel(42) }) });
    await openPlay(page);
    // 0.52 × (1 − 0.25 × 41/98) = 0.466; power 1 × (1 + 0.5 × 41/98) = 1.21.
    await expect(canvas(page)).toHaveAttribute('data-swing-pickaxe', '0.47', { timeout: 10000 });
    await expect(canvas(page)).toHaveAttribute('data-power-pickaxe', '1.21');
    const worn = await slipFor(page, 'Worn Pickaxe');
    await expect(worn).toContainText('Swing 0.47 s (tool 0.52 · Mining 42 −10%)');
    await expect(worn).toContainText('Power ×1.21 (tool ×1 · Mining 42 +21%)');
    await page.keyboard.press('Escape');
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button[data-open="character"]').click();
    const tools = placePanel(page).locator('app-tool-stats');
    await expect(tools).toBeVisible({ timeout: 15000 });
    await expect(tools.locator('.tst__row[data-family="pickaxe"]')).toContainText('Swing 0.47 s (tool 0.52 · Mining 42 −10%)');
    // Woodcutting is still 1: the axe keeps the plain starter line.
    await expect(tools.locator('.tst__row[data-family="axe"]')).toContainText('0.52 s per swing (slowest)');
  });

  test('phones: the ☰ menu has Character & stats, a thumb-sized entry', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page);
    await openPlay(page);
    await page.locator('.places-toggle').first().click();
    const entry = page.locator('#places-list button[data-open="character"]');
    await expect(entry).toContainText('Character & stats');
    await expect(entry).toBeVisible();
    const box = await entry.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await entry.click();
    await expect(placePanel(page).locator('app-tool-stats')).toBeVisible({ timeout: 15000 });
  });
});
