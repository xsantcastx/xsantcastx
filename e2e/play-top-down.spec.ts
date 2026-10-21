/**
 * play-top-down.spec.ts — the top-down Seamworks square (docs/design/top-down.md, Phase 1),
 * behind the `?td=1` gate: the Keeper walks 8 ways, keepers stand at their stalls, E opens
 * the stall in reach through the same panels the side view used, the side view's arrow
 * and jump buttons give way to the drag joystick, and nothing ever drops the Keeper into the old 2D view.
 */
import { expect, test, type Page } from '@playwright/test';
import { pickSkill, purse, sail, seed, mapFind } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const px = async (page: Page) => Number(await canvas(page).getAttribute('data-player-x'));
const py = async (page: Page) => Number(await canvas(page).getAttribute('data-player-y'));

async function openTopDown(page: Page): Promise<void> {
  await seed(page, { 'eclipse-td': '1', ...purse(100_000) });
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
  await mapFind(page, /cinder ore/i);
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
  await mapFind(page, /ember delve/i);
  await page.locator('#places-list button', { hasText: /ember delve/i }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', /ember mine/i, { timeout: 20000 });
  await expect(page.locator('.stage')).toHaveClass(/stage--td/);
  await expect(page.locator('.stage')).not.toHaveClass(/stage--delve/);
  await page.locator('.places-toggle').first().click();
  await mapFind(page, /ladder up/i);
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
  await mapFind(page, /ember delve/i);
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
    await mapFind(page, place);
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
  await mapFind(page, /slagstone cave/i);
  await page.locator('#places-list button', { hasText: /slagstone cave/i }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', /slagstone cave/i, { timeout: 30000 });
  await page.locator('.places-toggle').first().click();
  await mapFind(page, /cave mouth/i);
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
  await pickSkill(page, 'aura-embers');
  await expect(page.locator('.sbt__detail .sb__aura')).toContainText(/On|Activa/);
  // Put Drain Life on key 4: the bar follows.
  await pickSkill(page, 'drain-life');
  await page.locator('.sbt__detail .sb__keys button', { hasText: '4' }).click();
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
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await go(/crafting bench/i, /pyrehold/i);
  await page.keyboard.press('Escape');
  await sail(page, /ember harbour/i, /ember harbour/i);
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
    await mapFind(page, place);
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
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
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
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
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

test('the Molten Deep\'s lower floors: past the Tyrant to the Slag Rivers, the Glass Foundry and the Heart of the Deep, and back up', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await go(/the molten deep/i, /scorched throat/i);
  await go(/stairs down/i, /glass halls/i);
  await go(/stairs down/i, /caldera/i);
  // The stair down lies past the Tyrant's ring, south; the Map sets the Keeper on it (no walk past the boss).
  await go(/stairs down/i, /slag rivers/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/deep-4.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /glass foundry/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/deep-5.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /heart of the deep/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/deep-6.jpg', type: 'jpeg', quality: 72 });
  // (No walk into the cavern: the Cinder Sovereign would fight a level-1 Keeper, and a test never rides on a fight.)
  await go(/stairs up/i, /glass foundry/i);
  await go(/stairs up/i, /slag rivers/i);
  await go(/stairs up/i, /caldera/i);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Forge of the Four in the Obsidian Badlands: in by its gate, down to the First Anvil, and back out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await go(/the forge of the four/i, /ash gate/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/forge-1.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /four smithies/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/forge-2.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /first anvil/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/forge-3.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /four smithies/i);
  await go(/stairs up/i, /ash gate/i);
  await go(/forge gate/i, /^(The Forge of the Four|The Obsidian Badlands)$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/forge-gate.jpg', type: 'jpeg', quality: 72 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a ship from Cinderport\'s pier back to Ember Isle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  // Into Cinderport by its tavern door and out again, so the Keeper stands in the town.
  await go(/the salted ember/i, /^The Salted Ember$/);
  await go(/^door/i, /^Cinderport$/);
  // Walk east along the street to the pier's head, then down the planks to the ship, for the picture.
  const T = 16, pierX = (92 + 15) * T + T / 2, pierY = (34 + 14) * T + T;
  const step = async (key: string) => { await page.keyboard.down(key); await page.waitForTimeout(70); await page.keyboard.up(key); await page.waitForTimeout(40); };
  for (let i = 0; i < 120 && Math.abs(await px(page) - pierX) > 5; i++) await step(await px(page) < pierX ? 'd' : 'a');
  for (let i = 0; i < 120 && await py(page) < pierY; i++) await step('s');
  expect(await py(page)).toBeGreaterThanOrEqual(pierY);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/cinderport-ship.jpg', type: 'jpeg', quality: 72 });
  await sail(page, /ember harbour/i, /ember harbour/i, /marit salt/i);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Ashen Crypt under the Ashen Bastion: in by its door, down to the Bone Hall, and back out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await go(/the ashen crypt/i, /ossuary/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/crypt-floor-1.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /bone hall/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/crypt-floor-2.jpg', type: 'jpeg', quality: 72 });
  // (No walk into the hall: the Ashbone Dragon would fight a level-1 Keeper there, and a test never rides on a fight.)
  await go(/stairs up/i, /ossuary/i);
  await go(/crypt door/i, /^(The Ashen Bastion|The Ashen Crypt)$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/crypt-door.jpg', type: 'jpeg', quality: 72 });
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
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
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

test('the Verdant Wilds: a ship from Pyrehold to Mossharbor, up the Rootglass Bole to the Crown and down, and the Map of the continent', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-mossharbor.jpg', type: 'jpeg', quality: 72 });
  // The continent's Map: Rootglass, Mossharbor, Thornwick, the temple's gate.
  await canvas(page).focus();
  await page.keyboard.press('m');
  await expect(page.locator('#places-list.td-map')).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-map.jpg', type: 'jpeg', quality: 78 });
  await page.keyboard.press('Escape');
  await go(/the rootglass bole/i, /root hall/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-root-hall.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /lower boughs/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-canopy-1.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /sap galleries/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-canopy-2.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /the crown/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-canopy-3.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /sap galleries/i);
  await go(/stairs down/i, /lower boughs/i);
  await go(/stairs down/i, /root hall/i);
  await go(/^door/i, /^Rootglass$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-rootglass.jpg', type: 'jpeg', quality: 72 });
  await sail(page, /pyrehold/i, /pyrehold/i);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Overgrown Temple in the Sunken Courts: in by its gate, down to the Heart Shrine, and back out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  await go(/the overgrown temple/i, /sunken narthex/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-temple-1.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /hall of roots/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-temple-2.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /heart shrine/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-temple-3.jpg', type: 'jpeg', quality: 72 });
  // (No walk onto the island: the Colossus would fight a level-1 Keeper there, and a test never rides on a fight.)
  await go(/stairs up/i, /hall of roots/i);
  await go(/stairs up/i, /sunken narthex/i);
  await go(/temple gate/i, /^(The Overgrown Temple|The Sunken Courts)$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant-temple-gate.jpg', type: 'jpeg', quality: 72 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Umbral Marches: a ship from Pyrehold to Mirewatch, up the Lantern Tower in Gloamhaven and down, and the Map of the continent', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await sail(page, /mirewatch/i, /^Mirewatch$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-mirewatch.jpg', type: 'jpeg', quality: 72 });
  // The continent's Map: Gloamhaven on its stilts, Mirewatch, Lanternfen, the crypt door in the drowned ruins.
  await canvas(page).focus();
  await page.keyboard.press('m');
  await expect(page.locator('#places-list.td-map')).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-map.jpg', type: 'jpeg', quality: 78 });
  await page.keyboard.press('Escape');
  await go(/the lantern tower/i, /keeper's hall/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-tower-0.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /wick loft/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-tower-1.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /lantern room/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-tower-2.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /wick loft/i);
  await go(/stairs down/i, /keeper's hall/i);
  await go(/^door/i, /^Gloamhaven$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-gloamhaven.jpg', type: 'jpeg', quality: 72 });
  await sail(page, /pyrehold/i, /pyrehold/i);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Drowned Crypts in the Umbral Marches: in by their door, down to the Abbess\'s Chapel, and back out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await sail(page, /mirewatch/i, /^Mirewatch$/);
  await go(/the drowned crypts/i, /flooded nave/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-crypt-1.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /sunken cloister/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-crypt-2.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /abbess's chapel/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-crypt-3.jpg', type: 'jpeg', quality: 72 });
  // (No walk onto the island: the Abbess would fight a level-1 Keeper there, and a test never rides on a fight.)
  await go(/stairs up/i, /sunken cloister/i);
  await go(/stairs up/i, /flooded nave/i);
  await go(/crypt door/i, /^(The Drowned Crypts|The Drowned Ruins)$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/umbral-crypt-door.jpg', type: 'jpeg', quality: 72 });
  expect(errors, errors.join('\n')).toEqual([]);
});

/** Travel by the Map's key (reduced motion: at once) and wait for the area to change. */
const travel = (page: Page) => async (place: RegExp, area: RegExp) => {
  await page.locator('.places-toggle').first().click();
  await mapFind(page, place);
  await page.locator('#places-list button', { hasText: place }).first().click();
  await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
};
async function openVerdantTrip(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  return errors;
}

test('the Verdant villages\' houses: the Net-Mender\'s Loft and its loft, the Herbalist\'s Cottage and its root cellar', async ({ page }) => {
  const errors = await openVerdantTrip(page), go = travel(page);
  // Ember Harbour's second ship sails straight to Mossharbor.
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  await go(/the net-mender's loft/i, /^The Net-Mender's Loft$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-netloft.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /the loft/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-netloft-loft.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /^The Net-Mender's Loft$/);
  await go(/^door/i, /^Mossharbor$/);
  await go(/the herbalist's cottage/i, /^The Herbalist's Cottage$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-cottage.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /root cellar/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-cottage-cellar.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /^The Herbalist's Cottage$/);
  await go(/^door/i, /^Thornwick$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-thornwick.jpg', type: 'jpeg', quality: 72 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Overgrown Temple goes deeper: past the Heart Shrine to the Drowned Vault and the Rootcradle, and back up', async ({ page }) => {
  const errors = await openVerdantTrip(page), go = travel(page);
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  await go(/the overgrown temple/i, /sunken narthex/i);
  await go(/stairs down/i, /hall of roots/i);
  await go(/stairs down/i, /heart shrine/i);
  // The stairs on behind the shrine are fourteen tiles from the Colossus's island: the Map's key goes straight to them.
  await go(/stairs down/i, /drowned vault/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-temple-4.jpg', type: 'jpeg', quality: 72 });
  await canvas(page).focus(); await page.keyboard.press('m');
  await expect(page.locator('#places-list.td-map')).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-temple-4-map.jpg', type: 'jpeg', quality: 78 });
  await page.keyboard.press('Escape');
  await go(/stairs down/i, /rootcradle/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-temple-5.jpg', type: 'jpeg', quality: 72 });
  await canvas(page).focus(); await page.keyboard.press('m');
  await expect(page.locator('#places-list.td-map')).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-temple-5-map.jpg', type: 'jpeg', quality: 78 });
  await page.keyboard.press('Escape');
  // (No walk to the Rootwyrm: a level-1 Keeper would fight it, and a test never rides on a fight.)
  await go(/stairs up/i, /drowned vault/i);
  await go(/stairs up/i, /heart shrine/i);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the Root Hollows in the Deep Wilds: in by the root-hole, down three floors to the Heartroot Cellar, and back out', async ({ page }) => {
  const errors = await openVerdantTrip(page), go = travel(page);
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  await go(/the root hollows/i, /gnawed galleries/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-hollows-1.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs down/i, /sporewell/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-hollows-2.jpg', type: 'jpeg', quality: 72 });
  await canvas(page).focus(); await page.keyboard.press('m');
  await expect(page.locator('#places-list.td-map')).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-hollows-2-map.jpg', type: 'jpeg', quality: 78 });
  await page.keyboard.press('Escape');
  await go(/stairs down/i, /heartroot cellar/i);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-hollows-3.jpg', type: 'jpeg', quality: 72 });
  await go(/stairs up/i, /sporewell/i);
  await go(/stairs up/i, /gnawed galleries/i);
  await go(/root-hole/i, /^(The Root Hollows|The Deep Wilds)$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-hollows-mouth.jpg', type: 'jpeg', quality: 72 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a ship from Mossharbor\'s west finger to Ember Isle, and Ember Harbour\'s ship back', async ({ page }) => {
  const errors = await openVerdantTrip(page), go = travel(page);
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-mossharbor-ships.jpg', type: 'jpeg', quality: 72 });
  await sail(page, /ember harbour/i, /ember harbour/i);
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('through every door and stair the Keeper lands free and can walk away (never set down inside a wall)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
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
  await sail(page, /pyrehold/i, /pyrehold/i);
  await go(/the pyre spire/i, /watch hall/i); await walks('spire hall');
  await go(/stairs up/i, /study/i); await walks('spire study');
  await go(/stairs up/i, /lookout/i); await walks('spire lookout');
  await go(/stairs down/i, /study/i); await walks('spire study from above');
});

test('a reload resumes where the Keeper stood — another continent, inside a building — never back in the square', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTopDown(page);
  const go = async (place: RegExp, area: RegExp) => {
    await page.locator('.places-toggle').first().click();
    await mapFind(page, place);
    await page.locator('#places-list button', { hasText: place }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', area, { timeout: 30000 });
  };
  await sail(page, /pyrehold/i, /pyrehold/i);
  await go(/the pyre spire/i, /watch hall/i);
  await page.waitForTimeout(2600);   // the place is saved every two seconds
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-area', /watch hall/i, { timeout: 20000 });
});

test('without the gate the side view is unchanged', async ({ page }) => {
  await seed(page, {});
  await page.goto('/play?td=0');
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
  await expect(page.locator('.tb--jump')).toHaveCount(1);
});
