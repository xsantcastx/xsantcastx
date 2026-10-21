/**
 * td-dark-shots.spec.ts — the mystery layer (design-bible §5.3–5.4): shapes at the light's edge, a shy chest that only
 * the dark shows, a Nightroad over Ashwater Lake, and the Hush on the HUD at its deepest with an omen.
 *
 * Test hooks, honoured only under an automated browser (td-engine): `?hush=N` holds the Hush at N (awake anywhere),
 * `?fxdark=1` lets `window.__tdDark.lay()` stand two shapes for a photograph; `window.__tdDark.chest(id)` /
 * `.road(id)` walk the Keeper there; `.omen(kind)` fires an omen. Screenshots: docs/handoff/cozy-ui/dark-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const SIZES = { desktop: { width: 1400, height: 900 }, phone: { width: 390, height: 844 } } as const;
type Dark = { chest(id?: string): string; road(id?: string, where?: string): string | null; lay(): number; omen(kind: string): void; state(): Record<string, unknown> };
const dark = <T>(page: Page, fn: (d: Dark) => T) => page.evaluate(`(${fn.toString()})(window.__tdDark)`) as Promise<T>;

async function open(page: Page, query: string, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en' });
  await page.goto(`/play?td=1&${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdDark?: unknown }).__tdDark, null, { timeout: 15000 });
  await page.addStyleTag({ content: '.guide, .glim-say { visibility: hidden !important; }' });
}

for (const [name, size] of Object.entries(SIZES)) {
  test(`shapes stand at the edge of the light, and footsteps follow (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    await open(page, 'fxdark=1&hush=70', size);
    await dark(page, d => d.chest('sporewell'));
    await page.waitForTimeout(4500);
    expect(await dark(page, d => d.lay())).toBe(2);
    await expect(canvas(page)).toHaveAttribute('data-shapes', '2', { timeout: 5000 });
    await expect(canvas(page)).toHaveAttribute('data-prints', '1');
    // Never an ambush: the shapes stay at the edge, they do not come.
    const before = await dark(page, d => d.state()['shapes']) as { x: number; y: number }[];
    await page.waitForTimeout(2500);
    const after = await dark(page, d => d.state()['shapes']) as { x: number; y: number }[];
    expect(after).toEqual(before);
    await page.screenshot({ path: `docs/handoff/cozy-ui/dark-shapes-${name}.jpg`, type: 'jpeg', quality: 86 });
  });

  test(`a Nightroad over Ashwater Lake at night (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    await open(page, 'phase=night&fxdark=1', size);
    await expect(canvas(page)).toHaveAttribute('data-phase', 'night', { timeout: 15000 });
    // The phase spec's own night creatures lie down round the arrival first; let them, then leave them there.
    await page.waitForTimeout(3000);
    // On the Barrow's jetty-nook, out over the sea, by the wet page: the planks run back to the shore.
    expect(await dark(page, d => d.road('barrow', 'nook'))).toBe('barrow');
    await expect(canvas(page)).toHaveAttribute('data-nightroads', '1', { timeout: 5000 });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `docs/handoff/cozy-ui/dark-nightroad-${name}.jpg`, type: 'jpeg', quality: 86 });
    expect(await dark(page, d => d.road('ashwater'))).toBe('ashwater');
    await page.waitForTimeout(500);
    // It holds the Keeper: walk west onto the planks, over the water.
    const x0 = Number(await canvas(page).getAttribute('data-player-x'));
    await canvas(page).focus();
    await page.keyboard.down('a');
    await page.waitForTimeout(1200);
    await page.keyboard.up('a');
    await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-x'))).toBeLessThan(x0 - 30);
  });
}

test('a Nightroad is not there by day', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'phase=day&fxdark=1', SIZES.desktop);
  expect(await dark(page, d => d.road('ashwater'))).toBe('ashwater');
  await expect(canvas(page)).toHaveAttribute('data-nightroads', '0', { timeout: 5000 });
  const x0 = Number(await canvas(page).getAttribute('data-player-x'));
  await canvas(page).focus();
  await page.keyboard.down('a');
  await page.waitForTimeout(1200);
  await page.keyboard.up('a');
  await page.waitForTimeout(300);
  // The shore stops the Keeper: the water is only water.
  expect(Number(await canvas(page).getAttribute('data-player-x'))).toBeGreaterThan(x0 - 40);
});

test('a shy chest shows in the dark and opens with real loot (desktop)', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'fxdark=1&hush=40', SIZES.desktop);
  expect(await dark(page, d => d.chest('galleries'))).toBe('galleries');
  await expect(canvas(page)).toHaveAttribute('data-shade-chests', 'galleries:shown', { timeout: 5000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/dark-chest-desktop.jpg', type: 'jpeg', quality: 86 });
  await canvas(page).focus();
  await page.keyboard.press('e');
  await expect(canvas(page)).toHaveAttribute('data-shade-chests', 'galleries:open', { timeout: 5000 });
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-gold-piles'))).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/dark-chest-open-desktop.jpg', type: 'jpeg', quality: 86 });
});

test('every shy chest can be found in the dark (no fixed light falls on it)', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, 'fxdark=1', SIZES.desktop);
  for (const id of ['galleries', 'bone-hall', 'smithies', 'sporewell', 'cloister']) {
    expect(await page.evaluate(i => (window as unknown as { __tdDark: Dark }).__tdDark.chest(i), id)).toBe(id);
    await page.waitForTimeout(600);
    await expect(canvas(page)).toHaveAttribute('data-shade-chests', `${id}:shown`, { timeout: 5000 });
  }
});

for (const [name, size] of Object.entries(SIZES)) {
  test(`the Hush at its deepest, with a whisper (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    await open(page, 'fxdark=1&hush=96', size);
    await dark(page, d => d.chest('cloister'));
    const hush = page.locator('.td-hush');
    await expect(hush).toBeVisible({ timeout: 5000 });
    await expect(hush).toHaveAttribute('data-hush-band', '3');
    await expect(hush).toHaveAttribute('aria-label', /edge of the world thins/);
    await expect(canvas(page)).toHaveAttribute('data-hush-band', '3');
    await page.waitForTimeout(4500);
    await dark(page, d => d.lay());
    await dark(page, d => d.omen('whisper'));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `docs/handoff/cozy-ui/dark-hush-${name}.jpg`, type: 'jpeg', quality: 86 });
  });
}

test('the Hush cap lives in Menu → Sound, and Off hides the band', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'fxdark=1&hush=80', SIZES.desktop);
  await expect(page.locator('.td-hush')).toBeVisible({ timeout: 5000 });
  await page.locator('.places-toggle').click();
  await page.locator('[data-open="sound"]').first().click();
  const sheet = page.locator('app-sound-sheet');
  await expect(sheet.locator('[data-hush-cap="quiet"]')).toBeVisible({ timeout: 5000 });
  await sheet.locator('[data-hush-cap="quiet"]').click();
  await expect(sheet.locator('[data-hush-cap="quiet"]')).toHaveAttribute('aria-checked', 'true');
  await expect(canvas(page)).toHaveAttribute('data-hush-band', '1', { timeout: 5000 });
  await sheet.locator('[data-hush-cap="off"]').click();
  await expect(canvas(page)).toHaveAttribute('data-hush-on', '0', { timeout: 5000 });
  await expect(page.locator('.td-hush')).toHaveCount(0);
});
