/**
 * play-delve-endless.spec.ts — the endless Delve (Phase 7, horizontal first;
 * docs/handoff/endless-delve.md), at 1280×800 with a mouse and 390×844 with
 * touch:
 *
 *   - from a camp at the core's east end, walk three sectors east along an old
 *     tunnel under the surface (the ring streams sector columns in as the
 *     Keeper goes). One World: the surface over it is the Seamworks' street,
 *     the Quarry Road and the Quarry Gate, so the walk is underground
 *   - dig the two floor cells either side of a sector border (cols 223 | 224)
 *     and build a dirt block back into one: both sectors' diffs reach the save
 *   - the full map lists the explored sector columns east of the core
 *   - reload: the dug cell is still open (a block goes into it), the built
 *     one still holds a block (it digs back out), and the map still lists them
 *
 * The camp is laid by the game's own pure code (play-delve-fixtures.ts) and
 * reached by the shaft's real "Descend to your camp". Screenshots go to
 * output/endless/ when DELVE_ENDLESS_SHOTS is set (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, canvas, focusWorld, hotbarCount, messageLine, openPlay, playerX, seed, walk, walkTo, SHAFT_X } from './play-helpers';
import { CELL, DelveFixture, nodeIndex, SPEC, withSectors } from './play-delve-fixtures';
import { decodeRuns } from '../src/app/shared/delve/delve-region.model';

const SHOTS = process.env['DELVE_ENDLESS_SHOTS'];
/** The tunnel: rows 4-6 open, row 7 its floor (rock), from the camp at col 112 to col 228. */
const TUNNEL = { top: 4, bottom: 6, floor: 7, from: 112, to: 228 };
/** The Keeper walks the tunnel: feet on its floor's top edge. */
const FEET = SPEC.top + TUNNEL.floor * CELL;
const WEST = 223, EAST = 224; // the last column of sector 6 | the first of sector 7
const ROW = TUNNEL.floor;
/** A sector's local cell index of (col, row) (rows 0-31 are sector row 0). */
const local = (col: number, row: number) => row * 32 + (col % 32);

/** The tunnel as the game's own save: the core's part in the core diff, the rest in sector diffs. */
function tunnelSave(): Record<string, unknown> {
  const f = new DelveFixture().carve(TUNNEL.from, 119, TUNNEL.top, TUNNEL.bottom);
  for (let col = TUNNEL.from; col <= 119; col++) f.set(col, TUNNEL.floor, 'rock');
  f.camp(TUNNEL.from, TUNNEL.bottom);
  const cells: { col: number; row: number; id: string }[] = [];
  for (let col = 120; col <= TUNNEL.to; col++) {
    for (let row = TUNNEL.top; row <= TUNNEL.bottom; row++) cells.push({ col, row, id: 'air' });
    cells.push({ col, row: TUNNEL.floor, id: col === WEST || col === EAST ? 'dirt' : 'rock' });
    cells.push({ col, row: TUNNEL.top - 1, id: 'rock' });
  }
  cells.push({ col: TUNNEL.to + 1, row: TUNNEL.top, id: 'rock' }, { col: TUNNEL.to + 1, row: TUNNEL.top + 1, id: 'rock' }, { col: TUNNEL.to + 1, row: TUNNEL.bottom, id: 'rock' });
  return withSectors(f, cells);
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/endless/${name}.png` });
}

async function descend(page: Page): Promise<void> {
  await openPlay(page);
  await walkTo(page, SHAFT_X, 30);
  const button = page.getByRole('button', { name: /Descend to your camp/ });
  await expect(button).toBeVisible();
  await button.click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await page.waitForTimeout(1500);
  await focusWorld(page);
}

/** A surface cell's centre in client px, by the engine's camera rule (endless: never clamped near the core). */
async function cellPoint(page: Page, col: number, row: number): Promise<{ x: number; y: number }> {
  const px = await playerX(page);
  return canvas(page).evaluate((c, a) => {
    const rect = c.getBoundingClientRect();
    const parent = c.parentElement!;
    const w = Math.max(320, parent.clientWidth || rect.width), h = Math.max(300, parent.clientHeight || rect.height);
    const scale = h / 720, viewport = w / scale;
    const camera = a.px - viewport * .38;
    const cameraY = Math.min(a.bottom + 40 - 720, a.feetY - 720 * .58);
    return { x: rect.left + (a.wx - camera) * scale * (rect.width / w), y: rect.top + (a.wy - cameraY) * scale * (rect.height / h) };
  }, { px, feetY: FEET, wx: (col + .5) * CELL, wy: SPEC.top + (row + .5) * CELL, bottom: SPEC.top + SPEC.rows * CELL });
}

async function finger(page: Page, type: 'pointerdown' | 'pointerup', at: { x: number; y: number }): Promise<void> {
  await canvas(page).dispatchEvent(type, { pointerType: 'touch', pointerId: 9, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: at.x, clientY: at.y, bubbles: true });
}

/** Hold-dig a cell (mouse left / a finger with the pick). */
async function dig(page: Page, touch: boolean, col: number, row: number): Promise<void> {
  const at = await cellPoint(page, col, row);
  if (!touch) { await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.waitForTimeout(1600); await page.mouse.up(); }
  else { await finger(page, 'pointerdown', at); await page.waitForTimeout(1600); await finger(page, 'pointerup', at); }
}
/** Put the chosen block into a cell (right press / a tap with a placeable chosen). */
async function place(page: Page, touch: boolean, col: number, row: number): Promise<void> {
  if (!touch) { await focusWorld(page); await page.keyboard.press('Digit1'); }
  else await page.locator('.hotbar .hot[title="Dirt block"]').tap();
  const at = await cellPoint(page, col, row);
  if (!touch) { await page.mouse.move(at.x, at.y); await page.mouse.down({ button: 'right' }); await page.waitForTimeout(400); await page.mouse.up({ button: 'right' }); }
  else { await finger(page, 'pointerdown', at); await page.waitForTimeout(400); await finger(page, 'pointerup', at); }
  if (touch) await page.locator('.hotbar .hot--pick').tap(); // back to the pick
  else await page.keyboard.press('Digit1');
}

/**
 * A sector's saved cells as this device holds them: the device store
 * (IndexedDB `eclipse-delve`, written on the 1.5 s debounce). The cloud slot
 * blobs (`godforge-delve-r<n>`) follow at most every 30 s; `slot` reads those.
 */
async function sectorCells(page: Page, key: string, from: 'device' | 'slot' = 'device'): Promise<Map<number, number>> {
  const encoded = await page.evaluate(async ([k, where]) => {
    if (where === 'slot') {
      for (let n = 0; n < 24; n++) {
        const raw = localStorage.getItem(`godforge-world-r${n}`);
        if (!raw) continue;
        try { const region = JSON.parse(raw); if (region?.world === 'ember' && region?.sectors?.[k]?.c) return region.sectors[k].c as string; } catch { /* next */ }
      }
      return '';
    }
    return new Promise<string>(resolve => {
      const open = indexedDB.open('eclipse-world', 1);
      open.onerror = () => resolve('');
      open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('regions')) open.result.createObjectStore('regions'); };
      open.onsuccess = () => {
        try {
          const all = open.result.transaction('regions', 'readonly').objectStore('regions').getAll();
          all.onsuccess = () => { const hit = (all.result as { world?: string; sectors?: Record<string, { c?: string }> }[]).find(r => (r.world ?? 'ember') === 'ember' && r.sectors?.[k]?.c); open.result.close(); resolve(hit?.sectors?.[k]?.c ?? ''); };
          all.onerror = () => { open.result.close(); resolve(''); };
        } catch { open.result.close(); resolve(''); }
      };
    });
  }, [key, from] as const);
  return decodeRuns(encoded);
}

async function openMap(page: Page, touch: boolean): Promise<string> {
  // One World: M opens the Travel map; its "Full map" is the Delve's map.
  if (!touch) { await focusWorld(page); await page.keyboard.press('KeyM'); await page.getByRole('button', { name: 'Full map' }).click(); }
  else await page.locator('.map-mini-open').tap();
  await expect(page.locator('.map-full')).toBeVisible();
  await expect(page.locator('.map-full canvas')).toHaveAttribute('data-explored', /\d/, { timeout: 5000 });
  return (await page.locator('.map-full canvas').getAttribute('data-explored')) ?? '';
}
async function closeMap(page: Page, touch: boolean): Promise<void> {
  if (!touch) await page.keyboard.press('Escape'); else await page.locator('.map-close').tap();
  await expect(page.locator('.map-full')).toBeHidden();
}

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`The endless Delve (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });

    test('walk three sectors east, dig and build across a sector border, reload, and the map remembers', async ({ page }) => {
      test.setTimeout(180_000);
      await seed(page, { ...tunnelSave(), ...bag({ 'dirt-block': 10 }), 'preferred-language': 'en' });
      await descend(page);
      expect(Math.floor(await playerX(page) / CELL)).toBe(112);

      // ── 1. Three sector borders east (128, 160, 192) along the tunnel. ──
      await walk(page, 'd', (WEST - 1.4) * CELL, 60_000);
      await page.waitForTimeout(800);
      const x = await playerX(page);
      expect(Math.floor(x / CELL)).toBeGreaterThanOrEqual(220);
      await shot(page, `${label}-east`);

      // ── 2. Dig either side of the border, build a block back into the east one. ──
      const before = await hotbarCount(page, 'Dirt block');
      await dig(page, touch, WEST, ROW);
      await dig(page, touch, EAST, ROW);
      await expect.poll(async () => (await sectorCells(page, '6,0')).get(local(WEST, ROW)), { timeout: 10_000, intervals: [300] }).toBe(0);
      // The first change of a region goes up to its cloud slot at once (later ones at most every 30 s).
      await expect.poll(async () => (await sectorCells(page, '6,0', 'slot')).get(local(WEST, ROW)), { timeout: 10_000, intervals: [300] }).toBe(0);
      await expect.poll(async () => (await sectorCells(page, '7,0')).get(local(EAST, ROW)), { timeout: 10_000, intervals: [300] }).toBe(0);
      expect(await hotbarCount(page, 'Dirt block')).toBe(before + 2);
      await place(page, touch, EAST, ROW);
      await expect.poll(async () => (await sectorCells(page, '7,0')).get(local(EAST, ROW)), { timeout: 10_000, intervals: [300] }).toBe(nodeIndex('packed-dirt'));
      await shot(page, `${label}-border`);

      // ── 3. The map lists the sector columns explored on the way. ──
      const explored = (await openMap(page, touch)).split(',').map(Number);
      for (const sx of [3, 4, 5, 6]) expect(explored).toContain(sx);
      await page.waitForTimeout(400);
      await shot(page, `${label}-map`);
      await closeMap(page, touch);
      await page.waitForTimeout(2500); // the 1.5 s debounce: the device store and the slots are written

      // ── 4. A fresh page: back to the camp, east again. ──
      await descend(page);
      await walk(page, 'd', (WEST - 1.4) * CELL, 60_000);
      await page.waitForTimeout(800);
      const again = (await openMap(page, touch)).split(',').map(Number);
      for (const sx of [4, 5, 6]) expect(again, 'explored sectors survive the reload').toContain(sx);
      await closeMap(page, touch);
      // The dug west cell is still open: a block goes into it.
      const held = await hotbarCount(page, 'Dirt block');
      await place(page, touch, WEST, ROW);
      await expect.poll(() => hotbarCount(page, 'Dirt block'), { timeout: 6000 }).toBe(held - 1);
      // The built east cell still holds the block: it digs back out as one.
      await dig(page, touch, EAST, ROW);
      await expect.poll(() => hotbarCount(page, 'Dirt block'), { timeout: 8000 }).toBe(held);
      await expect(messageLine(page)).not.toContainText('Something is already there');
      await shot(page, `${label}-reloaded`);
    });
  });
}
