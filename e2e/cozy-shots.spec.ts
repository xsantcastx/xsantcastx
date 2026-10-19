/**
 * cozy-shots.spec.ts — before/after screenshots of every in-game menu for the cozy UI pass
 * (docs/handoff/cozy-ui.md). Skipped unless COZY_SHOTS names a prefix:
 *
 *   COZY_SHOTS=after PW_PORT=4652 npx playwright test --project=chromium --reporter=line e2e/cozy-shots
 *
 * Each menu at 390×844, 844×390 and 1280×800, over the top-down square, into
 * docs/handoff/cozy-ui/<prefix>-<menu>-<size>.jpg. A camera, not a test.
 */
import { test } from '@playwright/test';
import { ALL_SIZES, EXTRA_MENUS, MENUS, openMenu } from './play-menus';

const PREFIX = process.env['COZY_SHOTS'] ?? '';
const DIR = 'docs/handoff/cozy-ui';
const SIZES = ALL_SIZES.filter(s => ['390x844', '844x390', '1280x800'].includes(s.tag));
const ONLY = (process.env['COZY_ONLY'] ?? '').split(',').filter(Boolean);

for (const size of SIZES) {
  test.describe(`cozy shots ${size.tag}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.mobile });
    for (const menu of [...MENUS, ...EXTRA_MENUS]) {
      if (ONLY.length && !ONLY.includes(menu.id)) continue;
      test(`${menu.id}`, async ({ page }) => {
        test.skip(!PREFIX, 'set COZY_SHOTS to take the screenshots');
        const opened = await openMenu(page, { ...menu, blobs: { 'eclipse-td': '1', ...(menu.blobs ?? {}) } });
        await page.screenshot({ path: `${DIR}/${PREFIX}-${menu.id}-${size.tag}${opened ? '' : '-NOTOPEN'}.jpg`, type: 'jpeg', quality: 72 });
      });
    }
  });
}
