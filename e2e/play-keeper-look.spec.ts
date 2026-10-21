/**
 * play-keeper-look.spec.ts — Make your Keeper, played (docs/handoff/make-your-keeper.md).
 *
 * At desktop and phone size: an existing save shows the one gentle nudge (a lit
 * dot on Places); the Places list opens the Glass of Becoming; the creator's
 * choices change the live preview; "Become this Keeper" saves through the
 * gateway and the world Keeper changes (the canvas carries the look key). Then a
 * weapon and a helm are worn: the world Keeper's gear key names both layers, and
 * the preview's pixels change (reduced motion holds the preview still, so the
 * diff is exact). Everything survives a reload.
 *
 * Seeding: the inventory blob is written from /robots.txt between visits (see
 * play-helpers), never from inside the app.
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, canvas, openPlay, seed, openMenu } from './play-helpers';
import { INVENTORY_ERA } from '../src/app/shared/rpg/inventory.model';
import { REALM_ERA_KEY } from '../src/app/shared/save/realm-era';

/** Handoff screenshots: only with KEEPER_SHOTS=1 (so a normal run never rewrites the docs). */
const SHOTS = 'docs/handoff/make-your-keeper';
async function shot(page: Page, name: string): Promise<void> {
  if (process.env['KEEPER_SHOTS']) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

const GEAR = [
  { id: 'kl-maul', definitionId: 'starfall-maul', name: 'Starfall Maul', rarity: 'legendary', slotId: 'weapon' },
  { id: 'kl-helm', definitionId: 'cometfall-helm', name: 'Cometfall Helm', rarity: 'epic', slotId: 'head' },
];
const INVENTORY = {
  version: 2,
  era: INVENTORY_ERA,
  records: GEAR.map((g, i) => ({
    id: g.id, definitionId: g.definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: g.rarity, soulbound: false,
    acquiredAt: '2026-10-14T00:00:00.000Z', revision: { hlc: 1, deviceId: 'e2e', sequence: i + 1 }, source: 'inventory',
    name: g.name, type: 'artifact', stats: { strikePower: 2 }, sellValue: 50, location: { kind: 'equipped', slotId: g.slotId },
  })),
  tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
};

const maker = (page: Page) => page.locator('section.place .km');
const preview = (page: Page) => maker(page).locator('canvas.km__preview');

async function openGlass(page: Page): Promise<void> {
  await page.locator('.places-toggle').click();
  await openMenu(page);
  await page.locator('#game-menu [data-open="glass"]').click();
  await expect(maker(page)).toBeVisible({ timeout: 15000 });
  await expect(preview(page)).toHaveAttribute('data-look-key', /./);
}
async function previewPixels(page: Page): Promise<string> {
  // Reduced motion: the preview is one still idle frame, so the pixels are exact.
  await page.waitForTimeout(150);
  return preview(page).evaluate(el => (el as HTMLCanvasElement).toDataURL());
}
async function closePlace(page: Page): Promise<void> {
  await page.locator('section.place .place-close').click();
  await expect(maker(page)).toBeHidden();
}

for (const size of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`make your Keeper, wear a weapon and a helm, reload (${size.name})`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
    await seed(page, { 'preferred-language': 'en' });
    await openPlay(page);

    // An existing save: no creator pops up, one lit dot on Places.
    await expect(maker(page)).toBeHidden();
    await expect(page.locator('.places-toggle .look-nudge')).toBeVisible();
    const before = await canvas(page).getAttribute('data-keeper-look');
    expect(before).toBeTruthy();
    if (size.name === 'phone') await shot(page, `before-${size.name}`);

    await openGlass(page);
    await expect(page.locator('.places-toggle .look-nudge')).toHaveCount(0);
    const first = await previewPixels(page);
    const firstKey = await preview(page).getAttribute('data-look-key');
    await maker(page).locator('[data-field="hair"] .km__step--next').click();
    await maker(page).locator('[data-field="skin"] .km__step--next').click();
    await maker(page).locator('[data-field="outfit"] .km__step--next').click();
    await maker(page).locator('[data-field="face"] .km__step--next').click();
    await expect(preview(page)).not.toHaveAttribute('data-look-key', firstKey!);
    expect(await previewPixels(page), 'the preview repaints on a choice').not.toBe(first);
    // Every control is a thumb-sized target.
    for (const box of await maker(page).locator('button, input').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) {
      expect(box).toBeGreaterThanOrEqual(44);
    }
    await maker(page).locator('input[type="text"]').fill('Ashwyn');
    await maker(page).getByRole('button', { name: 'Become this Keeper' }).click();
    await expect(maker(page)).toBeHidden();

    // The world Keeper is the new one, and the save says so.
    await expect(canvas(page)).not.toHaveAttribute('data-keeper-look', before!);
    const made = await canvas(page).getAttribute('data-keeper-look');
    await expect(page.locator('.vitals')).toContainText('Ashwyn');
    await expect.poll(() => blob<{ made: boolean; name: string }>(page, 'godforge-keeper-look').then(b => b && `${b.made}:${b.name}`)).toBe('true:Ashwyn');
    await openGlass(page);
    const bare = await previewPixels(page);
    await closePlace(page);

    // Wear a weapon and a helm (written between visits), then come back.
    await page.goto('/robots.txt');
    await page.evaluate(({ inv, eraKey, era }) => {
      localStorage.setItem('godforge-inventory', JSON.stringify(inv));
      localStorage.setItem(eraKey, era);
    }, { inv: INVENTORY, eraKey: REALM_ERA_KEY, era: String(INVENTORY_ERA) });
    await openPlay(page);

    // Survived the reload: same look, the name, and now the gear layers.
    await expect(canvas(page)).toHaveAttribute('data-keeper-look', made!);
    await expect(page.locator('.vitals')).toContainText('Ashwyn');
    await expect(canvas(page)).toHaveAttribute('data-keeper-gear', /weapon:hammer:celestial:legendary/);
    await expect(canvas(page)).toHaveAttribute('data-keeper-gear', /head:helm:celestial:epic/);
    await expect(page.locator('.places-toggle .look-nudge')).toHaveCount(0);
    await openGlass(page);
    const geared = await previewPixels(page);
    expect(geared, 'the maul and the helm show on the Keeper').not.toBe(bare);
    await shot(page, `maker-${size.name}`);
    await closePlace(page);
    await page.waitForTimeout(300);
    await shot(page, `after-${size.name}`);
  });
}
