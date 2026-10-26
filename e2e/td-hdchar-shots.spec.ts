/**
 * td-hdchar-shots.spec.ts — the HD Keepers and townsfolk at the isometric angle (td-hd-keeper.ts, docs/handoff/hdchar/).
 * Skipped unless HDCHAR_SHOTS is set:
 *
 *   HDCHAR_SHOTS=1 [HDCHAR_VOC=ashguard,warlock,lanternwright,thornstrider] PW_PORT=4709 \
 *     npx playwright test e2e/td-hdchar-shots --project=chromium
 *
 * The town square with its people, and the inn with the Keeper, per calling, at 1280×800 DPR 2 and 390×844 DPR 3, into
 * docs/handoff/hdchar/<scene>-<calling>-<size>.png. Also reads the cached HD sheets' memory (window.__tdArt.hdBytes).
 * A camera, not a test.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const ON = !!process.env['HDCHAR_SHOTS'];
const VOCS = (process.env['HDCHAR_VOC'] ?? 'ashguard,warlock,lanternwright,thornstrider').split(',');
const DIR = 'docs/handoff/hdchar';
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
] as const;

const run = (page: Page, fn: string) => page.evaluate(f => new Function('w', `return (${f})(w)`)(window), fn);

async function open(page: Page, vocation: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation, skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 },
  });
  await page.goto('/play?td=1&hour=12&artopt=iso');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  await page.waitForTimeout(2000);
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
}

const shots = ON ? test.describe : test.describe.skip;
for (const size of SIZES) shots(`hdchar (${size.name})`, () => {
  test.use(size.use);
  for (const v of VOCS) {
    test(`town ${v}`, async ({ page }) => {
      test.setTimeout(120000);
      await open(page, v);
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${DIR}/town-${v}-${size.name}.png` });
      const bytes = await run(page, 'w => w.__tdArt.hdBytes?.() ?? -1');
      console.warn(`hd sheets ${v} ${size.name}: ${(Number(bytes) / 1048576).toFixed(1)} MB`);
    });
    test(`tavern ${v}`, async ({ page }) => {
      test.setTimeout(120000);
      await open(page, v);
      await run(page, "w => w.__tdArt.visit('artopt-tavern', 9, 8, 'ember-isle')");
      await page.waitForTimeout(7000);
      await page.screenshot({ path: `${DIR}/tavern-${v}-${size.name}.png` });
    });
  }
});
