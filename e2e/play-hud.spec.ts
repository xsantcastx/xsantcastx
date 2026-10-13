/**
 * play-hud.spec.ts — the /play HUD stays off the world it frames.
 *
 *   - The Hearth chat starts folded to one pill. In every town, at 1280×800 and
 *     on a 390×844 phone, the pill's rect touches no stall's hit box (the
 *     engine's own `stationAt` box: |x − station.x| ≤ width / 2, FLOOR − 240 to
 *     FLOOR + 70, mapped through the camera), the action bar, or the satchel.
 *   - Opening a station folds an open Hearth; the open / folded choice is
 *     remembered across a reload; it is all reachable from the keyboard.
 *   - Standing in a town (the Infernal camp included, where Rivet Maws roam
 *     past the safe ground) shows no enemy bar.
 *   - From 901px up (the 960 band included) the open satchel book never covers
 *     the folded Hearth pill or the goal line, and the book and an open Hearth
 *     take turns.
 *
 *   - The canvas cues ("CLICK TO WALK HERE" on a hovered or tapped station,
 *     "[ J / E ] GATHER" / "NEEDS …" at a gathering node) are drawn clear of the
 *     action bar at 1280×800 and on a 390×844 phone: an init script records
 *     where `fillText` put them on screen (through the canvas transform).
 *
 * Name tags staying inside the canvas is checked frame by frame in
 * play-life.spec.ts, which already records every tag the engine draws.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, ERA, focusWorld, openPlay, placePanel, playerX, seed, walkTo } from './play-helpers';
import { STATION_CUE_Y } from '../src/app/play/engine/engine.model';
import { TOWNS, VIEW_HEIGHT } from '../src/app/play/world/world.model';
import type { RealmTownId, TownDef } from '../src/app/play/world/world.model';

/** engine.model.ts FLOOR: the town floor line, world px. */
const FLOOR = 610;
const HEARTH_KEY = 'eclipse-hearth-open';

/** One panel station per town to stand at. Infernal's Enchanting Table is inside the Maws' reach. */
const STANDS: Record<RealmTownId, string> = {
  infernal: 'enchanting',
  luminous: 'market',
  umbral: 'exchange',
  celestial: 'leaderboards',
  verdant: 'quests',
};

interface Rect { left: number; top: number; right: number; bottom: number }
const meets = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

async function rectOf(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return null;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, selector);
}

/** Every station's hit box on screen, from the engine's camera rule (render(): camera = x − viewport × .38, clamped). */
async function stallBoxes(page: Page, town: TownDef): Promise<{ id: string; rect: Rect }[]> {
  const view = await canvas(page).evaluate(c => {
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const x = await playerX(page);
  const scale = view.height / VIEW_HEIGHT;
  const viewport = view.width / scale;
  const camera = Math.max(0, Math.min(town.width - viewport, x - viewport * .38));
  return town.stations.map(s => {
    const half = (s.width ?? 120) / 2;
    return {
      id: s.id,
      rect: {
        left: view.left + (s.x - half - camera) * scale,
        right: view.left + (s.x + half - camera) * scale,
        top: view.top + (FLOOR - 240) * scale,
        bottom: view.top + (FLOOR + 70) * scale,
      },
    };
  }).filter(b => b.rect.right > view.left && b.rect.left < view.left + view.width);
}

/** Stand at the town's panel station (deep link moves the Keeper there and opens it), then close it. */
async function standIn(page: Page, realm: RealmTownId): Promise<TownDef> {
  const town = TOWNS[realm]!;
  await openPlay(page, `?at=${STANDS[realm]}`);
  await expect(canvas(page)).toHaveAttribute('data-area', town.name);
  await expect(placePanel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(placePanel(page)).toBeHidden();
  await page.waitForTimeout(300);
  return town;
}

/** Record where the engine draws its one-line canvas cues, in CSS px. */
async function recordCues(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const W = window as unknown as { __cues: Record<string, { left: number; top: number; right: number; bottom: number }> };
    W.__cues = {};
    const P = CanvasRenderingContext2D.prototype, fill = P.fillText;
    P.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, max?: number) {
      const el = this.canvas as HTMLCanvasElement;
      if (/^(CLICK TO WALK HERE|\[ J \/ E \] GATHER|NEEDS |GROWING BACK )/.test(text) && el.closest?.('.viewport')) {
        const m = this.getTransform(), box = el.getBoundingClientRect(), k = box.height / el.height;
        const w = this.measureText(text).width;
        // Baseline-alphabetic, 12px: the glyphs sit in the 12px above the baseline.
        W.__cues[text.startsWith('CLICK') ? 'hover' : 'site'] = {
          left: box.left + (m.a * (x - w / 2) + m.e) * k, right: box.left + (m.a * (x + w / 2) + m.e) * k,
          top: box.top + (m.d * (y - 12) + m.f) * k, bottom: box.top + (m.d * (y + 2) + m.f) * k,
        };
      }
      return max === undefined ? fill.call(this, text, x, y) : fill.call(this, text, x, y, max);
    };
  });
}

async function cue(page: Page, kind: 'hover' | 'site'): Promise<Rect> {
  await expect.poll(() => page.evaluate(k => !!(window as unknown as { __cues: Record<string, unknown> }).__cues[k], kind), { timeout: 10000 }).toBe(true);
  return page.evaluate(k => (window as unknown as { __cues: Record<string, Rect> }).__cues[k], kind);
}

/** The cue is on the canvas and clear of the action bar (and the touch row on a phone). */
async function assertCueClear(page: Page, kind: 'hover' | 'site'): Promise<void> {
  const at = await cue(page, kind);
  const view = (await rectOf(page, '.viewport canvas'))!;
  expect(at.top, `${kind} cue inside the canvas`).toBeGreaterThanOrEqual(view.top);
  expect(at.bottom, `${kind} cue inside the canvas`).toBeLessThanOrEqual(view.bottom);
  // Above the bottom HUD band's top edge, wherever along it the cue falls: the
  // armed bar's width follows its label, so missing it sideways is luck.
  const vh = page.viewportSize()!.height;
  for (const sel of ['.prompt', '.touch', '.dock']) {
    const other = await rectOf(page, sel);
    if (other && other.top > vh / 2) expect(at.bottom, `${kind} cue reaches down to ${sel}`).toBeLessThanOrEqual(other.top);
  }
}

/** Point at (desktop) or tap (phone) a station far from the Keeper; its hover cue lights. */
async function pointAtFarStation(page: Page, town: TownDef, touch: boolean): Promise<void> {
  // From the spawn (x 160) a phone shows no stall yet; a few steps east bring the ore seam on screen.
  await walkTo(page, 320, 30);
  const view = await canvas(page).evaluate(c => { const r = c.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
  const x = await playerX(page);
  const scale = view.height / VIEW_HEIGHT;
  const viewport = view.width / scale;
  const camera = Math.max(0, Math.min(town.width - viewport, x - viewport * .38));
  const station = town.stations.find(s => Math.abs(s.x - x) > (s.width ?? 120) / 2 + 60 && (s.x - camera) * scale > 30 && (s.x - camera) * scale < view.width - 30);
  expect(station, `a station on screen away from the Keeper (x ${x}, camera ${camera})`).toBeTruthy();
  const at = { x: view.left + (station!.x - camera) * scale, y: view.top + (FLOOR - 100) * scale };
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.move(at.x, at.y);
  // The cue is drawn over the station, never on the floor band.
  expect(STATION_CUE_Y).toBeLessThan(FLOOR - 200);
}

/** Through the East Passage (beacon lit) to Ember Quarry, beside its Starlight Herb tuft (x 340). */
async function besideQuarryHerb(page: Page): Promise<void> {
  await seed(page, { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } });
  await openPlay(page);
  await page.locator('.places-toggle').click();
  await page.locator('#places-list button', { hasText: 'East Passage' }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry', { timeout: 60000 });
  await page.waitForTimeout(400);
  await walkTo(page, 340, 25);
  await expect(page.locator('.prompt.armed')).toBeVisible();
}

async function assertPillClear(page: Page, town: TownDef, also: string[]): Promise<void> {
  await expect(page.locator('.dock.collapsed .hearth-pill')).toBeVisible();
  await expect(page.locator('#hearth-body')).toBeHidden();
  const pill = (await rectOf(page, '.dock'))!;
  expect(pill, 'the folded Hearth has a box').not.toBeNull();
  // A pill, not a panel.
  expect(pill.bottom - pill.top).toBeLessThanOrEqual(56);
  const vw = page.viewportSize()!;
  expect(pill.left).toBeGreaterThanOrEqual(0);
  expect(pill.right).toBeLessThanOrEqual(vw.width);
  expect(pill.bottom).toBeLessThanOrEqual(vw.height);
  const hits = (await stallBoxes(page, town)).filter(b => meets(pill, b.rect)).map(b => b.id);
  expect(hits, `${town.name}: stalls under the Hearth pill`).toEqual([]);
  for (const sel of also) {
    const other = await rectOf(page, sel);
    if (other) expect(meets(pill, other), `${town.name}: Hearth pill over ${sel}`).toBe(false);
  }
}

test.describe('the /play HUD at 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.describe.configure({ timeout: 180000 });

  test('in every town the folded Hearth clears the stalls and the action bar, and no enemy bar shows', async ({ page }) => {
    await seed(page);
    for (const realm of Object.keys(STANDS) as RealmTownId[]) {
      const town = await standIn(page, realm);
      // At the station: the action bar is armed with its "Interact E".
      await expect(page.locator('.prompt.armed')).toBeVisible();
      await assertPillClear(page, town, ['.prompt', '.satchel', '.vitals']);
      await expect(page.locator('.vitals .meter.enemy'), `${town.name}: no enemy bar in town`).toHaveCount(0);
    }
  });

  test('the Infernal camp shows no enemy bar anywhere on its safe ground', async ({ page }) => {
    await seed(page);
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
    for (const at of ['crafting', 'runes', 'enchanting']) {
      await openPlay(page, `?at=${at}`);
      await page.keyboard.press('Escape');
      await expect(placePanel(page)).toBeHidden();
      await page.waitForTimeout(300);
      await expect(page.locator('.vitals .meter.enemy'), `no enemy bar at ${at}`).toHaveCount(0);
    }
  });

  test('the Hearth opens from the keyboard, folds on Escape, folds when a station opens, and remembers the choice', async ({ page }) => {
    await seed(page);
    await openPlay(page);
    const pill = page.locator('.hearth-pill');
    await expect(pill).toHaveAttribute('aria-expanded', 'false');
    await expect(pill).toHaveAttribute('aria-controls', 'hearth-body');
    await pill.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#hearth-body')).toBeVisible();
    await expect(page.locator('#keeper-name')).toBeFocused();
    await expect(page.locator('.hearth-hide')).toHaveAttribute('aria-expanded', 'true');
    // Open, the panel still ends above the action bar.
    const dock = (await rectOf(page, '.dock'))!;
    const bar = await rectOf(page, '.prompt');
    if (bar) expect(meets(dock, bar)).toBe(false);
    // Escape inside folds it, focus back on the pill.
    await page.keyboard.press('Escape');
    await expect(page.locator('#hearth-body')).toBeHidden();
    await expect(page.locator('.hearth-pill')).toBeFocused();
    // Open it, reload: still open. A station opening folds it, the choice survives.
    await page.locator('.hearth-pill').click();
    await expect(page.locator('#hearth-body')).toBeVisible();
    await expect.poll(() => page.evaluate(k => localStorage.getItem(k), HEARTH_KEY)).toBe('1');
    await openPlay(page);
    await expect(page.locator('#hearth-body')).toBeVisible();
    await openPlay(page, '?at=crafting');
    await expect(placePanel(page)).toBeVisible();
    await expect(page.locator('#hearth-body')).toBeHidden();
    await expect(page.locator('.dock.collapsed')).toHaveCount(1);
    expect(await page.evaluate(k => localStorage.getItem(k), HEARTH_KEY)).toBe('1');
    // Hide from its own button: remembered folded.
    await page.keyboard.press('Escape');
    await expect(placePanel(page)).toBeHidden();
    await page.locator('.hearth-pill').click();
    await page.locator('.hearth-hide').click();
    await expect(page.locator('#hearth-body')).toBeHidden();
    await expect.poll(() => page.evaluate(k => localStorage.getItem(k), HEARTH_KEY)).toBe('0');
  });

  test('the pill speaks Spanish', async ({ page }) => {
    await seed(page, { 'preferred-language': 'es' });
    await openPlay(page);
    await expect(page.locator('.hearth-pill')).toContainText('Hogar');
    await expect(page.locator('.hearth-pill')).toHaveAttribute('aria-label', /Abrir la charla del Hogar/);
  });

  test('the HUD\'s own lines speak Spanish: top bar, quest chain, satchel, action bar', async ({ page }) => {
    await seed(page, { 'preferred-language': 'es' });
    await openPlay(page);
    await expect(page.locator('.top-actions')).toContainText('Lugares');
    await expect(page.locator('.top-actions')).toContainText('Volver al campamento');
    await expect(page.locator('.satchel .clasp')).toContainText('Mochila');
    await expect(page.locator('.satchel .tally')).toContainText('Monedas');
    await expect(page.locator('.keys-toggle')).toHaveText('Teclas');
    // The Seamworks quest chain on the objective line (engine-keyed or the HUD's own), never the English.
    await page.locator('.top-actions .quiet').first().click();
    await expect(page.locator('.objective')).toHaveText('De vuelta en el campamento. Tu equipo y el botin recogido estan a salvo.');
    await openPlay(page, '?at=forge');
    await expect(page.locator('.prompt.armed strong')).toHaveText(/^(Forjar|Equipar) Basalt Edge|Hoja equipada$/);
    await expect(page.locator('.prompt.armed button').first()).toContainText('Interactuar');
  });
});

test.describe('the /play canvas cues clear the action bar', () => {
  test.describe.configure({ timeout: 150000 });

  test('at 1280×800: hover cue over a stall, gather cue over a node', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await recordCues(page);
    await seed(page);
    await openPlay(page);
    await pointAtFarStation(page, TOWNS.infernal!, false);
    await assertCueClear(page, 'hover');
    await besideQuarryHerb(page);
    await assertCueClear(page, 'site');
  });
});

test.describe('the /play canvas cues on a 390×844 phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.describe.configure({ timeout: 150000 });

  test('a tapped stall\'s cue and a node\'s gather cue clear the action bar and the touch row', async ({ page }) => {
    await recordCues(page);
    await seed(page);
    await openPlay(page);
    await pointAtFarStation(page, TOWNS.infernal!, true);
    await assertCueClear(page, 'hover');
    await besideQuarryHerb(page);
    await assertCueClear(page, 'site');
  });
});

test.describe('the /play HUD at 960×800 (the 901–1000px band)', () => {
  test.use({ viewport: { width: 960, height: 800 } });
  test.describe.configure({ timeout: 120000 });

  test('the open satchel book never covers the Hearth pill, and the book and an open Hearth take turns', async ({ page }) => {
    await seed(page);
    await openPlay(page);
    for (const width of [905, 960, 1000, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.keyboard.press('i');
      await expect(page.locator('#satchel-book')).toBeVisible();
      await expect(page.locator('.dock.collapsed .hearth-pill')).toBeVisible();
      const book = (await rectOf(page, '#satchel-book'))!;
      const pill = (await rectOf(page, '.hearth-pill'))!;
      expect(meets(book, pill), `${width}px: satchel book over the Hearth pill`).toBe(false);
      // Hit test at the pill's centre: a click there reaches the pill, not the book.
      const onPill = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.hearth-pill'),
        { x: (pill.left + pill.right) / 2, y: (pill.top + pill.bottom) / 2 });
      expect(onPill, `${width}px: the pill takes its own click`).toBe(true);
      // The goal line steps aside rather than sit under the book.
      const guide = await rectOf(page, '.guide');
      if (guide) expect(meets(book, guide), `${width}px: book over the goal line`).toBe(false);
      await page.keyboard.press('Escape');
      await expect(page.locator('#satchel-book')).toHaveCount(0);
      await focusWorld(page);
    }
    // Opening the Hearth closes the book; opening the book folds the Hearth (the choice is remembered as open).
    await page.setViewportSize({ width: 960, height: 800 });
    await page.keyboard.press('i');
    await expect(page.locator('#satchel-book')).toBeVisible();
    await page.locator('.hearth-pill').click();
    await expect(page.locator('#hearth-body')).toBeVisible();
    await expect(page.locator('#satchel-book')).toHaveCount(0);
    await page.locator('.satchel .clasp').click();
    await expect(page.locator('#satchel-book')).toBeVisible();
    await expect(page.locator('#hearth-body')).toBeHidden();
    expect(await page.evaluate(k => localStorage.getItem(k), HEARTH_KEY)).toBe('1');
  });
});

test.describe('the /play HUD on a 390×844 phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.describe.configure({ timeout: 180000 });

  test('in every town the folded Hearth clears the stalls, the action bar, the satchel and the touch row', async ({ page }) => {
    await seed(page);
    for (const realm of Object.keys(STANDS) as RealmTownId[]) {
      const town = await standIn(page, realm);
      await expect(page.locator('.prompt.armed')).toBeVisible();
      await assertPillClear(page, town, ['.prompt', '.satchel', '.vitals', '.touch']);
      await expect(page.locator('.vitals .meter.enemy'), `${town.name}: no enemy bar in town`).toHaveCount(0);
    }
  });
});
