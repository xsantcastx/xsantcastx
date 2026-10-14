/**
 * art-shots.spec.ts — before/after screenshots for the one-art-style pass
 * (docs/handoff/one-art-style.md). Skipped unless ART_SHOTS names a prefix:
 *
 *   ART_SHOTS=before PW_PORT=4341 npx playwright test e2e/art-shots --project=chromium
 *
 * Each scene is shot at 390×844 (phone, touch) and 1280×800 into
 * docs/handoff/one-art-style/<prefix>-<scene>-<size>.jpg. Nothing is asserted
 * beyond reaching the scene: this is a camera, not a test.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, ERA, focusWorld, openPlay, seed, walk } from './play-helpers';
import { DelveFixture } from './play-delve-fixtures';
import { TOWNS, type RealmTownId } from '../src/app/play/world/world.model';
import { TOWN_KEEPERS } from '../src/app/play/world/life';

const PREFIX = process.env['ART_SHOTS'] ?? '';
const DIR = 'docs/handoff/one-art-style';
const RESTORED = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };
const REALMS: RealmTownId[] = ['infernal', 'luminous', 'umbral', 'celestial', 'verdant'];
const HUNT_LINK: Record<RealmTownId, RegExp> = {
  infernal: /East Passage/i, luminous: /East Stair/i, umbral: /Unrecorded Corridors/i, celestial: /East Passage/i, verdant: /Root Path/i,
};
const HUNT_NAME: Record<RealmTownId, string> = {
  infernal: 'Ember Quarry', luminous: 'Reflection Channels', umbral: 'Unrecorded Corridors', celestial: 'Orrery Rings', verdant: 'Rootglass Thicket',
};

const SIZES = [
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
] as const;

async function shot(page: Page, scene: string, size: string): Promise<void> {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/${PREFIX}-${scene}-${size}.jpg`, type: 'jpeg', quality: 82 });
}

async function descend(page: Page, f: DelveFixture): Promise<void> {
  await seed(page, { ...RESTORED, ...f.blobs() });
  await openPlay(page, '?at=delve');
  const button = page.getByRole('button', { name: /Descend to your camp/ });
  await expect(button).toBeVisible({ timeout: 60000 });
  await button.click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await page.waitForTimeout(1800);
}

const shots = PREFIX ? test.describe : test.describe.skip;

for (const size of SIZES) {
  shots(`art shots (${size.name})`, () => {
    test.use(size.use);
    test.describe.configure({ timeout: 180000 });

    for (const realm of REALMS) {
      test(`town ${realm}`, async ({ page }) => {
        await seed(page, { ...RESTORED, 'eclipse-play-world-v1': { town: realm } });
        await openPlay(page);
        // Stand among the keepers: the first two keepers' stations.
        const town = TOWNS[realm]!;
        const xs = TOWN_KEEPERS[realm].slice(0, 2).map(k => town.stations.find(s => s.id === k.station)!.x);
        const target = xs.reduce((a, b) => a + b, 0) / xs.length;
        const now = Number(await canvas(page).getAttribute('data-player-x'));
        await focusWorld(page);
        await walk(page, target > now ? 'd' : 'a', target, 40000).catch(() => undefined);
        await shot(page, `town-${realm}`, size.name);
      });

      test(`hunt ${realm}`, async ({ page }) => {
        await seed(page, { ...RESTORED, 'eclipse-play-world-v1': { town: realm } });
        await openPlay(page);
        await page.getByRole('button', { name: 'Places' }).click();
        await page.locator('#places-list button', { hasText: HUNT_LINK[realm] }).first().click();
        await expect(canvas(page)).toHaveAttribute('data-area', HUNT_NAME[realm], { timeout: 90000 });
        await page.waitForTimeout(800);
        // Close enough that the first creature is on a phone's screen too.
        const hunt = TOWNS[realm]!.hunts.find(h => h.name === HUNT_NAME[realm])!;
        await walk(page, 'd', Math.min(...hunt.monsters[0].spawnXs) - 260, 40000).catch(() => undefined);
        await shot(page, `hunt-${realm}`, size.name);
      });
    }

    test('delve bailiff hall', async ({ page }) => {
      await descend(page, new DelveFixture().carve(30, 50, 45, 48).floor(30, 50, 49).camp(33, 48));
      await shot(page, 'delve-bailiffs', size.name);
    });
  });
}
