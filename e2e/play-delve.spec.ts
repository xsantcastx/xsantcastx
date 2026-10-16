/**
 * play-delve.spec.ts — dig, build and come back to the Ember Delve, with the
 * keyboard, in a real browser, across reloads.
 *
 * The engine exposes only the Keeper's x (`data-player-x`) and area name
 * (`data-area`), so "the dug cells are still open" is read the way a player
 * feels it: the Keeper falls back into the same pit and cannot walk out of it.
 * The delve seed is pinned through the save blob so every run digs the same rock.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  bag, blob, canvas, focusWorld, hotbarCount, messageLine, openPlay, placePanel, playerX, seed, settleBetween, stackQty, walkTo, SHAFT_X, delveSave } from './play-helpers';

const SEED = 424242;
const FRESH_DELVE = { 'godforge-delve': { version: 1, seed: SEED, createdAt: 1, areas: {}, claimed: [] } };
/**
 * One World: the Delve is under the Seamworks' street (rows ≥ 0 are the old
 * Delve's, byte for byte). x 260 is where the old shaft dropped the Keeper:
 * columns 7 and 8 under the feet, the same rock.
 */
const ARRIVE_X = 260;

interface DelveBlob { areas?: Record<string, { layout: string; cells: string }>; chests?: Record<string, unknown> }

async function delveCells(page: Page): Promise<string> {
  return (await delveSave<DelveBlob>(page))?.areas?.['ember-delve']?.cells ?? '';
}

async function enterDelve(page: Page): Promise<void> {
  // One World: walk the street to the old shaft's spot, west of the Vault: the Delve's rock is under the feet.
  await expect(canvas(page)).toHaveAttribute('data-world', 'ember');
  await focusWorld(page);
  await walkTo(page, ARRIVE_X, 8);
  await page.waitForTimeout(400);
  await focusWorld(page);
}

/** Hold S + J (dig below) until the satchel holds `blocks` dirt blocks. */
async function digDown(page: Page, blocks: number): Promise<void> {
  await page.keyboard.down('s');
  await page.keyboard.down('j');
  try {
    await expect.poll(() => hotbarCount(page, 'Dirt block'), { timeout: 30000, intervals: [100] }).toBeGreaterThanOrEqual(blocks);
  } finally {
    await page.keyboard.up('j');
    await page.keyboard.up('s');
  }
  await page.waitForTimeout(600); // land
}

/** Hold D + J (dig ahead while walking) until the Keeper passes `x`. */
async function tunnelRight(page: Page, x: number): Promise<void> {
  await page.keyboard.down('j');
  await page.keyboard.down('d');
  try {
    await expect.poll(() => playerX(page), { timeout: 30000, intervals: [100] }).toBeGreaterThanOrEqual(x);
  } finally {
    await page.keyboard.up('d');
    await page.keyboard.up('j');
  }
}

/** Hold keys together for `ms`; returns how far x moved. */
async function tryEscape(page: Page, ms = 1500): Promise<number> {
  const x0 = await playerX(page);
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(ms);
  await page.keyboard.up('d');
  await page.keyboard.up('w');
  return (await playerX(page)) - x0;
}

/** Walk right until something stops the Keeper. */
async function walkUntilBlocked(page: Page): Promise<number> {
  await page.keyboard.down('d');
  let last = -1, same = 0;
  try {
    for (let i = 0; i < 80 && same < 4; i++) {
      await page.waitForTimeout(100);
      const x = await playerX(page);
      same = x === last ? same + 1 : 0;
      last = x;
    }
  } finally {
    await page.keyboard.up('d');
  }
  return last;
}

/** Let the 1.5 s debounced delve write land, then reload into the town. */
async function saveAndReload(page: Page): Promise<void> {
  await page.waitForTimeout(2500);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
  await page.waitForTimeout(400);
  await focusWorld(page);
  if ((await canvas(page).getAttribute('data-area')) === 'Ember Delve') {
    await page.getByRole('button', { name: 'Return to camp', exact: true }).first().click();
  }
}

async function chooseSlot(page: Page, key: string, name: string): Promise<void> {
  await focusWorld(page);
  await page.keyboard.press(key);
  await expect(messageLine(page)).toContainText(`${name} ready`);
}

test.describe('Ember Delve, played', () => {
  test.describe.configure({ timeout: 150000 });

  test('a pit dug before a reload is still open after it', async ({ page }) => {
    await seed(page, FRESH_DELVE);
    await openPlay(page);
    await enterDelve(page);
    // Control: on untouched rock, Up + Right walks the Keeper away from the shaft.
    expect(await tryEscape(page, 1000)).toBeGreaterThan(40);
    await walkTo(page, ARRIVE_X, 4);
    // The walk back can slide a column past 260. Dug there, the pit misses the
    // arrival columns and the reloaded Keeper lands on rock beside it. Stand in
    // 246..266 instead: the 26 px body then spans exactly columns 7 and 8.
    await settleBetween(page, ARRIVE_X - 14, ARRIVE_X + 6);
    await digDown(page, 14); // seven rows of two columns (six a parkour mantle climbs out of)
    // The dig is written 1.5 s after the last swing.
    await expect.poll(async () => (await delveCells(page)).split(',').length, { timeout: 8000 }).toBeGreaterThanOrEqual(14);
    const cells = await delveCells(page);
    // Seven rows down neither a jump nor the hands on the lip clear the wall.
    expect(await tryEscape(page)).toBeLessThan(40);
    await saveAndReload(page);
    expect(await delveCells(page)).toBe(cells);
    await enterDelve(page);
    // Same shaft, same pit: the Keeper drops back in (give the fall time) and is walled in again.
    await page.waitForTimeout(1500);
    expect(await tryEscape(page)).toBeLessThan(40);
  });

  test('a placed dirt block goes into the rock, persists, and digs back out as a block', async ({ page }) => {
    await seed(page, FRESH_DELVE);
    await openPlay(page);
    await enterDelve(page);
    await digDown(page, 4); // a two-deep pit under the shaft
    await tunnelRight(page, 420);
    await walkUntilBlocked(page);
    await chooseSlot(page, 'Digit1', 'Dirt block');
    const before = await hotbarCount(page, 'Dirt block');
    await page.waitForTimeout(2000);
    const cellsBefore = await delveCells(page);
    // Turn round and step back down the trench, trying B at each step like a player
    // looking for the spot where the block fits.
    let placedFrom = -1;
    for (let i = 0; i < 8 && placedFrom < 0; i++) {
      await page.keyboard.down('a');
      await page.waitForTimeout(120);
      await page.keyboard.up('a');
      await page.waitForTimeout(300);
      await page.keyboard.press('b');
      await page.waitForTimeout(150);
      if (/Dirt block placed/.test(await messageLine(page).textContent() ?? '')) placedFrom = await playerX(page);
    }
    expect(placedFrom, 'B never placed a block along the trench').toBeGreaterThan(0);
    // Facing left: the block went into the column just past the body.
    const blockCol = Math.floor((placedFrom - 13) / 32) - 1;
    await expect.poll(() => hotbarCount(page, 'Dirt block')).toBe(before - 1);
    await expect.poll(() => delveCells(page), { timeout: 5000 }).not.toBe(cellsBefore);
    const cells = await delveCells(page);
    await saveAndReload(page);
    expect(await delveCells(page)).toBe(cells);
    await enterDelve(page);
    expect(await hotbarCount(page, 'Dirt block')).toBe(before - 1);
    // Walk up onto the block and dig down: it comes back as a block.
    await walkTo(page, blockCol * 32 + 16, 8);
    await digDown(page, before);
  });

  test('a torch placed in the dark is still there after a reload (and can be taken back)', async ({ page }) => {
    await seed(page, { ...FRESH_DELVE, ...bag({ torch: 3 }) });
    await openPlay(page);
    await enterDelve(page);
    await digDown(page, 4);
    await tunnelRight(page, 420);
    const end = await walkUntilBlocked(page);
    await chooseSlot(page, 'Digit3', 'Torch');
    await page.keyboard.press('b');
    await expect(messageLine(page)).toContainText('Torch placed');
    await expect.poll(() => hotbarCount(page, 'Torch')).toBe(2);
    await saveAndReload(page);
    await enterDelve(page);
    // Back down the pit and along the trench to the torch.
    expect(Math.abs((await walkUntilBlocked(page)) - end)).toBeLessThanOrEqual(8);
    await page.keyboard.press('x');
    await expect(messageLine(page)).toContainText('Torch back in the satchel');
    await expect.poll(() => hotbarCount(page, 'Torch')).toBe(3);
  });

  test('ladders climb out of a shaft too deep to jump', async ({ page }) => {
    await seed(page, { ...FRESH_DELVE, ...bag({ ladder: 12 }) });
    await openPlay(page);
    await enterDelve(page);
    await digDown(page, 14); // seven rows
    expect(await tryEscape(page)).toBeLessThan(40);
    await chooseSlot(page, 'Digit4', 'Ladder');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('b');
      if (/No open space/.test(await messageLine(page).textContent() ?? '')) break;
      await page.keyboard.down('w');
      await page.waitForTimeout(400);
      await page.keyboard.up('w');
    }
    expect(await hotbarCount(page, 'Ladder')).toBeLessThan(12);
    // Up the last rungs and off the top.
    expect(await tryEscape(page, 2500)).toBeGreaterThan(80);
  });

  test('chest: put materials in, reload, take them out', async ({ page }) => {
    await seed(page, { ...FRESH_DELVE, ...bag({ chest: 1, 'cinder-ore': 5 }) });
    await openPlay(page);
    await enterDelve(page);
    await digDown(page, 4);
    await tunnelRight(page, 420);
    await walkUntilBlocked(page);
    await chooseSlot(page, 'Digit6', 'Chest');
    await page.keyboard.press('b');
    await expect(messageLine(page)).toContainText('Chest placed');
    await expect(page.locator('.prompt')).toContainText('Open the chest');
    await page.keyboard.press('e');
    await expect(placePanel(page)).toBeVisible();
    await expect(page.locator('#place-title')).toHaveText('Chest');
    // Five carried, plus any the tunnel cut from the Root Hollows' cinder seam on the way.
    const ore = await stackQty(page, 'cinder-ore');
    expect(ore).toBeGreaterThanOrEqual(5);
    await page.locator('.chest section[aria-labelledby="chest-bag"] li', { hasText: 'Cinder Ore' }).getByRole('button', { name: 'Put in' }).click();
    await expect(page.locator('.chest section[aria-labelledby="chest-in"] li', { hasText: 'Cinder Ore' })).toContainText(String(ore));
    await expect.poll(() => stackQty(page, 'cinder-ore')).toBe(0);
    await page.keyboard.press('Escape');
    await expect(placePanel(page)).toBeHidden();
    await saveAndReload(page);
    expect(Object.keys((await delveSave<DelveBlob>(page))?.chests ?? {})).toHaveLength(1);
    await enterDelve(page);
    await walkUntilBlocked(page);
    await expect(page.locator('.prompt')).toContainText('Open the chest');
    await page.keyboard.press('e');
    await expect(page.locator('#place-title')).toHaveText('Chest');
    const row = page.locator('.chest section[aria-labelledby="chest-in"] li', { hasText: 'Cinder Ore' });
    await expect(row).toContainText(String(ore));
    await row.getByRole('button', { name: 'Take all' }).click();
    await expect.poll(() => stackQty(page, 'cinder-ore')).toBe(ore);
  });

  test('camp: place it, go home, "Descend to your camp" lands beside it', async ({ page }) => {
    await seed(page, { ...FRESH_DELVE, ...bag({ camp: 1 }) });
    await openPlay(page);
    await enterDelve(page);
    await digDown(page, 4);
    await tunnelRight(page, 420);
    const campX = await walkUntilBlocked(page);
    await chooseSlot(page, 'Digit7', 'Camp');
    await page.keyboard.press('b');
    await expect(messageLine(page)).toContainText('Camp placed');
    // E at the camp opens the Crafting Bench on "Ready now".
    await expect(page.locator('.prompt')).toContainText('Craft at your camp');
    await page.keyboard.press('e');
    await expect(page.locator('#place-title')).toHaveText('Your camp');
    await page.keyboard.press('Escape');
    await expect(placePanel(page)).toBeHidden();
    await page.getByRole('button', { name: 'Return to camp', exact: true }).first().click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
    // One World: the trench just dug lies between the town and the mine head; stand at the mine head by its link.
    await page.waitForTimeout(1500);
    await openPlay(page, '?at=delve');
    const descend = page.getByRole('button', { name: /Descend to your camp/ });
    await expect(descend).toBeVisible();
    await descend.click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
    await expect(messageLine(page)).toContainText('climb down the ropes to your camp');
    expect(Math.abs((await playerX(page)) - campX)).toBeLessThanOrEqual(32);
  });
});
