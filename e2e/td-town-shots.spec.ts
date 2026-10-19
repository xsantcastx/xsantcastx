/**
 * td-town-shots.spec.ts — a camera on the top-down square (townsfolk, minimap, night, fireflies) for the cozy pass
 * (docs/handoff/cozy-ui.md). Skipped unless TD_SHOTS names a prefix:
 *
 *   TD_SHOTS=after PW_PORT=4653 npx playwright test --project=chromium --reporter=line e2e/td-town-shots
 */
import { test } from '@playwright/test';
import { seed } from './play-helpers';
import { STASH } from './play-menus';

const PREFIX = process.env['TD_SHOTS'] ?? '';
for (const [w, h] of [[390, 844], [1280, 800]] as const) {
  for (const hour of [12, 22]) {
    test(`td town ${w}x${h} at ${hour}h`, async ({ page }) => {
      test.skip(!PREFIX, 'set TD_SHOTS to take the screenshots');
      await page.setViewportSize({ width: w, height: h });
      await seed(page, { ...STASH, 'eclipse-td': '1' });
      await page.goto(`/play?td=1&hour=${hour}`);
      await page.waitForTimeout(9000);
      await page.screenshot({ path: `docs/handoff/cozy-ui/${PREFIX}-town-${w}x${h}-${hour}h.jpg`, type: 'jpeg', quality: 75 });
    });
  }
}
