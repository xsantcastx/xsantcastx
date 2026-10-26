/**
 * td-phase-shots.spec.ts — the world clock as a rule (design-bible §5.2, roadmap §10 item 4): the HUD's phase plate
 * under the minimap, night's creatures, the eclipse warning ribbon, Eclipse-touched creatures under the dark corona,
 * and the Spellbook's phase line.
 *
 * `?phase=night|dusk|warn|eclipse` is honoured only under an automated browser: the world clock jumps to that sky on
 * load (world-clock.service), and for night and the eclipse the engine lays a few of that sky's creatures round the
 * Keeper, standing calm (td-engine layPhaseShowcase). Screenshots: docs/handoff/cozy-ui/phase-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { pickSkill, seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const SIZES = { desktop: { width: 1400, height: 900 }, phone: { width: 390, height: 844 } } as const;

async function open(page: Page, phase: string, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en' });
  await page.goto(`/play?td=1&phase=${phase}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  // The goal card and the arrival title stand over the square: hide the one, wait out the other.
  await page.addStyleTag({ content: '.guide, .glim-say { visibility: hidden !important; }' });
}

for (const [name, size] of Object.entries(SIZES)) {
  test(`night: the plate turns, night's creatures walk (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    await open(page, 'night', size);
    await expect(canvas(page)).toHaveAttribute('data-phase', 'night', { timeout: 15000 });
    await expect(page.locator('.td-mini__sky')).toHaveAttribute('data-sky-phase', 'night');
    await expect(page.locator('.td-mini__sky')).toContainText('Night');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `docs/handoff/cozy-ui/phase-night-${name}.jpg`, type: 'jpeg', quality: 86 });
  });

  test(`dusk: the plate and the gold light (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    await open(page, 'dusk', size);
    await expect(canvas(page)).toHaveAttribute('data-phase', 'dusk', { timeout: 15000 });
    await expect(page.locator('.td-mini__sky')).toContainText('Dusk');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `docs/handoff/cozy-ui/phase-dusk-${name}.jpg`, type: 'jpeg', quality: 86 });
  });

  test(`the eclipse warning ribbon (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    await open(page, 'warn', size);
    const warn = page.locator('[data-eclipse-warn]');
    await expect(warn).toBeVisible({ timeout: 15000 });
    await expect(warn).toContainText('The moon mirror is turning');
    await expect(warn).toContainText(/In \d+ minutes the sun goes out/);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `docs/handoff/cozy-ui/phase-warn-${name}.jpg`, type: 'jpeg', quality: 86 });
  });

  test(`the eclipse: violet dark and Eclipse-touched creatures (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    await open(page, 'eclipse', size);
    await expect(canvas(page)).toHaveAttribute('data-phase', 'eclipse', { timeout: 15000 });
    await expect(page.locator('.td-mini__sky')).toHaveAttribute('data-sky-phase', 'eclipse');
    await expect(page.locator('[data-eclipse-warn]')).toHaveCount(0);
    // The showcase: a lone touched champion and a touched unique leading its minions.
    await expect(canvas(page)).toHaveAttribute('data-elites', /champion:[1-9].*unique:[1-9].*minion:[1-9]/, { timeout: 15000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `docs/handoff/cozy-ui/phase-eclipse-${name}.jpg`, type: 'jpeg', quality: 86 });
  });
}

test('the Spellbook says what the eclipse does to a Shadow spell', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'eclipse', SIZES.desktop);
  await expect(canvas(page)).toHaveAttribute('data-phase', 'eclipse', { timeout: 15000 });
  await canvas(page).focus();
  await page.keyboard.press('k');
  await expect(page.locator('.sbt')).toBeVisible();
  await page.locator('[data-book-tab="shadow"]').click();
  await pickSkill(page, 'drain-life');
  await expect(page.locator('.bcard .bcard__extra').first()).toHaveText('Eclipse now: +25% power');
  await pickSkill(page, 'dark-ward');
  await expect(page.locator('.bcard .bcard__extra', { hasText: 'Eclipse now' })).toHaveCount(0);   // a ward has no damage for the sky to turn
  await page.locator('[data-book-tab="ember"]').click();
  await pickSkill(page, 'hellfire-nova');
  await expect(page.locator('.bcard .bcard__extra').first()).toHaveText('Eclipse now: −15% power');
});
