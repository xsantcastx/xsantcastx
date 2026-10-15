/**
 * play-update.spec.ts — a deploy lands while the game is open.
 *
 * An installed app or a long-open tab never navigates, so it would run an old
 * bundle forever. AppUpdateService polls /version.json against the document's
 * `<meta name="gf-build">` (both stamped by scripts/stamp-build-id.js) and
 * offers a Reload. These specs simulate the deploy at the network layer: from
 * the moment of "deploy", /version.json names a new build and every document
 * the server hands out carries it — which, to the client, is all a deploy is.
 *
 *   - The toast waits while a station panel is open, appears once it closes,
 *     and Reload lands on the new build without losing a sale made seconds
 *     before (the ledger writes behind a 5s throttle, so the sale is still in
 *     memory when Reload is pressed).
 *   - On a 375px phone the toast sits top-centre and covers no control (it
 *     steps down below /play's top-bar buttons rather than over them).
 *
 * Needs a stamped build (`npm run build` stamps in postbuild); on a bare
 * `npx ng build` dist the spec runs scripts/stamp-build-id.js itself first.
 */
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as path from 'path';
import { bag, openPlay, placePanel, purse, seed, stackQty } from './play-helpers';

const NEXT_BUILD = '0123456789ab';
const GOLD = (text: string | null) => Number((text ?? '').replace(/[^\d]/g, ''));

const toast = (page: Page) => page.getByTestId('update-toast');

async function runningBuild(page: Page): Promise<string | null> {
  return page.evaluate(() => document.querySelector('meta[name="gf-build"]')?.getAttribute('content') ?? null);
}

/** From now on the server is "on" NEXT_BUILD. */
async function deploy(page: Page): Promise<void> {
  await page.route('**/version.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: NEXT_BUILD }) }));
  await page.route('**/*', async route => {
    if (!route.request().isNavigationRequest()) return route.fallback();
    const res = await route.fetch();
    const html = (await res.text()).replace(/<meta name="gf-build" content="[^"]*">/, `<meta name="gf-build" content="${NEXT_BUILD}">`);
    return route.fulfill({ response: res, body: html });
  });
}

/** The toast's chunk mounts once the browser is idle; wait for it to be watching. */
async function updatesWatching(page: Page): Promise<void> {
  await expect(page.locator('app-update-toast')).toBeAttached({ timeout: 15000 });
}

/** Coming back online is one of the moments a check runs. */
async function nudge(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

/** Where the toast is, and every visible control it overlaps. */
async function toastReport(page: Page) {
  return page.evaluate(() => {
    const t = document.querySelector('[data-testid="update-toast"]')!.getBoundingClientRect();
    const meets = (r: DOMRect) => r.left < t.right && t.left < r.right && r.top < t.bottom && t.top < r.bottom;
    const covered = Array.from(document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]'))
      .filter(el => !el.closest('[data-testid="update-toast"]'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && meets(r);
      })
      .map(el => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className || ''} "${(el.textContent || '').trim().slice(0, 30)}"`);
    return { left: t.left, right: t.right, top: t.top, bottom: t.bottom, width: innerWidth, height: innerHeight, covered };
  });
}


/** The Vendor on the station kit: pick the Cinder Ore row; its per-unit price is on the row. */
async function pickCinderOre(page: Page): Promise<number> {
  const row = page.locator('section.place app-journal-list .jl__row', { hasText: 'Cinder Ore' });
  await expect(row).toBeVisible();
  await row.click();
  const price = Number(/([\d,]+) Gold each/i.exec(await row.innerText())?.[1].replace(/,/g, ''));
  expect(price).toBeGreaterThan(0);
  return price;
}
/** Set the stepper to exactly n (it opens on a suggested quantity). */
async function stepTo(page: Page, n: number): Promise<void> {
  const qty = page.locator('section.place .ab__qty');
  const steps = page.locator('section.place .ab__stepbtn');
  for (let guard = 0; guard < 40 && Number(await qty.textContent()) !== n; guard++) {
    await steps.nth(Number(await qty.textContent()) < n ? 1 : 0).click();
  }
  await expect(qty).toHaveText(String(n));
}
const VENDOR_GOLD = (page: Page) => page.locator('section.place app-cost-chip[stationwallet] .chip__n');

test.describe('new version ready', () => {
  test.beforeAll(async ({ request }) => {
    // A bare `npx ng build` is unstamped (only `npm run build` runs postbuild).
    // The preview server reads dist from disk per request, so stamping now works.
    if ((await request.get('/version.json')).ok()) return;
    execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'stamp-build-id.js')], { stdio: 'inherit' });
    expect((await request.get('/version.json')).ok(), 'dist could not be stamped').toBe(true);
  });

  test('waits out a station panel, then Reload lands on the new build with a fresh sale kept', async ({ page }) => {
    test.setTimeout(90000);
    await seed(page, { ...bag({ 'cinder-ore': 20 }), ...purse(10_000) });
    await openPlay(page, '?at=vendor');
    await expect(page.locator('#place-title')).toHaveText('Material Vendor');
    const before = await runningBuild(page);
    expect(before).toMatch(/^[0-9a-f]{12}$/);
    await updatesWatching(page);

    // The deploy goes live while the player stands at the counter.
    await deploy(page);
    await nudge(page);
    await page.waitForTimeout(2500);
    await expect(toast(page)).toHaveCount(0); // a panel is open: the offer waits

    // Sell, close the counter, and reload inside the ledger's write throttle.
    const price = await pickCinderOre(page);
    const goldBefore = GOLD(await VENDOR_GOLD(page).textContent());
    await stepTo(page, 5);
    await page.locator('section.place .ab__btn').click();
    await expect.poll(async () => GOLD(await VENDOR_GOLD(page).textContent()))
      .toBeGreaterThanOrEqual(goldBefore + 5 * price);
    await page.keyboard.press('Escape');
    await expect(placePanel(page)).toBeHidden();

    await expect(toast(page)).toBeVisible({ timeout: 5000 });
    await expect(toast(page)).toContainText('A new version is ready');
    await page.evaluate(() => { (window as unknown as { __oldPage: boolean }).__oldPage = true; });
    await Promise.all([
      page.waitForEvent('load', { timeout: 20000 }),
      toast(page).getByRole('button', { name: 'Reload' }).click(),
    ]);

    // A real reload, onto the new build, with nothing left to offer.
    expect(await page.evaluate(() => (window as unknown as { __oldPage?: boolean }).__oldPage)).toBeUndefined();
    await expect.poll(() => runningBuild(page)).toBe(NEXT_BUILD);
    await updatesWatching(page);
    await nudge(page);
    await page.waitForTimeout(2000);
    await expect(toast(page)).toHaveCount(0);

    // The sale survived the reload.
    expect(await stackQty(page, 'cinder-ore')).toBe(15);
    const gold = await page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold));
    expect(gold).toBeGreaterThanOrEqual(goldBefore + 5 * price);
  });

  test('on a phone it sits top-centre and covers no control; Later puts it away', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page);
    await openPlay(page);
    await updatesWatching(page);
    await deploy(page);
    await nudge(page);
    await expect(toast(page)).toBeVisible({ timeout: 5000 });

    const report = await toastReport(page);
    expect(report.covered).toEqual([]);
    expect(report.bottom).toBeLessThanOrEqual(report.height * 0.4); // still a top toast, not mid-screen
    expect(report.left).toBeGreaterThanOrEqual(0);
    expect(report.right).toBeLessThanOrEqual(report.width);
    expect(Math.abs((report.left + report.right) / 2 - report.width / 2)).toBeLessThan(2);

    await toast(page).getByRole('button', { name: /^Later/ }).click();
    await expect(toast(page)).toHaveCount(0);
    await nudge(page);
    await page.waitForTimeout(1500);
    await expect(toast(page)).toHaveCount(0); // same build: stays dismissed
  });
});
