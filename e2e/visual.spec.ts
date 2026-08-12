import { test, expect, Page } from '@playwright/test';

async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      /* deterministic freeze: run every animation exactly once with a tiny
         duration so it lands on its 100% keyframe. duration:0 on infinite
         animations has no defined landing frame and flakes across runs. */
      animation-delay: 0s !important;
      animation-duration: 0.001s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
    /* JS-driven / randomized layers CSS freezing can't make deterministic:
       canvas particles are random per load, pulsar drifts via JS-set vars,
       trail + cursor follow the (absent) mouse. Hide them entirely. */
    .cosmic-canvas, .cosmic-pulsar, .cosmic-trail-layer, .cosmic-cursor, .cosmic-boot {
      visibility: hidden !important;
    }`,
  });
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => r())));
}

async function waitForFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

// hp-live feed lines are a JS-driven fake log stream — mask, don't compare
const DYNAMIC_MASKS = ['[class*="carbon"]', '#carbonads', 'ins', '[data-counter]', '.hp-live__card'];

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];

/**
 * Screenshot comparisons are opt-in via VISUAL=1.
 *
 * Every committed baseline in visual.spec.ts-snapshots/ carries a `-darwin`
 * suffix, because Playwright keys snapshots by platform and they were all
 * generated on macOS. CI runs on ubuntu-latest and looks for `-linux` files
 * that do not exist. A missing baseline is a *failure*, not a skip — Playwright
 * writes the actual screenshot and fails the run — so all 12 of these have been
 * red on every CI run since they were added, permanently.
 *
 * Regenerating them on Linux is possible but not worth it: font rasterisation,
 * scrollbar metrics and GPU compositing all differ from the machine the design
 * is actually reviewed on, so a Linux baseline would encode a rendering nobody
 * looks at, and this page is animation-dense enough that it would flake anyway.
 *
 * So: the functional assertions below (overflow, and the smoke specs in the
 * sibling files) run everywhere and are the real gate. The screenshots stay
 * available for local use against the darwin baselines that already exist:
 *
 *     VISUAL=1 npx playwright test e2e/visual.spec.ts
 *     VISUAL=1 npx playwright test e2e/visual.spec.ts --update-snapshots
 *
 * NOTE ON THE COMMITTED BASELINES: the surviving home-hero-* and tools-galaxy-*
 * PNGs predate the v2.37 painted hero and the v2.39/v2.40 homepage strip, so
 * they no longer resemble the pages they shoot. Regenerate with
 * --update-snapshots before trusting a VISUAL=1 run. The home-planet-* and
 * home-spotlight-footer-* baselines were deleted outright, because the sections
 * they captured no longer exist at all.
 *
 * To turn these back on in CI, generate Linux baselines in a container that
 * matches the runner and commit them alongside the darwin ones:
 *
 *     docker run --rm -v "$PWD:/w" -w /w mcr.microsoft.com/playwright:v1.49.0-jammy \
 *       npx playwright test e2e/visual.spec.ts --update-snapshots --project=chromium
 *
 * then set VISUAL=1 on the quality-checks job in .github/workflows/ci-cd.yml.
 */
const VISUAL_ENABLED = !!process.env['VISUAL'];

for (const vp of VIEWPORTS) {
  test.describe(`visual / ${vp.name}px`, () => {
    test.skip(!VISUAL_ENABLED, 'screenshot baselines are darwin-only; set VISUAL=1 to run');
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('home hero', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'load' });
      // `.hc-card` (the old hero carousel) was deleted in v2.19.0; this waited
      // on a selector that matches nothing. Harmless while these tests were
      // failing for other reasons, but it would have broken the VISUAL=1 path
      // the moment anyone regenerated baselines and turned them back on.
      await page.waitForSelector('.gf-hero__title', { timeout: 10000 });
      await waitForFonts(page);
      await freezeAnimations(page);
      await expect(page).toHaveScreenshot(`home-hero-${vp.name}.png`, {
        maxDiffPixelRatio: 0.035,
        clip: { x: 0, y: 0, width: vp.width, height: vp.height },
        mask: DYNAMIC_MASKS.map(s => page.locator(s)),
        animations: 'disabled',
      });
    });

    // Was 'home planet section', shooting `.cosmic-planet` — deleted in v2.39.0
    // along with the rest of the CSS planet. Retargeted at the five-realm forge
    // grid, which is what occupies that band of the homepage now.
    test('home forges section', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'load' });
      await page.waitForSelector('.gf-forges', { timeout: 10000 });
      await waitForFonts(page);
      await page.evaluate(() => {
        document.querySelector('.gf-forges')?.scrollIntoView({ block: 'center' });
      });
      // the painted hero and the station art decode asynchronously —
      // longest settle + loosest tolerance of the suite (noisiest shot)
      await page.waitForTimeout(1500);
      await freezeAnimations(page);
      await expect(page).toHaveScreenshot(`home-forges-${vp.name}.png`, {
        maxDiffPixelRatio: 0.05,
        clip: { x: 0, y: 0, width: vp.width, height: vp.height },
        mask: DYNAMIC_MASKS.map(s => page.locator(s)),
        animations: 'disabled',
      });
    });

    // Was 'home spotlight and footer', shooting `.hp-spotlight` — the featured-
    // tool spotlight was removed from the homepage in v2.40.0. Retargeted at the
    // closing call, which is the last section above the footer now.
    test('home journey and footer', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'load' });
      await page.waitForSelector('.gf-journey', { timeout: 10000 });
      await waitForFonts(page);
      await page.evaluate(() => {
        document.querySelector('.gf-journey')?.scrollIntoView({ block: 'start' });
      });
      await page.waitForTimeout(800);
      await freezeAnimations(page);
      await expect(page).toHaveScreenshot(`home-journey-footer-${vp.name}.png`, {
        maxDiffPixelRatio: 0.035,
        clip: { x: 0, y: 0, width: vp.width, height: vp.height },
        mask: DYNAMIC_MASKS.map(s => page.locator(s)),
        animations: 'disabled',
      });
    });

    test('tools galaxy map', async ({ page }) => {
      await page.goto('/tools', { waitUntil: 'load' });
      await page.waitForSelector('.galaxy-map', { timeout: 10000 });
      await waitForFonts(page);
      await freezeAnimations(page);
      await expect(page).toHaveScreenshot(`tools-galaxy-${vp.name}.png`, {
        maxDiffPixelRatio: 0.035,
        clip: { x: 0, y: 0, width: vp.width, height: vp.height },
        mask: DYNAMIC_MASKS.map(s => page.locator(s)),
        animations: 'disabled',
      });
    });
  });
}

test.describe('overflow / 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('no horizontal overflow on home at 375px', async ({ page }) => {
    await page.goto('/home', { waitUntil: 'load' });
    await page.waitForSelector('app-root', { timeout: 10000 });
    const ok = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return el.scrollWidth <= window.innerWidth;
    });
    expect(ok, 'horizontal overflow on /home at 375px').toBe(true);
  });

  test('no horizontal overflow on tools at 375px', async ({ page }) => {
    await page.goto('/tools', { waitUntil: 'load' });
    await page.waitForSelector('app-root', { timeout: 10000 });
    const ok = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return el.scrollWidth <= window.innerWidth;
    });
    expect(ok, 'horizontal overflow on /tools at 375px').toBe(true);
  });
});
