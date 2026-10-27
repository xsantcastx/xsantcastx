/**
 * td-iso.spec.ts — the Isometric (Beta) graphics (td-artopt.ts Graphics, td-iso*.ts, docs/handoff/iso.md):
 * - a fresh player gets Isometric (the default since 2026-10-27); Menu → Sound → Graphics switches to Classic and back at
 *   once and keeps the choice on the device;
 * - in Isometric a tap on a creature's body targets it (the tap is judged against its projected foot), a tap on open
 *   ground walks there, and the night's light map sits over the world with the names over it.
 */
import { expect, test, type Page } from '@playwright/test';
import { openMenu, seed } from './play-helpers';

type Art = { pageOf(x: number, y: number, lift?: number): { x: number; y: number }; target(): { x: number; y: number; h: number } | null };
const canvas = (page: Page) => page.locator('canvas').first();
/** Frame errors the engine caught (it logs the first and keeps drawing): none may happen in Isometric. */
const frameErrors: string[] = [];
test.beforeEach(({ page }) => { frameErrors.length = 0; page.on('console', m => { if (m.type() === 'error' && m.text().includes('frame error')) frameErrors.push(m.text()); }); });
test.afterEach(() => { expect(frameErrors).toEqual([]); });

async function open(page: Page, query: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', hair: 'curls', updatedAt: 1 } });
  await page.goto(`/play?td=1&${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt && !!(window as unknown as { __tdZones?: unknown }).__tdZones);
  await page.addStyleTag({ content: '.guide, .glim-say { visibility: hidden !important; }' });
}

test('a fresh player gets Isometric (Beta); Menu → Sound → Graphics switches to Classic and back, at once, kept on the device', async ({ page }) => {
  test.setTimeout(90000);
  // A player who never chose (the suite pins Classic for the older specs: playwright.config, play-helpers seed).
  await page.addInitScript(() => localStorage.removeItem('eclipse-td-graphics'));
  await open(page, 'hour=12');
  await expect(canvas(page)).toHaveAttribute('data-graphics', 'iso');
  await page.locator('.places-toggle').click();
  await openMenu(page);
  await page.locator('#game-menu [data-open="sound"]').first().click();
  const sheet = page.locator('app-sound-sheet');
  await expect(sheet.locator('[data-graphics-setting="iso"]')).toHaveAttribute('aria-checked', 'true', { timeout: 5000 });
  // Listed Isometric (Beta) first, then Classic.
  await expect(sheet.locator('[data-graphics-setting]')).toHaveText(['Isometric (Beta)', 'Classic']);
  await sheet.locator('[data-graphics-setting="classic"]').click();
  await expect(sheet.locator('[data-graphics-setting="classic"]')).toHaveAttribute('aria-checked', 'true');
  await expect(canvas(page)).toHaveAttribute('data-graphics', 'classic', { timeout: 5000 });
  expect(await page.evaluate(() => localStorage.getItem('eclipse-td-graphics'))).toBe('classic');
  await sheet.locator('[data-graphics-setting="iso"]').click();
  await expect(canvas(page)).toHaveAttribute('data-graphics', 'iso', { timeout: 5000 });
  expect(await page.evaluate(() => localStorage.getItem('eclipse-td-graphics'))).toBe('iso');
});

test('Isometric: a tap on a creature targets it, a tap on the ground walks there', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'hour=12&artopt=iso');
  await expect(canvas(page)).toHaveAttribute('data-graphics', 'iso');
  await page.evaluate(() => { const z = (window as unknown as { __tdZones: { to(c: number, r: number): boolean } }).__tdZones; z.to(58, 62); });
  await page.waitForTimeout(500);
  const px = Number(await canvas(page).getAttribute('data-player-x')), py = Number(await canvas(page).getAttribute('data-player-y'));
  // A calm Bone Walker two tiles east (on screen: down and to the right of the Keeper).
  await page.evaluate(() => (window as unknown as { __tdZones: { foe(t: string, l: number, dx: number, dy: number): number | null } }).__tdZones.foe('bone-walker', 3, 40, 0));
  await page.waitForTimeout(300);
  const at = await page.evaluate(([x, y]) => (window as unknown as { __tdArt: Art }).__tdArt.pageOf(x, y, 12), [px + 40, py] as const);
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tdArt: Art }).__tdArt.target()), { timeout: 5000 }).not.toBeNull();
  // A tap on open ground a little up the screen: the Keeper walks off his tile.
  const ground = await page.evaluate(([x, y]) => (window as unknown as { __tdArt: Art }).__tdArt.pageOf(x, y), [px - 40, py - 40] as const);
  await page.mouse.click(ground.x, ground.y);
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-y')), { timeout: 8000 }).toBeLessThan(py - 8);
});

test('Isometric at night: the light map is its own layer under the names', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'hour=0&artopt=iso');
  await expect(canvas(page)).toHaveAttribute('data-night', /^full:0\.\d+$/, { timeout: 15000 });
  const light = page.locator('canvas[data-iso-layer="light"]'), ui = page.locator('canvas[data-iso-layer="ui"]');
  await expect(light).toBeVisible({ timeout: 5000 });
  await expect(ui).toBeVisible();
  // Neither takes a tap: they never stand between the finger and the world.
  expect(await light.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await ui.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  // The UI layer is above the light (later in the DOM, both absolutely placed over the world canvas).
  expect(await page.evaluate(() => { const l = document.querySelector('canvas[data-iso-layer="light"]')!, u = document.querySelector('canvas[data-iso-layer="ui"]')!; return !!(l.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING); })).toBe(true);
});

test('Isometric draws every place without a frame error: rain on the road, a nova among the walkers, the harbour, a dungeon', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, 'hour=21&weather=storm&artopt=iso');
  const go = (f: string) => page.evaluate(f => new Function('w', `return (${f})(w)`)(window), f);
  await go("w => { w.__tdZones.to(58, 62); w.__tdArt.road(0); w.__tdArt.aura(true); for (let i = 0; i < 8; i++) w.__tdZones.foe('bone-walker', 3, Math.round(Math.cos(i) * 50), Math.round(Math.sin(i) * 40)); }");
  await go("w => w.__tdLos.cast('hellfire-nova')");
  await page.waitForTimeout(1500);
  await go("w => w.__tdArt.visit('surface', 30, 111, 'ember-isle')");
  await page.waitForTimeout(1200);
  await go("w => w.__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle')");
  await page.waitForTimeout(1200);
  await expect(canvas(page)).toHaveAttribute('data-graphics', 'iso');
});

test('Isometric: a pile on the ground opens its list where it is drawn (its ×N badge and plates stand on its projected tile)', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'hour=12&artopt=iso');
  await page.evaluate(() => (window as unknown as { __tdZones: { to(c: number, r: number): boolean } }).__tdZones.to(58, 62));
  await page.waitForTimeout(400);
  type G = { lay(k: 'gold' | 'ore', dx: number, dy?: number, n?: number): { id: string }; piles(): { n: number; px: number; py: number }[] };
  await page.evaluate(() => { const g = (window as unknown as { __tdGround: G }).__tdGround; g.lay('ore', 48, 0, 3); g.lay('ore', 48, 0, 4); });
  await page.waitForTimeout(400);
  const pile = await page.evaluate(() => (window as unknown as { __tdGround: G }).__tdGround.piles().find(p => p.n >= 2)!);
  expect(pile).toBeTruthy();
  await page.mouse.click(pile.px, pile.py, { button: 'right' });
  await expect(page.locator('[data-pile-window] [data-pile-take]')).toHaveCount(2, { timeout: 5000 });
});
