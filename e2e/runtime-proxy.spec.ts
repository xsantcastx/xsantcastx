import { test, expect } from '@playwright/test';

// A-3 proxy: runtime animation/font checks at 375px mobile viewport.
// IMPORTANT: This is a PROXY for real-device validation — it runs in a
// headless browser against the static build, not on a real iPhone or Android.
// Real-device pass (carousel cycling, touch ripples, font swap) still belongs
// to the developer as a manual step (see spec A-3).

test.describe('runtime proxy / 375px', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    // Disable reduced-motion so CSS animation-play-state is 'running', not killed
    // by the @media(prefers-reduced-motion:reduce) block that sets animation:none!important
    // on all planet layers.
    reducedMotion: 'no-preference',
  });

  // (a) Hero carousel cycles: hc-card elements have different --ci values
  // which map to animation-delay stagger. We assert that the computed
  // animationDelay differs across cards, confirming each is on its own
  // cycle phase. We cannot wait 6s in headless CI, so we use the delay
  // property as the proxy for "each card is at a different point in the cycle."
  test('carousel cards have staggered animation-delay (cycle proxy)', async ({ page }) => {
    await page.goto('/home');
    await page.waitForSelector('.hc-card', { timeout: 10000 });

    const delays = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.hc-card'));
      return cards.slice(0, 5).map(card => {
        const style = window.getComputedStyle(card);
        return style.animationDelay;
      });
    });

    expect(delays.length, 'should find at least 2 hc-card elements').toBeGreaterThanOrEqual(2);

    // At least 2 distinct delay values means stagger is active
    const uniqueDelays = new Set(delays);
    expect(
      uniqueDelays.size,
      `Expected staggered animation-delays but all cards share the same delay: ${JSON.stringify(delays)}`,
    ).toBeGreaterThanOrEqual(2);
  });

  // (b) Planet has a running CSS animation — check .cosmic-planet__surface which
  // has an independent drifting background-position animation distinct from the
  // sphere's rotation. Angular scopes keyframe names with _ngcontent hashes so we
  // just assert animationName !== 'none', not the exact name.
  test('cosmic-planet has active animation (surface layer)', async ({ page }) => {
    await page.goto('/home');
    await page.waitForSelector('.cosmic-planet', { timeout: 10000 });

    // Scroll planet into view so it is not offscreen (display:none etc.)
    await page.evaluate(() => {
      const el = document.querySelector('.cosmic-planet');
      if (el) el.scrollIntoView({ block: 'center' });
    });

    const animInfo = await page.evaluate(() => {
      // Check multiple planet layers; return the first one with a non-none animation.
      const selectors = [
        '.cosmic-planet__surface',
        '.cosmic-planet__clouds',
        '.cosmic-planet__sphere',
        '.cosmic-planet__atmosphere',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const style = window.getComputedStyle(el);
        if (style.animationName && style.animationName !== 'none') {
          return {
            found: true,
            selector: sel,
            animationName: style.animationName,
            animationPlayState: style.animationPlayState,
          };
        }
      }
      // Fallback: report what the sphere has even if none
      const sphere = document.querySelector('.cosmic-planet__sphere');
      const style = sphere ? window.getComputedStyle(sphere) : null;
      return {
        found: !!sphere,
        selector: '.cosmic-planet__sphere (fallback)',
        animationName: style?.animationName ?? 'element not found',
        animationPlayState: style?.animationPlayState ?? '',
      };
    });

    expect(animInfo.found, '.cosmic-planet and its layers not found in DOM').toBe(true);
    expect(
      animInfo.animationName,
      `Planet layer "${animInfo.selector}" has no animation — prefers-reduced-motion may still be active or Angular hydration not complete`,
    ).not.toBe('none');
  });

  // Belt-and-suspenders: planet element exists
  test('cosmic-planet element exists at 375px', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('.cosmic-planet').first()).toBeAttached({ timeout: 10000 });
  });

  // (c) Orbitron font is available after page load
  test('Orbitron font is available after document.fonts.ready', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    const orbitronReady = await page.evaluate(async () => {
      await document.fonts.ready;
      return (
        document.fonts.check('1em Orbitron') ||
        document.fonts.check('700 1em Orbitron') ||
        document.fonts.check('1em "Orbitron"')
      );
    });

    expect(
      orbitronReady,
      'Orbitron font not loaded — either not in document.fonts or failed to fetch',
    ).toBe(true);
  });
});
