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

  // Tool-card stagger lived on the retired /tools catalogue. World now lists
  // realm stations without tool cards, so this asserts the five realms render.
  test('world lists the five realm stations', async ({ page }) => {
    await page.goto('/world');
    await page.waitForSelector('.gf-station', { timeout: 10000 });
    const count = await page.locator('.gf-station').count();
    expect(count).toBe(5);
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
