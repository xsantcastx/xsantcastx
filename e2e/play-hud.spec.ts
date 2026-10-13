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
 *
 * Name tags staying inside the canvas is checked frame by frame in
 * play-life.spec.ts, which already records every tag the engine draws.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, openPlay, placePanel, playerX, seed } from './play-helpers';
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
