/**
 * play-delve-nav.spec.ts — Delve navigation, Terraria-style
 * (docs/handoff/delve-navigation.md), played at 1280×800 with a mouse and at
 * 390×844 with touch:
 *
 *   - the smart cursor aims at a cell three columns away and a held press digs it
 *   - a held right button (a held finger with a block chosen) drags a bridge across a pit
 *   - walking steps up a one-cell ledge with no jump
 *   - the map (M, or the minimap) opens, and what was explored is still there after a reload
 *
 * The Delve is built by the game's own pure code (play-delve-fixtures.ts) and
 * entered by the shaft's real "Descend to your camp". Screenshots go to
 * output/delve-nav/ when DELVE_NAV_SHOTS is set (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, canvas, focusWorld, hotbarCount, messageLine, openPlay, playerX, seed, walk, walkTo, SHAFT_X, delveSave } from './play-helpers';
import { CELL, DelveFixture, nodeIndex, SPEC } from './play-delve-fixtures';
import { decodeCells } from '../src/app/shared/delve/delve-save.model';

const SHOTS = process.env['DELVE_NAV_SHOTS'];
/** The tunnel's floor: the Keeper's feet stand on row 9's top edge. */
const FEET = SPEC.top + 9 * CELL;
const idx = (col: number, row: number) => row * SPEC.cols + col;

/**
 * A three-row tunnel (rows 6-8, cols 14-34) over a bedrock floor, the camp at
 * col 22. East of the camp: a rock at (25, 7) to dig from the camp, and a pit
 * at cols 23-25 to bridge. West: a one-cell ledge at col 19 under a four-row ceiling.
 */
function delve(): DelveFixture {
  const f = new DelveFixture().carve(14, 34, 6, 8).floor(14, 34, 9).camp(22, 8);
  f.set(25, 7, 'rock');
  f.carve(23, 25, 9, 11).floor(23, 25, 12);
  f.carve(14, 20, 5, 5).set(19, 8, 'bedrock'); // headroom over the ledge: the Keeper is nearly three cells tall
  return f;
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/delve-nav/${name}.png` });
}

/** From town: walk to the shaft and take "Descend to your camp". */
async function descend(page: Page): Promise<void> {
  // One World: `?at=delve` stands the Keeper at the mine head (a reload resumes wherever they last stood, maybe underground).
  await openPlay(page, '?at=delve');
  const button = page.getByRole('button', { name: /Descend to your camp/ });
  await expect(button).toBeVisible();
  await button.click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await expect(messageLine(page)).toContainText('climb down the ropes to your camp');
  await page.waitForTimeout(1800); // the camera settles and the arrival grace runs out
  await focusWorld(page);
}

/** A cell's centre in client px, by the engine's own camera rule (see play-delve-extras clickCell). */
async function cellPoint(page: Page, col: number, row: number): Promise<{ x: number; y: number }> {
  const px = await playerX(page);
  return canvas(page).evaluate((c, a) => {
    const rect = c.getBoundingClientRect();
    const parent = c.parentElement!;
    const w = Math.max(320, parent.clientWidth || rect.width), h = Math.max(300, parent.clientHeight || rect.height);
    const scale = h / 720, viewport = w / scale;
    const camera = a.px - viewport * .38; // endless Delve: no wall either side of the core, never clamped there
    const cameraY = Math.max(0, Math.min(a.bottom + 40 - 720, a.feetY - 720 * .58));
    return { x: rect.left + (a.wx - camera) * scale * (rect.width / w), y: rect.top + (a.wy - cameraY) * scale * (rect.height / h) };
  }, { px, feetY: FEET, wx: (col + .5) * CELL, wy: SPEC.top + (row + .5) * CELL, areaWidth: SPEC.cols * CELL, bottom: SPEC.top + SPEC.rows * CELL });
}

/** A finger on the world: pointer events as a touch screen sends them (Playwright's touchscreen only taps). */
async function finger(page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', at: { x: number; y: number }): Promise<void> {
  await canvas(page).dispatchEvent(type, { pointerType: 'touch', pointerId: 7, isPrimary: true, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, clientX: at.x, clientY: at.y, bubbles: true });
}

async function kindAt(page: Page, col: number, row: number): Promise<number | undefined> {
  const save = await delveSave<{ areas?: Record<string, { cells: string }> }>(page);
  return decodeCells(save?.areas?.['ember-delve']?.cells ?? '').get(idx(col, row));
}

/** A world cell's centre in client px on the open full map, from the transform it publishes (`data-view`). */
async function mapPoint(page: Page, col: number, row: number): Promise<{ x: number; y: number }> {
  return page.locator('.map-full canvas').evaluate((c, a) => {
    const [ox, oy, s, dpr] = (c.getAttribute('data-view') ?? '0,0,1,1').split(',').map(Number);
    const r = c.getBoundingClientRect();
    return { x: r.left + (ox + (a.col + .5) * s) / dpr, y: r.top + (oy + (a.row + .5) * s) / dpr };
  }, { col, row });
}

/** Pixels of the open full map that are not unexplored fog (rgb 20,10,31). */
async function exploredPixels(page: Page): Promise<number> {
  return page.locator('.map-full canvas').evaluate(c => {
    const canvasEl = c as HTMLCanvasElement;
    const data = canvasEl.getContext('2d')!.getImageData(0, 0, canvasEl.width, canvasEl.height).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] !== 20 || data[i + 1] !== 10 || data[i + 2] !== 31) n++;
    return n;
  });
}

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`Delve navigation (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });

    test('aim and dig three cells away, drag a bridge, step up a ledge, and the map remembers', async ({ page }) => {
      test.setTimeout(150_000);
      const f = delve();
      await seed(page, { ...f.blobs(), ...bag({ 'dirt-block': 10 }) });
      await descend(page);
      const campX = await playerX(page);
      expect(Math.floor(campX / CELL)).toBe(22);

      // ── 1. The smart cursor and a held dig, three columns east. ──
      const rock = await cellPoint(page, 25, 7);
      if (!touch) {
        await page.mouse.move(rock.x, rock.y);
        await page.waitForTimeout(300);
        await shot(page, `${label}-aim`);
        await page.mouse.down();
      } else {
        await finger(page, 'pointerdown', rock);
        await page.waitForTimeout(200);
        await shot(page, `${label}-aim`);
      }
      // Rock is 2 HP at Pickaxe I: two swings, then the debounced save (1.5 s).
      await expect.poll(() => kindAt(page, 25, 7), { timeout: 12000, intervals: [250] }).not.toBe(nodeIndex('rock'));
      if (!touch) await page.mouse.up(); else await finger(page, 'pointerup', rock);
      expect(Math.abs(await playerX(page) - campX), 'dug from where the Keeper stands').toBeLessThan(CELL);

      // ── 2. Drag a bridge of dirt blocks across the pit (cols 23-25, row 9). ──
      if (!touch) {
        await focusWorld(page);
        await page.keyboard.press('Digit1');
        await expect(messageLine(page)).toContainText('Dirt block ready');
      } else await page.locator('.hotbar .hot[title="Dirt block"]').tap();
      const from = await cellPoint(page, 23, 9), to = await cellPoint(page, 25, 9);
      if (!touch) {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down({ button: 'right' });
        await page.mouse.move(to.x, to.y, { steps: 6 });
        await page.waitForTimeout(1500);
        await page.mouse.up({ button: 'right' });
      } else {
        await finger(page, 'pointerdown', from);
        for (let i = 1; i <= 6; i++) await finger(page, 'pointermove', { x: from.x + (to.x - from.x) * i / 6, y: from.y });
        await page.waitForTimeout(1500);
        await finger(page, 'pointerup', to);
      }
      await expect.poll(async () => [await kindAt(page, 23, 9), await kindAt(page, 24, 9), await kindAt(page, 25, 9)], { timeout: 8000, intervals: [250] })
        .toEqual([nodeIndex('packed-dirt'), nodeIndex('packed-dirt'), nodeIndex('packed-dirt')]);
      expect(await hotbarCount(page, 'Dirt block')).toBe(7);
      await shot(page, `${label}-bridge`);
      // Walk across: without the bridge the Keeper drops into a pit three cells deep and stays there.
      await walk(page, 'd', 27 * CELL, 10000);

      // ── 3. West to the one-cell ledge at col 19: walking steps up it, no jump. ──
      await walk(page, 'a', 17 * CELL, 15000);
      await page.waitForTimeout(300);
      expect(await playerX(page)).toBeLessThan(18 * CELL);

      // ── 4. The map: open it, see the explored tunnel, close it; it survives a reload. ──
      if (!touch) { await focusWorld(page); await page.keyboard.press('KeyM'); await page.getByRole('button', { name: 'Full map' }).click(); }
      else await page.locator('.map-mini-open').tap();
      await expect(page.locator('.map-full')).toBeVisible();
      await expect(page.locator('.map-hint')).toContainText('Way to camp');
      await page.waitForTimeout(500);
      const before = await exploredPixels(page);
      expect(before).toBeGreaterThan(200);
      await shot(page, `${label}-map`);
      if (!touch) await page.keyboard.press('Escape'); else await page.locator('.map-close').tap();
      await expect(page.locator('.map-full')).toBeHidden();
      await page.waitForTimeout(2500); // the explored cells ride the Delve's 1.5 s debounced write
      const seen = (await delveSave<{ areas: Record<string, { seen?: string }> }>(page))?.areas['ember-delve']?.seen ?? '';
      expect(seen.length).toBeGreaterThan(0);
      await shot(page, `${label}-minimap`);

      // A fresh page load (descend opens /play again), then back down to the camp.
      await descend(page);
      if (!touch) { await focusWorld(page); await page.keyboard.press('KeyM'); await page.getByRole('button', { name: 'Full map' }).click(); }
      else await page.locator('.map-mini-open').tap();
      await expect(page.locator('.map-full')).toBeVisible();
      await page.waitForTimeout(500);
      const after = await exploredPixels(page);
      expect(after, `explored before the reload: ${before} px; after: ${after} px`).toBeGreaterThanOrEqual(Math.floor(before * .95));
    });

    test('map v2: place a pin, choose its icon and name, track the way to it; it survives a reload; remove it', async ({ page }) => {
      test.setTimeout(150_000);
      const f = delve();
      await seed(page, f.blobs());
      await descend(page);
      const openMap = async () => {
        if (!touch) { await focusWorld(page); await page.keyboard.press('KeyM'); await page.getByRole('button', { name: 'Full map' }).click(); }
        else await page.locator('.map-mini-open').tap();
        await expect(page.locator('.map-full')).toBeVisible();
        await page.waitForTimeout(500);
      };
      const press = async (l: ReturnType<Page['locator']>) => { if (touch) await l.tap(); else await l.click(); };
      await openMap();
      await expect(page.locator('.map-canvas')).toHaveAttribute('data-pins', '0');
      // Arm "Add pin", then tap the explored tunnel's west end (col 16, row 7): the way there is explored.
      await press(page.locator('.map-pin-add'));
      await expect(page.locator('.map-hint')).toContainText('Tap the map where the pin goes');
      const at = await mapPoint(page, 16, 7);
      if (touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
      await expect(page.locator('.map-canvas')).toHaveAttribute('data-pins', '1');
      await expect(page.locator('.map-pin-edit')).toBeVisible();
      // Every editor control is a 44px target.
      for (const control of await page.locator('.map-pin-edit button, .map-pin-edit input, .map-pins button').all()) {
        const b = await control.boundingBox();
        if (b) expect(Math.min(b.width, b.height), 'a pin control under 44px').toBeGreaterThanOrEqual(44);
      }
      await press(page.getByRole('radio', { name: 'Fish' }));
      await expect(page.getByRole('radio', { name: 'Fish' })).toHaveAttribute('aria-checked', 'true');
      const name = page.locator('.map-pin-name input');
      await name.fill('Lake');
      await name.press('Enter');
      await press(page.locator('.map-pin-track'));
      await expect(page.locator('.map-pin-chip', { hasText: 'Lake' })).toContainText('tracked');
      await expect(page.locator('.map-hint')).toContainText(/Way to Lake: \d+ cells/);
      await shot(page, `${label}-pin`);
      if (!touch) await page.keyboard.press('Escape'); else await page.locator('.map-close').tap();
      await page.waitForTimeout(2500); // the pin rides the Delve's 1.5 s debounced write

      // A fresh page load: the pin is still there, tracked, with its icon and name.
      await descend(page);
      await openMap();
      await expect(page.locator('.map-canvas')).toHaveAttribute('data-pins', '1');
      await expect(page.locator('.map-pin-chip', { hasText: 'Lake' })).toContainText('tracked');
      await expect(page.locator('.map-hint')).toContainText('Way to Lake');
      // Remove it: gone from the map and the save.
      await press(page.locator('.map-pin-chip', { hasText: 'Lake' }));
      await press(page.locator('.map-pin-remove'));
      await expect(page.locator('.map-canvas')).toHaveAttribute('data-pins', '0');
      await expect(page.locator('.map-hint')).toContainText('Way to camp');
    });
  });
}
