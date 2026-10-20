/**
 * play-top-down.spec.ts — the top-down Seamworks square (docs/design/top-down.md, Phase 1),
 * behind the `?td=1` gate: the Keeper walks 8 ways, keepers stand at their stalls, E opens
 * the stall in reach through the same panels the side view used, the side view's arrow
 * and jump buttons give way to the drag joystick, and nothing ever drops the Keeper into the old 2D view.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const px = async (page: Page) => Number(await canvas(page).getAttribute('data-player-x'));
const py = async (page: Page) => Number(await canvas(page).getAttribute('data-player-y'));

async function openTopDown(page: Page): Promise<void> {
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12');
  // The top-down engine reports a position inside the square (the side view starts on its floor at y 610).
  await expect.poll(() => py(page), { timeout: 20000 }).toBeLessThan(560);
}

for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`top-down square at ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test('the Keeper walks with the keys, both axes', async ({ page }) => {
      await openTopDown(page);
      const x0 = await px(page), y0 = await py(page);
      await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(700); await page.keyboard.up('ArrowLeft');
      await expect.poll(() => px(page)).toBeLessThan(x0 - 10);
      await page.keyboard.down('ArrowDown'); await page.waitForTimeout(500); await page.keyboard.up('ArrowDown');
      await expect.poll(() => py(page)).toBeGreaterThan(y0 + 5);
    });

    test('E opens the stall in reach (the Material Vendor) through its usual panel', async ({ page }) => {
      await openTopDown(page);
      await page.keyboard.press('e');
      await expect(page).toHaveURL(/[?&]at=vendor/, { timeout: 10000 });
    });

    test('the side view\'s arrow and jump buttons are not shown', async ({ page }) => {
      await openTopDown(page);
      await expect(page.locator('.tb--left')).toHaveCount(0);
      await expect(page.locator('.tb--jump')).toHaveCount(0);
    });
  });
}

test('the Cinder Ore seam is mined in the square (no detour into the old view)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openTopDown(page);
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button', { hasText: /cinder ore/i }).first().click();
  await expect(page.locator('.td-toast')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.stage')).toHaveClass(/stage--td/);
  await expect.poll(() => py(page)).toBeLessThan(560);
});

test('down the mine shaft to the hand-drawn Ember Mine and up its ladder, all top-down, nothing throws', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await openTopDown(page);
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button', { hasText: /ember delve/i }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', /ember mine/i, { timeout: 20000 });
  await expect(page.locator('.stage')).toHaveClass(/stage--td/);
  await expect(page.locator('.stage')).not.toHaveClass(/stage--delve/);
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button', { hasText: /ladder up/i }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', /basalt seamworks/i, { timeout: 20000 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('in the Ember Mine a Rivet Maw fights back, falls, and its coins are picked up off the floor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await openTopDown(page);
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button', { hasText: /ember delve/i }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', /ember mine/i, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const coins = async () => Number((await page.locator('.satchel .coin-count').first().textContent())?.replace(/\D/g, '') || 0);
  const before = await coins();
  // North into the flooded cave, swinging (J): the Maw there comes to meet the Keeper.
  await canvas(page).focus();
  await page.keyboard.down('j');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1600); await page.keyboard.up('ArrowUp');
  await expect.poll(coins, { timeout: 20000 }).toBeGreaterThan(before);
  await page.keyboard.up('j');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Ember Mine goes down by its stairs to floor 2 and floor 3, where the Warden waits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  // Reduced motion: Places goes straight to a place and uses it (no walk past the floor's creatures).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 45000 });
  };
  await go(/ember delve/i, /floor 1/i);
  await go(/stairs down/i, /floor 2/i);
  await go(/stairs down/i, /floor 3/i);
  await go(/stairs up/i, /floor 2/i);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Slagstone Cave on the island: in by its mouth on the mountain, out the same way', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button', { hasText: /slagstone cave/i }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', /slagstone cave/i, { timeout: 30000 });
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button', { hasText: /cave mouth/i }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', /slagstone/i, { timeout: 30000 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Warlock reads their sheet (C) and their Spellbook (K): attributes, spells, auras', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openTopDown(page);
  await canvas(page).focus();
  await page.keyboard.press('c');
  await expect(page.locator('.ksheet [data-attr]')).toHaveCount(4);
  await expect(page.locator('.ksheet')).toContainText(/Warlock/);
  await page.keyboard.press('k');
  await expect(page.locator('.ksheet')).toHaveCount(0);
  await expect(page.locator('.spellbook [data-skill="drain-life"]')).toBeVisible();
  await expect(page.locator('.spellbook [data-skill="aura-embers"]')).toContainText(/On|Activa/);
  // Put Drain Life on key 4: the bar follows.
  await page.locator('.spellbook [data-skill="drain-life"] .sb__keys button', { hasText: '4' }).click();
  await expect(page.locator('.td-skill').nth(3)).toHaveAttribute('aria-label', /Drain Life/);
});

test('a first visit starts with making a character: the Glass opens with the Warlock class', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // A truly new browser: no first-visit record (playwright.config seeds one for every other spec).
  await page.addInitScript(() => localStorage.removeItem('eclipse-onboarding'));
  await page.goto('/play');
  await expect(page.locator('app-keeper-maker')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.km__classcard[data-vocation="warlock"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.stage')).toHaveClass(/stage--td/);
});

test('a ship from Ember Harbour to Pyrehold on the mainland, and back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await go(/ship to pyrehold/i, /pyrehold/i);
  await go(/crafting bench/i, /pyrehold/i);
  await page.keyboard.press('Escape');
  await go(/ship to ember isle/i, /ember harbour/i);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Ember Inn: in by its door, up its stairs to the rooms, down, and out to the square', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await go(/the ember inn/i, /^The Ember Inn$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/inn-tavern.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /upstairs/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/inn-upstairs.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /^The Ember Inn$/);
  await go(/^door/i, /basalt seamworks/i);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Pyre Spire in Pyrehold: in by its door and up all three floors to the Lookout, then back down and out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await go(/ship to pyrehold/i, /pyrehold/i);
  await go(/the pyre spire/i, /watch hall/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/spire-hall.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /study/i);
  await go(/stairs up/i, /lookout/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/spire-lookout.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /study/i);
  await go(/stairs down/i, /watch hall/i);
  await go(/^door/i, /pyrehold/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/spire-outside.jpg', type: 'jpeg', quality: 72 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Molten Deep in Infernal Reach: in by its cave mouth, down three floors to the Tyrant, and back out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await go(/ship to pyrehold/i, /pyrehold/i);
  await go(/the molten deep/i, /scorched throat/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/deep-floor-1.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /glass halls/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/deep-floor-2.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /caldera/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/deep-floor-3.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /glass halls/i);
  await go(/stairs up/i, /scorched throat/i);
  await go(/cave mouth/i, /^(The Molten Deep|The Molten Fields)$/);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Cinderport and Ashgrove: the Reach\'s other towns, each with a house to walk into and a floor above or below', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await go(/ship to pyrehold/i, /pyrehold/i);
  await go(/the salted ember/i, /^The Salted Ember$/);
  await go(/stairs down/i, /cellar/i);
  await go(/stairs up/i, /^The Salted Ember$/);
  await go(/^door/i, /^Cinderport$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/cinderport.jpg', type: 'jpeg', quality: 72 });
  await go(/woodward/i, /^The Woodward's Lodge$/);
  await go(/stairs up/i, /loft/i);
  await go(/stairs down/i, /^The Woodward's Lodge$/);
  await go(/^door/i, /^Ashgrove$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/ashgrove.jpg', type: 'jpeg', quality: 72 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('through every door and stair the Keeper lands free and can walk away (never set down inside a wall)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  const walks = async (where: string) => {
    await page.locator('canvas').first().focus();
    // Each key on its own: how far that press carried the Keeper (they nearly cancel out as a whole).
    let moved = 0;
    for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown']) {
      const x0 = await px(page), y0 = await py(page);
      await page.keyboard.down(key); await page.waitForTimeout(250); await page.keyboard.up(key);
      moved = Math.max(moved, Math.abs((await px(page)) - x0) + Math.abs((await py(page)) - y0));
    }
    expect(moved, `${where}: the Keeper could not move`).toBeGreaterThan(4);
  };
  await go(/the ember inn/i, /^The Ember Inn$/); await walks('inn tavern');
  await go(/stairs up/i, /upstairs/i); await walks('inn upstairs');
  await go(/stairs down/i, /^The Ember Inn$/); await walks('inn tavern from above');
  await go(/^door/i, /basalt seamworks/i); await walks('square from the inn');
  await go(/ship to pyrehold/i, /pyrehold/i);
  await go(/the pyre spire/i, /watch hall/i); await walks('spire hall');
  await go(/stairs up/i, /study/i); await walks('spire study');
  await go(/stairs up/i, /lookout/i); await walks('spire lookout');
  await go(/stairs down/i, /study/i); await walks('spire study from above');
});

test('without the gate the side view is unchanged', async ({ page }) => {
  await seed(page, {});
  await page.goto('/play?td=0');
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
  await expect(page.locator('.tb--jump')).toHaveCount(1);
});
