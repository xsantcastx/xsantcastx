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

  // (a) Sibling cards sit on staggered animation-delays, so they breathe out of
  // phase rather than pulsing in unison. We cannot wait out a 6s cycle in
  // headless CI, so the computed animationDelay is the proxy for "each card is
  // at a different point in the cycle".
  //
  // This used to target the hero carousel's `.hc-card`. That component was
  // deleted in v2.19.0 when the home page became the entrance to the forge, and
  // the selector matches nothing in the DOM today — so the test had been failing
  // on `waitForSelector` for sixteen releases, against markup that no longer
  // exists. It is retargeted here at `.hp-tool-card__icon-wrap`, which carries
  // the same nth-child stagger (landing.component.css) and is the surviving
  // instance of the pattern this test was written to protect.
  test('tool card icons have staggered animation-delay (cycle proxy)', async ({ page }) => {
    await page.goto('/world');
    await page.waitForSelector('.hp-tool-card__icon-wrap', { timeout: 10000 });

    const delays = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('.hp-tool-card__icon-wrap'));
      return icons.slice(0, 6).map(icon => window.getComputedStyle(icon).animationDelay);
    });

    expect(delays.length, 'should find at least 2 .hp-tool-card__icon-wrap elements').toBeGreaterThanOrEqual(2);

    // At least 2 distinct delay values means stagger is active
    const uniqueDelays = new Set(delays);
    expect(
      uniqueDelays.size,
      `Expected staggered animation-delays but all icons share the same delay: ${JSON.stringify(delays)}`,
    ).toBeGreaterThanOrEqual(2);
  });

  // (b) The CSS planet's animation checks used to live here — two tests on
  // `.cosmic-planet` and its surface/cloud/sphere layers.
  //
  // v2.39.0 deleted the planet outright ("sphere, rings, clouds, terminator,
  // night lights, the moon and the beacon, six hundred and ninety-five lines of
  // stylesheet") when the painted hero replaced the CSS impression of one. The
  // selector matches nothing anywhere in src/ now, so both tests could only ever
  // time out on waitForSelector. They are removed rather than retargeted: the
  // thing they guarded was deliberately deleted, and there is no successor
  // element that means the same thing.
  //
  // The stagger check above (a) still covers "component animations are alive and
  // out of phase", which is the property this group exists to protect.

  // (c) Orbitron font is available after page load
  test('Orbitron font is available after document.fonts.ready', async ({ page }) => {
    // 'load', not 'networkidle'. This page keeps Firestore long-polling and
    // analytics connections open, so it never reaches two consecutive idle
    // network seconds and the wait always burned the full 30s timeout — the
    // same trap embed-smoke.spec.ts already documents and avoids.
    //
    // Nothing is lost by dropping it: document.fonts.ready below is the actual
    // synchronisation point for a font assertion, and it resolves only once
    // every pending font load has settled. networkidle was never what made this
    // test correct.
    await page.goto('/world', { waitUntil: 'load' });

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
