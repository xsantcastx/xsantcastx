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

for (const vp of VIEWPORTS) {
  test.describe(`visual / ${vp.name}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('home hero', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'load' });
      await page.waitForSelector('.hc-card', { timeout: 10000 });
      await waitForFonts(page);
      await freezeAnimations(page);
      await expect(page).toHaveScreenshot(`home-hero-${vp.name}.png`, {
        maxDiffPixelRatio: 0.035,
        clip: { x: 0, y: 0, width: vp.width, height: vp.height },
        mask: DYNAMIC_MASKS.map(s => page.locator(s)),
        animations: 'disabled',
      });
    });

    test('home planet section', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'load' });
      await page.waitForSelector('.cosmic-planet', { timeout: 10000 });
      await waitForFonts(page);
      await page.evaluate(() => {
        document.querySelector('.cosmic-planet')?.scrollIntoView({ block: 'center' });
      });
      // the planet's SVG feTurbulence data-URI layers decode asynchronously —
      // longest settle + loosest tolerance of the suite (noisiest shot)
      await page.waitForTimeout(1500);
      await freezeAnimations(page);
      await expect(page).toHaveScreenshot(`home-planet-${vp.name}.png`, {
        maxDiffPixelRatio: 0.05,
        clip: { x: 0, y: 0, width: vp.width, height: vp.height },
        mask: DYNAMIC_MASKS.map(s => page.locator(s)),
        animations: 'disabled',
      });
    });

    test('home spotlight and footer', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'load' });
      await page.waitForSelector('.hp-spotlight', { timeout: 10000 });
      await waitForFonts(page);
      await page.evaluate(() => {
        document.querySelector('.hp-spotlight')?.scrollIntoView({ block: 'start' });
      });
      await page.waitForTimeout(800);
      await freezeAnimations(page);
      await expect(page).toHaveScreenshot(`home-spotlight-footer-${vp.name}.png`, {
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
