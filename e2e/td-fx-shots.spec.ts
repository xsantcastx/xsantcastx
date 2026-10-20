/**
 * td-fx-shots.spec.ts — the effects pass (docs/design/effects-spec.md): close-ups round the Keeper at night with the
 * Aura of Embers and then the Aura of Siphoning running, the aura's icon on the portrait's corner, and the spells
 * that need no foe (Hellfire Nova, Dark Ward, Raise Skeleton) caught mid-effect. Screenshots land in
 * docs/handoff/cozy-ui/fx-*.jpg. Nothing here asserts on a fight's outcome.
 */
import { expect, test, type Page } from '@playwright/test';
import { SKILLS_LEARNED, pickSkill, seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();

/** A square round the Keeper: the camera holds him at the middle of the canvas, 20 art px above his feet. */
async function keeperClip(page: Page, size = 360): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2 + 20;
  return { x: Math.round(cx - size / 2), y: Math.round(cy - size / 2), width: size, height: size };
}

async function shot(page: Page, name: string, size?: number): Promise<void> {
  await page.screenshot({ path: `docs/handoff/cozy-ui/fx-${name}.jpg`, type: 'jpeg', quality: 85, clip: await keeperClip(page, size) });
}

/**
 * Night in the Molten Deep's first floor (open dark floor, creatures about): sail to Pyrehold and take the Map's key
 * there (as td-map.spec.ts). The trip runs with reduced motion (instant travel); the effects are shot with full motion.
 */
async function toMoltenDeep(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'eclipse-td': '1', ...SKILLS_LEARNED });
  await page.goto('/play?td=1&hour=21');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await canvas(page).focus();
  await page.keyboard.press('m');
  const map = page.locator('#places-list.td-map');
  await map.locator('.td-map__pin[title="Ship To Pyrehold"]').click();
  await expect(canvas(page)).toHaveAttribute('data-area', /pyrehold/i, { timeout: 30000 });
  await page.keyboard.press('m');
  await map.locator('.td-map__key button', { hasText: /the molten deep/i }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', /scorched throat/i, { timeout: 30000 });
  await page.keyboard.press('Escape');
  await expect(map).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await canvas(page).focus();
}

/** The Spellbook's aura switch (K): turn the named aura on. */
async function runAura(page: Page, id: string): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('k');
  await pickSkill(page, id);
  const btn = page.locator('.sbt__detail .sb__aura');
  if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.spellbook .win-x').click();
  await expect(page.locator('.spellbook')).toHaveCount(0);
  await canvas(page).focus();
}

test('auras at night: Embers, then Siphoning, the icon on the portrait', async ({ page }) => {
  test.setTimeout(120000);
  await toMoltenDeep(page);
  await runAura(page, 'aura-embers');
  await expect(page.locator('.hero-face .hero-aura svg')).toBeVisible();
  await page.waitForTimeout(1600);
  await shot(page, 'aura-embers');
  await page.screenshot({ path: 'docs/handoff/cozy-ui/fx-hud-portrait.jpg', type: 'jpeg', quality: 85, clip: { x: 0, y: 50, width: 260, height: 110 } });
  await runAura(page, 'aura-siphon');
  await page.waitForTimeout(1600);
  await shot(page, 'aura-siphon');
});

/** Leave no aura running, so each spell reads on its own; then each spell goes on key 1 through the Spellbook. */
async function spellCaster(page: Page): Promise<(id: string, wait: number, name: string, size?: number) => Promise<void>> {
  await page.keyboard.press('k');
  await pickSkill(page, 'aura-embers');
  const on = page.locator('.sbt__detail .sb__aura[aria-pressed="true"]');
  if (await on.count()) await on.first().click();
  await page.locator('.spellbook .win-x').click();
  await canvas(page).focus();
  return async (id, wait, name, size) => {
    await page.keyboard.press('k');
    await pickSkill(page, id);
    await page.locator('.sbt__detail .sb__keys button', { hasText: '1' }).click();
    await page.locator('.spellbook .win-x').click();
    await expect(page.locator('.spellbook')).toHaveCount(0);
    await canvas(page).focus();
    await page.keyboard.press('1');
    await page.waitForTimeout(wait);
    await shot(page, name, size);
  };
}

// The Keeper starts with 60 mana: each test spends under that.
test('spells at night: Dark Ward, Hellfire Nova and its scorch', async ({ page }) => {
  test.setTimeout(120000);
  await toMoltenDeep(page);
  const cast = await spellCaster(page);
  await cast('dark-ward', 700, 'ward');
  await cast('hellfire-nova', 160, 'nova');
  await page.waitForTimeout(300);
  await shot(page, 'nova-scorch');
});

test('spells at night: Raise Skeleton, and the ones a foe takes', async ({ page }) => {
  test.setTimeout(120000);
  await toMoltenDeep(page);
  const cast = await spellCaster(page);
  await cast('raise-skeleton', 120, 'raise-sigil');
  // A step toward the creatures below, then the spells that need a foe (whatever answers; nothing is asserted).
  await page.keyboard.down('s'); await page.waitForTimeout(700); await page.keyboard.up('s');
  await cast('bone-spear', 50, 'bone-spear', 520);
  // The floor's title card fades after a few seconds; the foe's close-ups wait for it.
  await page.waitForTimeout(3500);
  await cast('drain-life', 330, 'drain', 520);
  await page.keyboard.down('j'); await page.waitForTimeout(450); await shot(page, 'bolt', 520); await page.keyboard.up('j');
});

test('the aura icon beside the orbs on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=21');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await expect(page.locator('.td-orbs .td-aura-badge svg')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/fx-phone.jpg', type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 390, height: 420 } });
});
