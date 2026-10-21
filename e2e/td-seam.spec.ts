/**
 * td-seam.spec.ts — the Seam Eater, the eclipse's world boss (play/td/td-seam.ts): it rises with a warning, each attack
 * shows its tell and its chant, at half its life it calls Eclipse-touched shades, its fall leaves its loot and opens
 * Nightmare on the Loot sheet; the Bestiary card and the Lore page.
 *
 * `?fxseam=1` is honoured only under an automated browser: the world clock jumps into an eclipse (world-clock.service)
 * and the Eater rises once, calm, a few steps north of the Keeper on open ground (td-engine laySeamShowcase);
 * `window.__tdSeam` makes it attack, wounds it to half, fells it and holds the world still for a photograph.
 * Screenshots: docs/handoff/cozy-ui/seam-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const SHOTS = 'docs/handoff/cozy-ui';
const GLIM = {
  version: 1, met: true, metAt: '2026-10-14T00:00:00.000Z', ladder: {},
  said: { meet: 1, homestead: 1 }, lastAt: { meet: 1, homestead: 1 }, moments: [], answers: {}, peak: 1, seenAt: 0,
};
type Hook = {
  tell(kind: 'breath' | 'rend'): boolean; half(): boolean; kill(): boolean; hold(on: boolean): void; calm(): number;
  step(d: [number, number]): { x: number; y: number }; hp(): number;
  state(): { up: boolean; hp?: number; max?: number; level?: number; halved?: boolean; calls?: number; touched?: number; slain?: boolean };
};
/** Call one of the hook's methods in the page (`window.__tdSeam`). */
const hook = <K extends keyof Hook>(page: Page, method: K, arg?: unknown): Promise<ReturnType<Hook[K]>> =>
  page.evaluate(([m, a]) => {
    const h = (window as unknown as { __tdSeam: Record<string, (x?: unknown) => unknown> }).__tdSeam;
    return Array.isArray(a) ? h[m as string](...(a as [unknown])) : h[m as string](a);
  }, [method, arg] as const) as Promise<ReturnType<Hook[K]>>;

async function open(page: Page, size: { width: number; height: number }, blobs: Record<string, unknown> = {}): Promise<void> {
  await page.setViewportSize(size);
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', 'godforge-glim': GLIM, ...blobs });
  await page.goto('/play?td=1&fxseam=1');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
  await expect(canvas(page)).toHaveAttribute('data-phase', 'eclipse', { timeout: 15000 });
  await expect(canvas(page)).toHaveAttribute('data-seam', 'risen', { timeout: 20000 });
}

test('the Seam Eater: the rise, both tells, the half-life call, the fall and the tier it opens', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, { width: 1400, height: 900 });
  const s = await hook(page, 'state');
  expect(s.up).toBe(true);
  expect(s.level).toBe(20);              // a level-1 Keeper meets the band's floor
  // The rise: the strip says it, Glim warns.
  await expect(page.locator('.td-toast')).toContainText('The standing stones tear open', { timeout: 5000 });
  await expect(page.locator('.glim-say')).toContainText(/Seam Eater|tearing open/, { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/seam-rise.jpg`, type: 'jpeg', quality: 86 });

  // Void Breath: the cone on the ground and its chant (once the place's title has faded).
  await page.addStyleTag({ content: '.glim-say, .td-toast { visibility: hidden !important; }' });
  await page.waitForTimeout(4000);
  expect(await hook(page, 'tell', 'breath')).toBe(true);
  await page.waitForTimeout(280);
  await hook(page, 'hold', true);
  await expect(canvas(page)).toHaveAttribute('data-boss-tell', 'breath');
  await page.screenshot({ path: `${SHOTS}/seam-tell-breath.jpg`, type: 'jpeg', quality: 86 });
  // A step aside in the tell, and the breath goes by.
  const life = await hook(page, 'hp');
  await hook(page, 'step', [80, 0]);
  await hook(page, 'hold', false);
  await page.waitForTimeout(1500);
  expect(await hook(page, 'hp')).toBeGreaterThanOrEqual(life);
  await hook(page, 'step', [-80, 0]);

  // Seam Rend: the rings round the Keeper and their chant.
  expect(await hook(page, 'tell', 'rend')).toBe(true);
  await page.waitForTimeout(400);
  await hook(page, 'hold', true);
  await expect(canvas(page)).toHaveAttribute('data-boss-tell', 'rend');
  await page.screenshot({ path: `${SHOTS}/seam-tell-rend.jpg`, type: 'jpeg', quality: 86 });
  // Out of the rings before they burst: nothing lands.
  const life2 = await hook(page, 'hp');
  await hook(page, 'step', [0, 64]);
  await hook(page, 'hold', false);
  await page.waitForTimeout(1500);
  expect(await hook(page, 'hp')).toBeGreaterThanOrEqual(life2);
  await hook(page, 'step', [0, -64]);

  // Half its life: the call (two sigils, then two Eclipse-touched shades) and the quickened fight.
  expect(await hook(page, 'half')).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-seam', 'half', { timeout: 5000 });
  await page.waitForTimeout(250);
  await hook(page, 'hold', true);
  await expect(canvas(page)).toHaveAttribute('data-boss-tell', 'call');
  await page.screenshot({ path: `${SHOTS}/seam-half-call.jpg`, type: 'jpeg', quality: 86 });
  await hook(page, 'hold', false);
  await expect.poll(() => hook(page, 'state').then(st => st.touched), { timeout: 5000 }).toBe(2);
  await hook(page, 'calm');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/seam-half-touched.jpg`, type: 'jpeg', quality: 86 });

  // The fall: the strip says so, its loot lies where it fell, and Nightmare opens.
  expect(await hook(page, 'kill')).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-seam', 'slain', { timeout: 5000 });
  // (The strip's own line is soon over-written by the kill's: a level gained, the Prologue's end.)
  await page.addStyleTag({ content: '.td-toast { visibility: visible !important; }' });
  await page.waitForTimeout(1500);
  // The level the kill paid for opens its card: put it away so the loot shows.
  const banner = page.locator('.lvl-banner .win-x');
  if (await banner.isVisible()) await banner.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/seam-kill-loot.jpg`, type: 'jpeg', quality: 86 });
  // It does not rise again this eclipse.
  await page.waitForTimeout(1000);
  await expect(canvas(page)).toHaveAttribute('data-seam', 'slain');

  // The Loot sheet's Difficulty picker now offers Nightmare, and says how Hell opens.
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button[data-open="loot"]').click();
  const ls = page.locator('.ls');
  await expect(ls.locator('[data-tier="normal"]')).toBeVisible();
  await expect(ls.locator('[data-tier="nightmare"]')).toBeVisible();
  await expect(ls.locator('[data-tier="hell"]')).toHaveCount(0);
  await expect(ls.locator('[data-tier-next]')).toContainText('Fell the Seam Eater on Nightmare to open Hell');
  await ls.locator('[data-tier="nightmare"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/seam-tier-unlocked.jpg`, type: 'jpeg', quality: 86 });
});

test('the Seam Eater rising on a phone', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, { width: 390, height: 844 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/seam-rise-phone.jpg`, type: 'jpeg', quality: 86 });
});

test('the Bestiary card and the Lore page', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', 'eclipse-bestiary-v1': { version: 1, kills: { 'seam-eater-risen': 1, 'ash-wolf': 3 } } });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await canvas(page).focus();
  await page.keyboard.press('b');
  const card = page.locator('.td-best [data-creature="seam-eater-risen"]');
  await expect(card.locator('h3')).toHaveText('The Seam Eater');
  await expect(card).toContainText('The Ninefold Stones, Ember Isle (under an eclipse)');
  await expect(card).toContainText('Seamstitch Grips');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/seam-bestiary.jpg`, type: 'jpeg', quality: 86 });
  await page.keyboard.press('b');
  await canvas(page).focus();
  await page.keyboard.press('c');
  await page.locator('.ksheet [data-sheet-lore]').click();
  const pg = page.locator('.ksheet [data-lore-page="seam-eater"]');
  await expect(pg).toContainText('The Seam Eater');
  await expect(pg).toContainText('Wanewalkers');
  await pg.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/seam-lore.jpg`, type: 'jpeg', quality: 86 });
});
