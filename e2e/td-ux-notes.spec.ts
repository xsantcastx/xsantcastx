/**
 * td-ux-notes.spec.ts — the owner's player notes of 2026-10-21, played in a real browser:
 *   - the pinned item card fits the window (1280×720, 1440×800) and Equip on a bottom-row item can be pressed;
 *   - Escape closes every hotkey menu (I, K, C, B, M), and the same hotkey again closes it;
 *   - the prologue card shows pixel key caps on a computer;
 *   - the Diablo II experience bar and its tooltip; the character sheet's Skills page;
 *   - HUD pieces drag on a computer, are remembered, and Settings → Reset HUD layout puts them back;
 *   - the Map: wheel and button zoom, a drag pans, a cave floor from the area picker, a pin that never moves under the
 *     pointer, a click on a pin travels; the search finds a place;
 *   - Enter opens the chat; typing "wasd 123 k" there moves nothing and opens nothing; Enter sends.
 * Screenshots: docs/handoff/cozy-ui/ux-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed } from './play-helpers';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

const canvas = (page: Page) => page.locator('.viewport canvas');

function gear(id: string, i: number): unknown {
  return {
    id, definitionId: 'voidweave-cowl', kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name: `Cowl ${i}`, type: 'artifact', stats: { defense: 6 + i, life: 20, castSpeed: 8, critChance: 3.5, magicFind: 5 }, sellValue: 1200, econ: 3,
    location: { kind: 'bag' }, itemLevel: 4,
  };
}

/** A Keeper at level 8 with some craft XP, a satchel of cowls, in the top-down world. */
async function enter(page: Page, query = '', fresh = false): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  const base = ledger({ 'cinder-ore': 4 }) as { records: unknown[]; hlc: number };
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(8) + 300, mining: 900, woodcutting: 120, fishing: 40 } as typeof act.progress.xpByDiscipline;
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA), ...(fresh ? {} : { 'godforge-activity': act }),
    'godforge-inventory': { ...base, records: [...base.records, ...Array.from({ length: 14 }, (_, i) => gear(`c${i}`, i))], hlc: base.hlc + 200 },
  });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card { visibility: hidden !important; }' });
}
const focusWorld = (page: Page) => canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
const inside = (b: { x: number; y: number; width: number; height: number }, w: number, h: number) =>
  b.x >= 0 && b.y >= 0 && b.x + b.width <= w + .5 && b.y + b.height <= h + .5;

for (const size of [{ width: 1280, height: 720 }, { width: 1440, height: 800 }]) {
  test(`the pinned item card fits ${size.width}×${size.height} and Equip on a bottom-row item works`, async ({ page }) => {
    await page.setViewportSize(size);
    await enter(page);
    await page.keyboard.press('i');
    const pockets = page.locator('button.pocket');
    await expect(pockets.first()).toBeVisible({ timeout: 10000 });
    // The last cell on the page sits in the grid's bottom row.
    const cell = pockets.last();
    const name = await cell.getAttribute('aria-label');
    await cell.click();
    const card = page.locator('.d2tip--pinned');
    await expect(card).toBeVisible();
    await page.waitForTimeout(250);
    const box = (await card.boundingBox())!;
    expect(inside(box, size.width, size.height), `card ${JSON.stringify(box)} inside ${size.width}×${size.height}`).toBe(true);
    const equip = card.locator('.d2tip__actions button.wear').first();
    await expect(equip).toBeEnabled();
    const eb = (await equip.boundingBox())!;
    expect(inside(eb, size.width, size.height)).toBe(true);
    // What a click there would hit is Equip itself (nothing over it).
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.d2tip__actions button.wear'), { x: eb.x + eb.width / 2, y: eb.y + eb.height / 2 })).toBe(true);
    if (size.width === 1280) await page.screenshot({ path: 'docs/handoff/cozy-ui/ux-card-fits.jpg', type: 'jpeg', quality: 80 });
    await equip.click();
    await expect(page.locator('.well[data-slot="head"].filled')).toBeVisible();
    await expect(page.locator(`button.pocket[aria-label="${name}"]`)).toHaveCount(0);
  });
}

test('Escape closes every hotkey menu, and the same key again closes it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enter(page);
  const menus: [string, string][] = [['i', '#satchel-book'], ['k', '.spellbook.sbt'], ['c', '.ksheet'], ['b', '.td-best'], ['m', '#places-list']];
  for (const [key, sel] of menus) {
    await focusWorld(page);
    await page.keyboard.press(key);
    await expect(page.locator(sel), `${key} opens ${sel}`).toBeVisible();
    // Focus inside the menu, as a player who clicked in it: Escape still closes it.
    await page.locator(sel).click({ position: { x: 30, y: 12 } });
    await page.keyboard.press('Escape');
    await expect(page.locator(sel), `Escape closes ${sel}`).toHaveCount(0);
    await focusWorld(page);
    await page.keyboard.press(key);
    await expect(page.locator(sel)).toBeVisible();
    await page.keyboard.press(key);
    await expect(page.locator(sel), `${key} again closes ${sel}`).toHaveCount(0);
  }
  // A pinned card over the satchel goes first, then the satchel.
  await focusWorld(page);
  await page.keyboard.press('i');
  await page.locator('button.pocket').first().click();
  await expect(page.locator('.d2tip--pinned')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.d2tip--pinned')).toHaveCount(0);
  await expect(page.locator('#satchel-book')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#satchel-book')).toHaveCount(0);
});

test('the prologue card shows key caps, the XP bar its tooltip, the sheet its Skills page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enter(page, '', true);
  const keys = page.locator('[data-guide-keys]');
  await expect(keys).toBeVisible();
  await expect(keys.locator('kbd')).toHaveText(['I', 'K', 'C', 'M', 'E', '1-4', 'Esc']);
  await expect(page.locator('[data-pro-keys]').first()).toBeVisible();
  await page.locator('.guide').screenshot({ path: 'docs/handoff/cozy-ui/ux-prologue-keys.jpg', type: 'jpeg', quality: 85 });
  // A Keeper some way along: level 8.
  await enter(page);
  // The experience bar: level 8 and a little, its tooltip on hover.
  const bar = page.locator('[data-xp-bar]');
  await expect(bar).toBeVisible();
  const pct = Number(await bar.getAttribute('data-xp-pct'));
  expect(pct).toBeGreaterThan(0);
  expect(pct).toBeLessThan(100);
  await bar.hover();
  await expect(page.locator('[data-xp-tip]')).toBeVisible();
  await expect(page.locator('[data-xp-tip]')).toContainText(/Level 8 · 300 \/ [\d,]+ XP · [\d.]+%/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/ux-keys-xp.jpg', type: 'jpeg', quality: 80 });
  // The Skills page: every skill the ledger tracks, its level and bar.
  await page.mouse.move(640, 300);
  await focusWorld(page);
  await page.keyboard.press('c');
  await page.locator('[data-sheet-skills]').click();
  const rows = page.locator('[data-skills] [data-skill]');
  await expect(rows).toHaveCount(9);
  await expect(page.locator('[data-skill="mining"]')).toHaveAttribute('data-skill-level', /^[2-9]|\d\d/);
  await expect(page.locator('[data-skill="hunting"] .ks__skill-xp')).toContainText(/XP to/);
  await page.locator('.ksheet').screenshot({ path: 'docs/handoff/cozy-ui/ux-skills.jpg', type: 'jpeg', quality: 80 });
});

test('HUD pieces drag on a computer, are remembered, and Reset HUD layout puts them back', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enter(page, '', true);
  const guide = page.locator('.guide[data-hud-drag="guide"]');
  await expect(guide).toBeVisible();
  const before = (await guide.boundingBox())!;
  await guide.hover();
  const grip = guide.locator('.hud-grip');
  await expect(grip).toBeVisible();
  const g = (await grip.boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x - 200, g.y - 60, { steps: 8 });
  await page.mouse.up();
  const moved = (await guide.boundingBox())!;
  expect(Math.round(moved.x - before.x)).toBeLessThan(-150);
  // Remembered on this device: a reload keeps it.
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await expect.poll(async () => Math.round((await page.locator('.guide[data-hud-drag="guide"]').boundingBox())!.x)).toBe(Math.round(moved.x));
  // Settings → Reset HUD layout.
  await focusWorld(page);
  await page.keyboard.press('m');
  await page.locator('#places-list [data-open="sound"]').click();
  await page.locator('[data-hud-reset]').click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => Math.round((await page.locator('.guide[data-hud-drag="guide"]').boundingBox())!.x)).toBe(Math.round(before.x));
});

test('the Map: zoom, pan, a cave floor, pins that never move, a pin that travels, the search', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enter(page);
  await page.keyboard.press('m');
  const view = page.locator('[data-map-view]');
  await expect(view).toBeVisible();
  await expect(page.locator('[data-map-me]')).toBeVisible();
  await expect(view.locator('.mw__zone').first()).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/ux-map-surface.jpg', type: 'jpeg', quality: 80 });
  const zoom = async () => Number(await view.getAttribute('data-zoom'));
  const vb = (await view.boundingBox())!;
  // The wheel zooms in about the cursor, and out again.
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await page.mouse.wheel(0, -500);
  await expect.poll(zoom).toBeGreaterThan(1.5);
  await page.mouse.wheel(0, 500);
  await expect.poll(zoom).toBeLessThan(1.5);
  // The buttons.
  await page.locator('[data-map-zoom-in]').click();
  await page.locator('[data-map-zoom-in]').click();
  await expect.poll(zoom).toBeGreaterThan(2);
  const z2 = await zoom();
  await page.locator('[data-map-zoom-out]').click();
  await expect.poll(zoom).toBeLessThan(z2);
  // A drag pans (the picture's left edge moves with the pointer).
  await page.locator('[data-map-zoom-in]').click();
  const mx = () => view.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--mx')));
  const x0 = await mx();
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await page.mouse.down();
  await page.mouse.move(vb.x + vb.width / 2 + 120, vb.y + vb.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  expect(Math.round(await mx() - x0)).not.toBe(0);
  // Centre on me: the Keeper's mark comes to the middle.
  await page.locator('[data-map-centre]').click();
  await page.waitForTimeout(300);
  const me = (await page.locator('[data-map-me] i').boundingBox())!;
  expect(Math.abs(me.x + me.width / 2 - (vb.x + vb.width / 2))).toBeLessThan(40);
  // A pin under the pointer does not move (no hover lift): same box, and it is still what is under the pointer.
  // (The first pin whose middle is its own: at this zoom a few town pins still overlap.)
  const pinIdTop = await view.evaluate(el => {
    for (const p of el.querySelectorAll<HTMLElement>('.mw__pin')) {
      const r = p.getBoundingClientRect();
      if (!r.width) continue;
      if (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.mw__pin') === p) return p.dataset['pin'] ?? '';
    }
    return '';
  });
  expect(pinIdTop).not.toBe('');
  const pin = view.locator(`.mw__pin[data-pin="${pinIdTop}"]`);
  const p0 = (await pin.boundingBox())!;
  await page.mouse.move(p0.x + p0.width / 2, p0.y + p0.height / 2);
  await page.waitForTimeout(200);
  const p1 = (await pin.boundingBox())!;
  expect([p1.x, p1.y, p1.width, p1.height]).toEqual([p0.x, p0.y, p0.width, p0.height]);
  const pinId = await pin.getAttribute('data-pin');
  expect(await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y)?.closest('.mw__pin') as HTMLElement | null)?.dataset['pin'] ?? '', { x: p0.x + p0.width / 2, y: p0.y + p0.height / 2 })).toBe(pinId);
  await expect(pin.locator('.mw__tip')).toBeVisible();
  // A cave's floor from the area picker: its own picture, its ways, no "you are here".
  const select = page.locator('[data-map-section]');
  const floor = await select.locator('option').evaluateAll(os => (os as HTMLOptionElement[]).map(o => o.value).find(v => /mine|cave/.test(v)) ?? '');
  expect(floor).not.toBe('');
  await select.selectOption(floor);
  await expect(view).toHaveAttribute('data-section', floor);
  await expect(page.locator('[data-map-me]')).toHaveCount(0);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/ux-map-floor.jpg', type: 'jpeg', quality: 80 });
  await select.selectOption('surface');
  await expect(page.locator('[data-map-me]')).toBeVisible();
  // The search finds a place by name.
  await page.locator('[data-map-find]').fill('vault');
  await expect(page.locator('[data-map-results] button').first()).toContainText(/vault/i);
  await page.locator('[data-map-find]').fill('');
  // A click on a pin goes there: the Map folds and the Keeper walks.
  const ship = view.locator('.mw__pin[data-kind="harbour"]').first();
  await ship.click();
  await expect(page.locator('#places-list')).toHaveCount(0);
});

let hearth: Hearth | null = null;
test.describe('chat', () => {
  test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL)); });
  test.afterAll(async () => { await hearth?.stop(); });
  test('Enter opens the chat; typing in it moves nothing and opens nothing; Enter sends and hands back the world', async ({ browser }, info) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await enterAs(page, hearth!.port, 'Aster', 'warlock');
      await focusWorld(page);
      const x0 = await canvas(page).getAttribute('data-player-x'), y0 = await canvas(page).getAttribute('data-player-y');
      await page.keyboard.press('Enter');
      const input = page.locator('.td-chat__say input');
      await expect(input).toBeFocused({ timeout: 5000 });
      await page.keyboard.type('wasd 123 k', { delay: 40 });
      await page.waitForTimeout(400);
      await expect(input).toHaveValue('wasd 123 k');
      expect(await canvas(page).getAttribute('data-player-x')).toBe(x0);
      expect(await canvas(page).getAttribute('data-player-y')).toBe(y0);
      await expect(page.locator('.spellbook.sbt')).toHaveCount(0);
      await expect(page.locator('#satchel-book')).toHaveCount(0);
      await page.keyboard.press('Enter');
      await expect(page.locator('.td-chat__log')).toContainText('Aster: wasd 123 k', { timeout: 10000 });
      await expect(input).not.toBeFocused();
      // The world has the keyboard again: K opens the Spellbook.
      await page.keyboard.press('k');
      await expect(page.locator('.spellbook.sbt')).toBeVisible();
      await page.keyboard.press('Escape');
      // An empty line: Enter opens it, Enter again closes it without sending.
      await page.keyboard.press('Enter');
      await expect(input).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(input).not.toBeFocused();
    } finally { await ctx.close(); }
  });
});

test('screenshots: the HUD at 1280×720 (key caps, XP bar, dock keys)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await enter(page, '', true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/ux-hud-after.jpg', type: 'jpeg', quality: 80 });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('the Map fills the sheet, its pins take a finger, + and − zoom, no key caps', async ({ page }) => {
    await enter(page, '', true);
    await expect(page.locator('[data-guide-keys]')).toHaveCount(0);
    await page.locator('.td-dock button').last().tap();
    const view = page.locator('[data-map-view]');
    await expect(view).toBeVisible();
    await page.locator('[data-map-zoom-in]').tap();
    await expect.poll(async () => Number(await view.getAttribute('data-zoom'))).toBeGreaterThan(1.2);
    const pin = (await view.locator('.mw__pin:visible').first().boundingBox())!;
    expect(pin.width).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: 'docs/handoff/cozy-ui/ux-map-phone-after.jpg', type: 'jpeg', quality: 80 });
  });
});
