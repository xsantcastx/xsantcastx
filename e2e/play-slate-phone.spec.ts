/**
 * play-slate-phone.spec.ts — the Mirror Slate is just a phone (docs/handoff/slate-phone-only.md).
 *
 * No window, title bar, dashed frame or footer behind it: the phone floats over a dim of the world. It has ONE
 * fixed size per viewport and never resizes between home page 1, page 2 or any app, and every app is built INSIDE
 * its screen (nothing closes the phone to show its UI elsewhere). Measured at 390×844, 844×390 and 1280×800.
 * Also: Escape, a tap outside and the home bar all put it away; the home bar leaves an app first.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { bag, canvas, openPlay, placePanel, seed } from './play-helpers';

const SHOTS = resolve('output/slate-phone');
const SEEDED = { 'preferred-language': 'en', ...bag({ 'mirror-slate-ii': 1 }) };
const APPS = ['reels', 'rune-drop', 'seam-sweeper', 'eclipse-ascent', 'factory', 'map', 'scan', 'pets', 'codex', 'eclipse', 'about'];

interface Box { x: number; y: number; width: number; height: number }
const SIZES = [
  { tag: '390x844', width: 390, height: 844, touch: true },
  { tag: '844x390', width: 844, height: 390, touch: true },
  { tag: '1280x800', width: 1280, height: 800, touch: false },
];

/** The box once it has stopped moving (the open slide settled). */
async function settled(loc: Locator): Promise<Box> {
  let last = '';
  let box!: Box;
  await expect.poll(async () => { box = (await loc.boundingBox())!; const k = JSON.stringify(box); const same = k === last; last = k; return same; }, { timeout: 8000, intervals: [120, 120, 200] }).toBe(true);
  return box;
}
const close = (b: Box) => (a: Box) => (['x', 'y', 'width', 'height'] as const).every(k => Math.abs(a[k] - b[k]) <= 0.5);

async function openSlate(page: Page): Promise<void> {
  await page.locator('.slate-btn').click();
  await expect(placePanel(page)).toHaveClass(/place--slate/);
  await expect(page.locator('[data-slate-phone]')).toBeVisible();
}

for (const size of SIZES) {
  test(`${size.tag}: the phone alone, one fixed size on every page and every app, each app inside its screen`, async ({ page }) => {
    test.setTimeout(180000);
    mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: size.width, height: size.height });
    await seed(page, SEEDED);
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/);
    await openSlate(page);

    const phone = page.locator('[data-slate-phone]');
    const screen = page.locator('[data-slate-screen]');
    const home = page.locator('[data-slate-home]');
    const ref = await settled(phone);

    // Just the phone: no title bar, no ×, no dashed frame, no "what the Slate is" footer; it fits the viewport.
    await expect(placePanel(page).locator('.place-head')).toBeHidden();
    await expect(placePanel(page).locator('.sl-details')).toHaveCount(0);
    expect(ref.x).toBeGreaterThanOrEqual(0);
    expect(ref.y).toBeGreaterThanOrEqual(0);
    expect(ref.x + ref.width).toBeLessThanOrEqual(size.width + 0.5);
    expect(ref.y + ref.height).toBeLessThanOrEqual(size.height + 0.5);
    const portrait = size.width < size.height || size.width > 900;
    if (portrait) expect(ref.height).toBeGreaterThan(ref.width * 2 - 4); else expect(ref.width).toBeGreaterThan(ref.height * 2 - 4);
    const home44 = (await home.boundingBox())!;
    expect(Math.min(home44.width, home44.height)).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: resolve(SHOTS, `${size.tag}-1-home.png`) });

    // Page 2 (the calendar and the ledger): same box.
    await page.locator('[data-page-dot="1"]').click();
    await expect(page.locator('[data-slate-calendar]')).toBeVisible();
    expect(close(ref)(await settled(phone))).toBe(true);
    await page.screenshot({ path: resolve(SHOTS, `${size.tag}-2-page2.png`) });
    await page.locator('[data-page-dot="0"]').click();
    await expect(page.locator('[data-slate-clock]')).toBeVisible();
    expect(close(ref)(await settled(phone))).toBe(true);

    // Every app: opens INSIDE the phone (still open, same box, content within the screen), and Home returns.
    for (const id of APPS) {
      await page.locator(`.sl-tile[data-app="${id}"]`).click();
      await expect(page.locator('[data-slate-app]')).toBeVisible();
      await expect(placePanel(page)).toBeVisible();
      await expect(placePanel(page)).toHaveClass(/place--slate/);
      await page.waitForTimeout(id === 'codex' ? 1200 : 450);
      const box = await settled(phone);
      expect(close(ref)(box), `${id}: the phone kept its size`).toBe(true);
      const s = (await screen.boundingBox())!;
      const body = page.locator('[data-slate-app] .phone__scroll > .sl-pane:not([hidden])').first();
      await page.screenshot({ path: resolve(SHOTS, `${size.tag}-app-${id}.png`) });
      await expect(body, `${id}: has content`).toBeVisible();
      const b = (await body.boundingBox())!;
      expect(b.x, `${id}: left edge inside the screen`).toBeGreaterThanOrEqual(s.x - 1);
      expect(b.x + b.width, `${id}: right edge inside the screen`).toBeLessThanOrEqual(s.x + s.width + 1);
      expect(b.y, `${id}: top inside the screen`).toBeGreaterThanOrEqual(s.y - 1);
      expect(b.y, `${id}: starts on the screen`).toBeLessThan(s.y + s.height);
      const overflowX = await page.evaluate(() => { const el = document.querySelector('[data-slate-app] .phone__scroll') as HTMLElement; return el.scrollWidth - el.clientWidth; });
      expect(overflowX, `${id}: no sideways scroll`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: resolve(SHOTS, `${size.tag}-app-${id}.png`) });
      await home.click();
      await expect(page.locator('[data-slate-clock]')).toBeVisible();
      expect(close(ref)(await settled(phone)), `${id}: home kept the size`).toBe(true);
    }

    // Away: the home bar from home, Escape, a tap on the dim.
    await home.click();
    await expect(placePanel(page)).toBeHidden();
    await openSlate(page);
    await page.keyboard.press('Escape');
    await expect(placePanel(page)).toBeHidden();
    await openSlate(page);
    await page.mouse.click(2, 2);
    await expect(placePanel(page)).toBeHidden();
  });
}
