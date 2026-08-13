/**
 * art-routes-paint.spec.ts — the paintings must actually reach the screen.
 *
 * Guards the Safari regression fixed in hotfix/safari-images, where every
 * painted route rendered as flat void in Safari while looking perfect in
 * Chrome. Nothing errored: the <img> loaded, `naturalWidth` was 1536, the
 * layer was `visibility: visible` at full opacity and the right size. It was
 * simply painted underneath something opaque.
 *
 * ── THE INVARIANT ──────────────────────────────────────────────────────────
 * Every scene (.scene, .rf-scene) is `position: fixed; z-index: -1` inside
 * <body>. Painting order in the root stacking context is:
 *
 *     canvas background  →  negative z-index descendants  →  in-flow blocks
 *
 * <body> is an in-flow block, so ANY opaque background on <body> paints in
 * front of all of them. That normally cannot happen, because a body background
 * propagates to the canvas instead of painting in flow — but only while <html>
 * has no background of its own. `styles.css` sets `html { background: #07090f }`,
 * so the propagation does not happen here and a body background is a real
 * opaque layer over the artwork.
 *
 * Blink hoists body's background to the canvas regardless, which is why Chrome
 * never showed the bug and why it survived review. WebKit implements the spec.
 *
 * So the invariant is narrow and worth asserting directly: on an art route,
 * <body> must not paint an opaque background. This is checked rather than a
 * screenshot because the failure is invisible to a DOM assertion and a
 * screenshot baseline would rot on every art change.
 */
import { test, expect } from '@playwright/test';

/** Routes that switch on `gf-art-route` and put a painting behind the page. */
const ART_ROUTES = ['/arena', '/market', '/forge-keeper', '/blueprint', '/rune-forge'];

/** Parses `rgb()` / `rgba()` into an alpha channel. Anything unparseable is
 *  treated as opaque, so a format this does not understand fails loudly
 *  rather than silently passing. */
function alphaOf(color: string): number {
  if (color === 'transparent') return 0;
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return 1;
  const parts = m[1].split(',').map(s => parseFloat(s.trim()));
  return parts.length < 4 ? 1 : parts[3];
}

for (const route of ART_ROUTES) {
  test(`${route} — body stays transparent so the painting is not covered`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });

    // The class is prerendered, so it is present before hydration; the wait is
    // for the scene component, which is what actually owns the artwork.
    await expect(page.locator('body.gf-art-route')).toHaveCount(1);

    const bg = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return { color: cs.backgroundColor, image: cs.backgroundImage };
    });

    expect(
      alphaOf(bg.color),
      `body.gf-art-route has an opaque background-color (${bg.color}) on ${route}. ` +
      `It will paint in front of the z-index:-1 scene and the artwork will be ` +
      `invisible in Safari. The floor colour belongs on <html>, not here.`,
    ).toBe(0);

    expect(
      bg.image,
      `body.gf-art-route has a background-image on ${route}, which paints in ` +
      `front of the z-index:-1 scene in Safari.`,
    ).toBe('none');
  });

  test(`${route} — scene artwork decodes`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });

    const img = page.locator('.scene__art img, .rf-scene__art img').first();
    await expect(img).toHaveCount(1);

    // naturalWidth is the decode result: a 404 or an unsupported format is 0.
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 15000 })
      .toBeGreaterThan(0);
  });
}
