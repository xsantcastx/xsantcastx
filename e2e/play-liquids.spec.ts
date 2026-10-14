/**
 * play-liquids.spec.ts — Liquids v1 (docs/handoff/liquids-fishing.md), played
 * at 1280×800 with a mouse and at 390×844 with touch:
 *
 *   - a Seam Bucket scoops a full cell of the Grotto Mere
 *   - the water poured on lava sets into obsidian (a made cell: its block only)
 *   - the obsidian and the settled liquid survive a reload
 *
 * The Delve is built by the game's own pure code (play-delve-fixtures.ts): the
 * Mere's dry west shore, and a lava basin beside the camp. Screenshots go to
 * output/liquids-fishing/ when FISH_SHOTS is set (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, canvas, focusWorld, hotbarCount, messageLine, openPlay, playerX, seed, walkTo } from './play-helpers';
import { CELL, DelveFixture, nodeIndex, SPEC } from './play-delve-fixtures';
import { decodeCells } from '../src/app/shared/delve/delve-save.model';

const SHOTS = process.env['FISH_SHOTS'];
const idx = (col: number, row: number) => row * SPEC.cols + col;
/** The camp's floor: the Keeper's feet on row 35's top edge. */
const FEET = SPEC.top + 35 * CELL;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/liquids-fishing/${name}.png` });
}

/** The Mere's dry west shore (camp at col 16), and a two-cell lava basin at cols 13-14, row 35. */
function shoreWithLava(): DelveFixture {
  const f = new DelveFixture().carve(13, 18, 30, 34).carve(19, 19, 30, 32).floor(15, 19, 35);
  f.set(19, 33, 'bedrock').set(19, 34, 'bedrock');
  f.carve(13, 14, 35, 35).floor(13, 14, 36).set(12, 35, 'bedrock');
  f.liquid(13, 35, 'lava').liquid(14, 35, 'lava');
  return f.camp(16, 34);
}

async function descend(page: Page): Promise<void> {
  await openPlay(page);
  await walkTo(page, 590, 30);
  const button = page.getByRole('button', { name: /Descend to your camp/ });
  await expect(button).toBeVisible();
  await button.click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await page.waitForTimeout(1800);
  await focusWorld(page);
}

/** A cell's centre in client px, by the engine's own camera rule (play-delve-nav cellPoint). */
async function cellPoint(page: Page, col: number, row: number): Promise<{ x: number; y: number }> {
  const px = await playerX(page);
  return canvas(page).evaluate((c, a) => {
    const rect = c.getBoundingClientRect();
    const parent = c.parentElement!;
    const w = Math.max(320, parent.clientWidth || rect.width), h = Math.max(300, parent.clientHeight || rect.height);
    const scale = h / 720, viewport = w / scale;
    const camera = Math.max(0, Math.min(a.areaWidth - viewport, a.px - viewport * .38));
    const cameraY = Math.max(0, Math.min(a.bottom + 40 - 720, a.feetY - 720 * .58));
    return { x: rect.left + (a.wx - camera) * scale * (rect.width / w), y: rect.top + (a.wy - cameraY) * scale * (rect.height / h) };
  }, { px, feetY: FEET, wx: (col + .5) * CELL, wy: SPEC.top + (row + .5) * CELL, areaWidth: SPEC.cols * CELL, bottom: SPEC.top + SPEC.rows * CELL });
}

async function press(page: Page, touch: boolean, at: { x: number; y: number }): Promise<void> {
  if (!touch) {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(120);
    await page.mouse.up({ button: 'right' });
    return;
  }
  for (const type of ['pointerdown', 'pointerup'] as const) {
    await canvas(page).dispatchEvent(type, { pointerType: 'touch', pointerId: 9, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: at.x, clientY: at.y, bubbles: true });
    await page.waitForTimeout(120);
  }
}

async function kindAt(page: Page, col: number, row: number): Promise<number | undefined> {
  const save = await blob<{ areas?: Record<string, { cells: string }> }>(page, 'godforge-delve');
  return decodeCells(save?.areas?.['ember-delve']?.cells ?? '').get(idx(col, row));
}

async function choose(page: Page, touch: boolean, name: string, key: string): Promise<void> {
  if (!touch) { await focusWorld(page); await page.keyboard.press(key); }
  else await page.locator(`.hotbar .hot[title="${name}"]`).tap();
}

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`Liquids (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });

    test('scoop the Mere with a Seam Bucket, pour it on lava, and the obsidian stays after a reload', async ({ page }) => {
      test.setTimeout(150_000);
      await seed(page, { ...shoreWithLava().blobs(), ...bag({ 'seam-bucket': 1 }) });
      await descend(page);
      await shot(page, `${label}-mere-lava`);
      // The bucket: past key 0 on the hotbar, shown while held (key - on a keyboard).
      await choose(page, touch, 'Seam Bucket', 'Minus');
      await press(page, touch, await cellPoint(page, 20, 33));
      await expect(messageLine(page)).toContainText('The bucket holds a cell of water');
      await expect.poll(() => hotbarCount(page, 'Bucket of water')).toBe(1);
      // Pour it on the lava: that cell sets into obsidian.
      await choose(page, touch, 'Bucket of water', 'Minus');
      await press(page, touch, await cellPoint(page, 14, 35));
      await expect(messageLine(page)).toContainText('sets into obsidian');
      await expect.poll(() => kindAt(page, 14, 35), { timeout: 8000, intervals: [250] }).toBe(nodeIndex('obsidian'));
      expect(await hotbarCount(page, 'Seam Bucket')).toBe(1);
      await shot(page, `${label}-obsidian`);
      await page.waitForTimeout(2000); // the 1.5 s debounced write carries the liquid too
      const save = await blob<{ areas: Record<string, { wet?: string; liquids?: string }> }>(page, 'godforge-delve');
      expect(save?.areas['ember-delve']?.wet, 'the settled liquid is filed under its liquid layout').toContain(':l');
      // Reload: the obsidian is a saved cell; the other lava cell is still lava.
      await descend(page);
      expect(await kindAt(page, 14, 35)).toBe(nodeIndex('obsidian'));
      const liquids = decodeCells((await blob<{ areas: Record<string, { liquids?: string }> }>(page, 'godforge-delve'))?.areas['ember-delve']?.liquids ?? '');
      expect(liquids.get(idx(13, 35)), 'lava at 13,35 (type 2 × 16 + level 8)').toBe(2 * 16 + 8);
      await shot(page, `${label}-reloaded`);
    });
  });
}
