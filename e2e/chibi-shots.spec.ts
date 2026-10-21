/**
 * chibi-shots.spec.ts — before/after screenshots for the chibi Keeper pass
 * (docs/handoff/chibi-keepers.md). Skipped unless CHIBI_SHOTS names a prefix:
 *
 *   CHIBI_SHOTS=after PW_PORT=4381 npx playwright test e2e/chibi-shots --project=chromium
 *
 * Town, hunt, Delve, the Glass of Becoming and the paper doll, each at 390×844
 * and 1280×800, into docs/handoff/chibi-keepers/<prefix>-<scene>-<size>.jpg.
 * The people/creature galleries come from `node scripts/keeper-gallery.mjs`.
 * A camera, not a test: nothing is asserted beyond reaching the scene.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, ERA, focusWorld, openPlay, seed, walk, mapFind } from './play-helpers';
import { DelveFixture } from './play-delve-fixtures';
import { TOWNS, type RealmTownId } from '../src/app/play/world/world.model';
import { TOWN_KEEPERS } from '../src/app/play/world/life';

const PREFIX = process.env['CHIBI_SHOTS'] ?? '';
const DIR = 'docs/handoff/chibi-keepers';
const RESTORED = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };

const SIZES = [
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
] as const;

async function shot(page: Page, scene: string, size: string): Promise<void> {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/${PREFIX}-${scene}-${size}.jpg`, type: 'jpeg', quality: 85 });
}

const shots = PREFIX ? test.describe : test.describe.skip;

for (const size of SIZES) {
  shots(`chibi shots (${size.name})`, () => {
    test.use(size.use);
    test.describe.configure({ timeout: 180000 });

    for (const realm of ['infernal', 'luminous'] as RealmTownId[]) {
      test(`town ${realm}`, async ({ page }) => {
        await seed(page, { ...RESTORED, 'preferred-language': 'en', 'eclipse-play-world-v1': { town: realm } });
        await openPlay(page);
        const town = TOWNS[realm]!;
        const xs = TOWN_KEEPERS[realm].slice(0, 2).map(k => town.stations.find(s => s.id === k.station)!.x);
        const target = xs.reduce((a, b) => a + b, 0) / xs.length;
        const now = Number(await canvas(page).getAttribute('data-player-x'));
        await focusWorld(page);
        await walk(page, target > now ? 'd' : 'a', target, 40000).catch(() => undefined);
        await shot(page, `town-${realm}`, size.name);
      });
    }

    test('hunt verdant', async ({ page }) => {
      await seed(page, { ...RESTORED, 'preferred-language': 'en', 'eclipse-play-world-v1': { town: 'verdant' } });
      await openPlay(page);
      await page.getByRole('button', { name: 'Places' }).click();
      await mapFind(page, /Root Path/i);
      await page.locator('#places-list button', { hasText: /Root Path/i }).first().click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Rootglass Thicket', { timeout: 90000 });
      await page.waitForTimeout(800);
      const hunt = TOWNS['verdant']!.hunts.find(h => h.name === 'Rootglass Thicket')!;
      await walk(page, 'd', Math.min(...hunt.monsters[0].spawnXs) - 260, 40000).catch(() => undefined);
      await shot(page, 'hunt-verdant', size.name);
    });

    test('delve', async ({ page }) => {
      const f = new DelveFixture().carve(30, 50, 45, 48).floor(30, 50, 49).camp(33, 48);
      await seed(page, { ...RESTORED, 'preferred-language': 'en', ...f.blobs() });
      await openPlay(page, '?at=delve');
      const button = page.getByRole('button', { name: /Descend to your camp/ });
      await expect(button).toBeVisible({ timeout: 60000 });
      await button.click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
      await page.waitForTimeout(1800);
      await shot(page, 'delve', size.name);
    });

    test('creator', async ({ page }) => {
      await seed(page, { ...RESTORED, 'preferred-language': 'en' });
      await openPlay(page);
      await page.locator('.places-toggle').click();
      await page.locator('#places-list [data-open="glass"]').click();
      await expect(page.locator('section.place .km canvas.km__preview')).toHaveAttribute('data-look-key', /./, { timeout: 15000 });
      await shot(page, 'creator', size.name);
    });

    test('paper doll', async ({ page }) => {
      await seed(page, { ...RESTORED, 'preferred-language': 'en' });
      await page.goto('/character', { waitUntil: 'load' });
      await expect(page.locator('.ld__doll-art').first()).toBeVisible({ timeout: 30000 });
      // The boot curtain (.gf-loader) paints over everything until it lifts.
      await page.waitForFunction(() => {
        const loader = document.querySelector('.gf-loader');
        return !loader || loader.classList.contains('gf-loader--hidden') || getComputedStyle(loader).visibility === 'hidden'
          || getComputedStyle(loader).opacity === '0' || getComputedStyle(loader).display === 'none';
      }, null, { timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.locator('.ld__doll').first().scrollIntoViewIfNeeded();
      await shot(page, 'paper-doll', size.name);
    });
  });
}
