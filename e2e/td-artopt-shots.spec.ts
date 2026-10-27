/**
 * td-artopt-shots.spec.ts — the art-direction prototype's photographs (docs/handoff/artopt/). Skipped unless
 * ARTOPT_SHOTS is set:
 *
 *   ARTOPT_SHOTS=1 [ARTOPT=live,a,b,c] PW_PORT=4704 npx playwright test e2e/td-artopt-shots --project=chromium
 *
 * The same scene for every look (td-artopt.ts, `?artopt=`): the Emberwood road at noon (tile 58,62 beside the worn
 * road) with the Keeper (an Ashguard, cape and sword) and his aura on, three Bone Walkers round him and the shade-kit
 * at his side; then the town square where a new Keeper starts, aura and pet the same. 1280×800 at 2 device px per CSS
 * px (a laptop's Retina screen) and 390×844 at 3 (a phone's), into docs/handoff/artopt/<OPT>-<scene>-<size>.png
 * (`live` is the look players have now). A camera, not a test.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const ON = !!process.env['ARTOPT_SHOTS'];
const OPTS = (process.env['ARTOPT'] ?? 'live,a,b,c').split(',');
const DIR = 'docs/handoff/artopt';
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
] as const;

type Zones = { to(c: number, r: number): boolean; foe(type: string, level: number, dx?: number, dy?: number): number | null };
type Art = { aura(on: boolean): void; road(dc: number): unknown; pet?(id: string): boolean };
const zones = (page: Page, fn: string) => page.evaluate(f => new Function('z', `return (${f})(z)`)((window as unknown as { __tdZones: Zones }).__tdZones), fn);
const art = (page: Page, fn: string) => page.evaluate(f => new Function('a', `return (${f})(a)`)((window as unknown as { __tdArt: Art }).__tdArt), fn);

async function open(page: Page, opt: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 },
  });
  await page.goto(`/play?td=1&hour=12${opt === 'live' ? '' : `&artopt=${opt}`}`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown; __tdArt?: unknown }).__tdZones && !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  await page.waitForTimeout(2500);
  // The first-run tutorial's card and Glim's line cover the right of the screen: set them aside for the photograph.
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
  const close = page.locator('button[aria-label*="lose" i]').first();
  if (await close.isVisible().catch(() => false)) await close.click().catch(() => undefined);
}

const shots = ON ? test.describe : test.describe.skip;
for (const size of SIZES) for (const opt of OPTS) {
  shots(`artopt ${opt} (${size.name})`, () => {
    test.use(size.use);
    test('emberwood road', async ({ page }) => {
      test.setTimeout(120000);
      await open(page, opt);
      await zones(page, 'z => z.to(58, 62)');
      await art(page, 'a => a.road(0)');
      await page.waitForTimeout(600);
      await zones(page, "z => { z.foe('bone-walker', 3, -50, -28); z.foe('bone-walker', 3, 50, -34); z.foe('bone-walker', 3, -46, 30); return true; }");
      await art(page, process.env['ARTOPT_NOAURA'] ? "a => { a.pet?.('shade-kit'); }" : "a => { a.aura(true); a.pet?.('shade-kit'); }");
      // Past the aura's start pulse, the pet settled at the Keeper's side.
      await page.waitForTimeout(4500);
      await page.screenshot({ path: `${DIR}/${opt === 'live' ? 'live' : opt.toUpperCase()}-${size.name}.png` });
    });
    test('town square', async ({ page }) => {
      test.setTimeout(120000);
      await open(page, opt);
      await art(page, "a => { a.aura(true); a.pet?.('shade-kit'); }");
      await page.waitForTimeout(4500);
      await page.screenshot({ path: `${DIR}/${opt === 'live' ? 'live' : opt.toUpperCase()}-town-${size.name}.png` });
    });
  });
}
