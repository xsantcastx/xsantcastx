/**
 * play-consent.spec.ts — legal and system chrome never covers gameplay.
 *
 *   - On a first visit to /play (no consent answer stored) the consent notice is
 *     the compact in-world bar, docked UNDER the game frame: the frame shrinks by
 *     the bar's height, so the bar's rect meets neither the canvas (and so no
 *     stall hit box), the action bar, the touch row, the Hearth pill nor the
 *     goal line — at 1280×800 and on a 390×844 phone.
 *   - Nothing optional loads before the answer: no gtag.js / Google Analytics
 *     request, no consent key stored. Accept and Essential Only are the same
 *     size, both keyboard reachable; Space on a focused button presses it (the
 *     engine does not take it as a jump). The answer persists as before, and
 *     answering gives the frame its full height back.
 *   - With the Hearth chat open on desktop (905 / 1000 / 1280 / 1920px) the goal
 *     line never paints over the panel: it moves into the gap beside it where
 *     there is room (1280, 1920) and steps aside where there is not.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { canvas, openPlay, seed } from './play-helpers';

const CONSENT_KEY = 'xsantcastx_consent';
const HEARTH_KEY = 'eclipse-hearth-open';

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

/** A browser that has never answered the consent question (the tutorial stays seen). */
async function firstVisit(page: Page): Promise<void> {
  await page.goto('/robots.txt');
  await page.evaluate(() => {
    const keepOnboarding = localStorage.getItem('eclipse-onboarding');
    localStorage.clear();
    sessionStorage.clear();
    if (keepOnboarding) localStorage.setItem('eclipse-onboarding', keepOnboarding);
    sessionStorage.setItem('visit-counted', '1');
  });
}

const ANALYTICS = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|\/g\/collect/;

function recordAnalytics(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (req: Request) => { if (ANALYTICS.test(req.url())) hits.push(req.url()); });
  return hits;
}

async function assertBarClear(page: Page, sizeLabel: string, hud: string[]): Promise<Rect> {
  const bar = page.locator('.cookie-banner--world');
  await expect(bar, `${sizeLabel}: the in-world consent bar`).toBeVisible();
  // The bar's height follows its webfont; measure once the fonts have settled.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Its height is handed to the frame: the frame ends where the bar starts
  // (re-measured by a ResizeObserver, so allow it a frame or two to settle).
  await expect.poll(async () => {
    const b = await rectOf(page, '.cookie-banner--world');
    const c = await rectOf(page, '.viewport canvas');
    return !!b && !!c && c.bottom <= b.top;
  }, { message: `${sizeLabel}: canvas ends above the consent bar`, timeout: 10000 }).toBe(true);
  const box = (await rectOf(page, '.cookie-banner--world'))!;
  const vp = page.viewportSize()!;
  expect(box.bottom, `${sizeLabel}: bar on screen`).toBeLessThanOrEqual(vp.height + 1);
  expect(box.bottom - box.top, `${sizeLabel}: compact`).toBeLessThanOrEqual(vp.width < 600 ? 150 : 90);
  for (const sel of ['.viewport canvas', ...hud]) {
    const other = await rectOf(page, sel);
    if (other) expect(meets(box, other), `${sizeLabel}: consent bar over ${sel}`).toBe(false);
  }
  // A hit test at every HUD piece's centre reaches that piece, not the bar.
  for (const sel of hud) {
    const other = await rectOf(page, sel);
    if (!other) continue;
    const ok = await page.evaluate(({ s, x, y }) => !!document.elementFromPoint(x, y)?.closest(s),
      { s: sel, x: (other.left + other.right) / 2, y: (other.top + other.bottom) / 2 });
    expect(ok, `${sizeLabel}: ${sel} takes its own click`).toBe(true);
  }
  // Accept and Essential Only are offered evenly.
  const accept = (await rectOf(page, '.cookie-banner--world .btn-accept'))!;
  const deny = (await rectOf(page, '.cookie-banner--world .btn-deny'))!;
  expect(Math.abs((accept.bottom - accept.top) - (deny.bottom - deny.top))).toBeLessThanOrEqual(1);
  expect(Math.abs((accept.right - accept.left) - (deny.right - deny.left))).toBeLessThanOrEqual(2);
  expect(accept.bottom - accept.top).toBeGreaterThanOrEqual(44);
  const looks = await page.evaluate(() => ['.btn-accept', '.btn-deny'].map(s => {
    const cs = getComputedStyle(document.querySelector(`.cookie-banner--world ${s}`)!);
    return [cs.backgroundColor, cs.color, cs.fontSize, cs.fontWeight, cs.borderTopWidth].join('|');
  }));
  expect(looks[0], `${sizeLabel}: Accept and Essential Only look the same`).toBe(looks[1]);
  return box;
}

test.describe('the consent bar on /play at 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.describe.configure({ timeout: 120000 });

  test('first visit: docked under the frame, clear of the HUD, nothing optional loaded; Space on Essential Only answers it', async ({ page }) => {
    const analytics = recordAnalytics(page);
    await firstVisit(page);
    await openPlay(page);
    await assertBarClear(page, '1280×800', ['.prompt', '.dock', '.hearth-pill', '.guide', '.satchel', '.vitals']);
    expect(await page.evaluate(k => localStorage.getItem(k), CONSENT_KEY)).toBeNull();
    expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
    expect(analytics, 'no analytics request before an answer').toEqual([]);

    // Keyboard: both buttons are in the tab order; Space presses the focused one
    // and the Keeper does not jump.
    const x0 = await canvas(page).getAttribute('data-player-x');
    await page.locator('.cookie-banner--world .btn-accept').focus();
    await expect(page.locator('.cookie-banner--world .btn-accept')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.cookie-banner--world .btn-deny')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('.cookie-banner')).toHaveCount(0);
    expect(await page.evaluate(k => localStorage.getItem(k), CONSENT_KEY)).toBe('denied');
    expect(await canvas(page).getAttribute('data-player-x')).toBe(x0);
    // The frame takes its full height back; the answer survives a reload.
    await expect.poll(async () => (await rectOf(page, '.viewport canvas'))!.bottom).toBeGreaterThanOrEqual(799);
    await openPlay(page);
    await expect(page.locator('.cookie-banner')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(analytics, 'Essential Only loads no analytics').toEqual([]);
  });
});

test.describe('the consent bar on /play on a 390×844 phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.describe.configure({ timeout: 120000 });

  test('first visit: docked under the frame, clear of the action bar, touch row, pill and goal line; Accept persists', async ({ page }) => {
    const analytics = recordAnalytics(page);
    // Never reach the network for gtag.js, even after Accept.
    await page.route(ANALYTICS, route => route.abort());
    await firstVisit(page);
    await openPlay(page);
    await assertBarClear(page, '390×844', ['.prompt', '.touch', '.dock', '.hearth-pill', '.guide', '.satchel', '.vitals']);
    expect(await page.evaluate(k => localStorage.getItem(k), CONSENT_KEY)).toBeNull();
    expect(analytics, 'no analytics request before an answer').toEqual([]);

    await page.locator('.cookie-banner--world .btn-accept').tap();
    await expect(page.locator('.cookie-banner')).toHaveCount(0);
    expect(await page.evaluate(k => localStorage.getItem(k), CONSENT_KEY)).toBe('accepted');
    await expect.poll(async () => (await rectOf(page, '.viewport canvas'))!.bottom + 118).toBeGreaterThanOrEqual(843);
    await openPlay(page);
    await expect(page.locator('.cookie-banner')).toHaveCount(0);
  });
});

test.describe('the goal line and the open Hearth on desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.describe.configure({ timeout: 120000 });

  test('at 905 / 1000 / 1280 / 1920px the goal line never paints over the open Hearth panel', async ({ page }) => {
    await seed(page, { [HEARTH_KEY]: '1' });
    await openPlay(page);
    await expect(page.locator('.guide'), 'a fresh Keeper has a goal line').toHaveCount(1);
    await expect(page.locator('#hearth-body')).toBeVisible();
    for (const width of [905, 1000, 1280, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(150);
      await expect(page.locator('#hearth-body')).toBeVisible();
      const dock = (await rectOf(page, '.dock'))!;
      expect(dock.bottom - dock.top, `${width}px: the Hearth is open, not a pill`).toBeGreaterThan(56);
      const guide = await rectOf(page, '.guide');
      if (width >= 1280) expect(guide, `${width}px: room beside the panel, the goal line stays`).not.toBeNull();
      if (guide) {
        expect(meets(guide, dock), `${width}px: goal line over the open Hearth`).toBe(false);
        const vitals = await rectOf(page, '.vitals');
        if (vitals) expect(meets(guide, vitals), `${width}px: goal line over the health plate`).toBe(false);
      }
      // A click at the panel's top-left corner reaches the panel.
      const onDock = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.dock'),
        { x: dock.left + 12, y: dock.top + 12 });
      expect(onDock, `${width}px: the panel's top-left takes its own click`).toBe(true);
    }
    // Folded, the goal line is back in the centre of the strip.
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.locator('.hearth-hide').click();
    await expect(page.locator('#hearth-body')).toBeHidden();
    await expect(page.locator('.guide')).toBeVisible();
    const guide = (await rectOf(page, '.guide'))!;
    expect(Math.abs((guide.left + guide.right) / 2 - 500)).toBeLessThanOrEqual(2);
  });
});
