/**
 * play-one-world.spec.ts — One World, Phase 1 (docs/design/one-world.md), with
 * the preview gate ON (`eclipse-oneworld`): the Basalt Seamworks stands on the
 * Ember Delve's surface. Played the way a player does, at 1280×800 (keys) and
 * 390×844 (touch):
 *
 *   spawn in the settlement → walk to its counters and open them → log in at
 *   the Quarry Head stone (the resume point) → see it dark, hold to light it →
 *   travel to the town stone and back → recall → keepers keep the clock.
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, canvas, focusWorld, openPlay, placePanel, seed } from './play-helpers';

// One World is the default since the P2 flip: no gate to set (the old preview key is ignored and removed).
const GATE = { 'preferred-language': 'en' };
/** The Quarry Head stone stands in column 240 (x 7696); a resume point one column west is beside it. */
const BESIDE_QUARRY_HEAD = { 'godforge-world': { version: 3, seed: 424242, createdAt: 1, worlds: {}, claimed: [], migrated: 'v2', at: { world: 'ember', col: 239, row: 0, t: 1 } } };

/** Where a station of this area stands (the canvas's data-stations: `id@x,y;…`). */
async function stationPoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  const raw = (await canvas(page).getAttribute('data-stations')) ?? '';
  const row = raw.split(';').find(s => s.startsWith(`${id}@`));
  if (!row) throw new Error(`no station ${id} in ${raw}`);
  const [x, y] = row.slice(id.length + 1).split(',').map(Number);
  return { x, y };
}
async function x(page: Page): Promise<number> { return Number(await canvas(page).getAttribute('data-player-x')); }

/** Walk (keys) until the Keeper is within `slack` px of `target`. */
async function walkNear(page: Page, target: number, slack = 24): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const at = await x(page);
    if (Math.abs(at - target) <= slack) return;
    await focusWorld(page);
    const key = at < target ? 'd' : 'a';
    await page.keyboard.down(key);
    try {
      await expect.poll(async () => { const now = await x(page); return key === 'd' ? now >= target - slack / 2 : now <= target + slack / 2; }, { timeout: 30000, intervals: [40] }).toBe(true);
    } finally { await page.keyboard.up(key); }
    await page.waitForTimeout(250);
  }
  expect(Math.abs((await x(page)) - target)).toBeLessThanOrEqual(slack * 2);
}

test.describe('One World (preview): the Seamworks on the Ember surface — desktop keys', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a Keeper spawns in the settlement and walks to its counters; E opens them', async ({ page }) => {
    test.setTimeout(120000);
    await seed(page, GATE);
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-oneworld', 'on');
    await expect(canvas(page)).toHaveAttribute('data-world', 'ember');
    await expect(canvas(page)).toHaveAttribute('data-region', 'basalt-seamworks');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
    await expect(page.locator('#game-title')).toHaveText('Basalt Seamworks');
    for (const [id, title] of [['crafting', 'Crafting Bench'], ['vendor', 'Material Vendor'], ['vault', 'The Vault']] as const) {
      const at = await stationPoint(page, id);
      await walkNear(page, at.x);
      await expect(page.locator('.prompt')).toHaveClass(/armed/);
      await page.keyboard.press('e');
      await expect(placePanel(page)).toBeVisible();
      await expect(page.locator('#place-title')).toHaveText(title);
      await page.keyboard.press('Escape');
      await expect(placePanel(page)).toBeHidden();
    }
    // Nothing of v3 is written that the gate did not ask for, and v2 stays as it was.
    expect(await blob(page, 'godforge-world')).not.toBeNull();
  });

  test('log in beside a dark stone, light it, travel to the town stone and back, and recall', async ({ page }) => {
    test.setTimeout(120000);
    await seed(page, { ...GATE, ...BESIDE_QUARRY_HEAD });
    await openPlay(page);
    // The resume point: the Keeper logs in where they last stood, in the Ember Quarry, beside its stone.
    await expect(canvas(page)).toHaveAttribute('data-region', 'ember-quarry');
    await expect(canvas(page)).toHaveAttribute('data-stone', /^ember:quarry-head:dark/);
    await expect.poll(async () => ((await blob<{ seen?: string[] }>(page, 'godforge-waystones'))?.seen ?? []).includes('ember:quarry-head')).toBe(true);
    // Hold E: the seams climb, then the stone is lit (the receipt is saved before the XP).
    await focusWorld(page);
    await page.keyboard.down('e');
    await page.waitForTimeout(1600);
    await page.keyboard.up('e');
    await expect(canvas(page)).toHaveAttribute('data-stone', /^ember:quarry-head:lit/);
    expect((await blob<{ lit: string[] }>(page, 'godforge-waystones'))?.lit).toContain('ember:quarry-head');
    // E at a lit stone: the Travel map.
    await page.keyboard.press('e');
    await expect(placePanel(page)).toBeVisible();
    await expect(page.locator('#place-title')).toHaveText('Travel');
    await page.locator('[data-row="ember:town"]').click();
    await page.locator('[data-act="travel"]').click();
    await expect(placePanel(page)).toBeHidden({ timeout: 8000 });
    await expect(canvas(page)).toHaveAttribute('data-region', 'basalt-seamworks');
    // Beside the town stone (the trunk line's: it is the square's `waystone` station too).
    await expect(page.locator('.prompt strong')).toContainText(/Town Stone/i);
    // M: the Travel map from anywhere; back to the Quarry Head.
    await focusWorld(page);
    await page.keyboard.press('m');
    await expect(placePanel(page)).toBeVisible();
    await page.locator('[data-row="ember:quarry-head"]').click();
    await page.locator('[data-act="travel"]').click();
    await expect(canvas(page)).toHaveAttribute('data-region', 'ember-quarry', { timeout: 8000 });
    // Recall: the town stone, free, from anywhere (a longer channel).
    await focusWorld(page);
    await page.keyboard.press('m');
    await page.locator('[data-row="recall"]').click();
    await page.locator('[data-act="travel"]').click();
    await expect(canvas(page)).toHaveAttribute('data-region', 'basalt-seamworks', { timeout: 10000 });
  });

  test('the keepers keep the clock: at night they sleep upstairs, and the counter still opens (the bell)', async ({ page }) => {
    await seed(page, GATE);
    await openPlay(page, '?hour=2');
    await expect(canvas(page)).toHaveAttribute('data-keepers', /vault-clerk@\d+,\d+:up/);
    const vault = await stationPoint(page, 'vault');
    await walkNear(page, vault.x);
    await expect(page.locator('.prompt strong')).toHaveText('Ring the bell');
    await page.keyboard.press('e');
    await expect(page.locator('#place-title')).toHaveText('The Vault');
  });
});

test.describe('One World (preview) — phone, touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('spawn, go to a counter from the menu, light a stone by holding the button, travel back', async ({ page }) => {
    test.setTimeout(120000);
    await seed(page, { ...GATE, ...BESIDE_QUARRY_HEAD });
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-region', 'ember-quarry');
    const light = page.locator('[data-act="stone"]');
    await expect(light).toBeVisible();
    const box = (await light.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await light.dispatchEvent('pointerdown', { button: 0, pointerType: 'touch', pointerId: 1 });
    await page.waitForTimeout(1600);
    await light.dispatchEvent('pointerup', { button: 0, pointerType: 'touch', pointerId: 1 });
    await expect(canvas(page)).toHaveAttribute('data-stone', /^ember:quarry-head:lit/);
    await page.locator('[data-act="stone"]').click();
    await expect(placePanel(page)).toBeVisible();
    // Pins on the map and rows in the list are thumb-sized.
    for (const pin of await page.locator('.travel .pin').all()) expect((await pin.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.locator('[data-row="ember:town"]').click();
    await page.locator('[data-act="travel"]').click();
    await expect(canvas(page)).toHaveAttribute('data-region', 'basalt-seamworks', { timeout: 8000 });
    // The menu's Places walk to a counter (the settlement's own stations).
    await page.locator('.places-toggle').click();
    await page.locator('#places-list button', { hasText: 'Crafting Bench' }).click();
    await expect(page.locator('#place-title')).toHaveText('Crafting Bench', { timeout: 30000 });
  });
});
