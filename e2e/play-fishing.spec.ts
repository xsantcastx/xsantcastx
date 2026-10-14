/**
 * play-fishing.spec.ts — Fishing v1 (docs/handoff/liquids-fishing.md), played
 * at 1280×800 with keys and at 390×844 with touch:
 *
 *   - the Grotto Mere is in the glowcap cavern; the Keeper's Worn Rod is in the satchel from the start
 *   - stand on a dry shore, the prompt offers "Fish here"; cast, wait for the dip, hook it
 *   - the Line Tension reel runs, and the fish is landed whatever the grade
 *   - the catch is in the satchel, the fishing ledger counts it, the Catalogue of Strange Fish names it
 *
 * The Delve is built by the game's own pure code (play-delve-fixtures.ts) and
 * entered by "Descend to your camp". Screenshots go to output/liquids-fishing/
 * when FISH_SHOTS is set (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, canvas, focusWorld, messageLine, openPlay, seed, walk, walkTo } from './play-helpers';
import { CELL, DelveFixture } from './play-delve-fixtures';
import { CATCHES } from '../src/app/shared/fishing/fishing.model';

const SHOTS = process.env['FISH_SHOTS'];
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/liquids-fishing/${name}.png` });
}

/**
 * A dry shore west of the Mere: cols 15-18 opened to the cavern's height over
 * a floor at row 35, a two-cell sill at col 19 holding the lake back, the camp at col 16.
 */
export function mereShore(): DelveFixture {
  const f = new DelveFixture().carve(15, 18, 30, 34).carve(19, 19, 30, 32).floor(15, 19, 35);
  f.set(19, 33, 'bedrock').set(19, 34, 'bedrock');
  return f.camp(15, 34);
}

async function descend(page: Page): Promise<void> {
  await openPlay(page);
  await walkTo(page, 590, 30);
  const button = page.getByRole('button', { name: /Descend to your camp/ });
  await expect(button).toBeVisible();
  await button.click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await page.waitForTimeout(1800);
  await focusWorld(page);
}

const NAMES = new Map(CATCHES.map(c => [c.id, c.name]));

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`Fishing (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });

    test('find the Mere, cast, hook the dip, reel it in, and see the catch in the satchel and the Catalogue', async ({ page }) => {
      test.setTimeout(150_000);
      await seed(page, { ...mereShore().blobs() });
      await descend(page);
      // Off the camp (E there opens the bench) to the sill, facing the lake.
      await walk(page, 'd', 18 * CELL + 12, 10000);
      // The Worn Rod is handed over on arrival; the prompt offers to fish.
      await expect(canvas(page)).toHaveAttribute('data-fishing', 'can:water', { timeout: 8000 });
      const fish = page.locator('.prompt .fish-go');
      await expect(fish).toBeVisible();
      await shot(page, `${label}-shore`);
      // Cast.
      if (!touch) { await focusWorld(page); await page.keyboard.press('KeyE'); }
      else { await fish.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 3, isPrimary: true, button: 0 }); await fish.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 3, isPrimary: true, button: 0 }); }
      await expect(canvas(page)).toHaveAttribute('data-fishing', 'wait');
      await expect(messageLine(page)).toContainText('The line is in');
      await shot(page, `${label}-cast`);
      // The dip comes in 3-9 s; hook it inside its 0.6 s window (a miss only nibbles again).
      await expect(canvas(page)).toHaveAttribute('data-fishing', 'bite', { timeout: 15000 });
      if (!touch) await page.keyboard.press('KeyE');
      else { await fish.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 3, isPrimary: true, button: 0 }); await fish.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 3, isPrimary: true, button: 0 }); }
      const reel = page.locator('app-line-tension');
      // A missed dip (a slow frame) nibbles again: hook the next one.
      for (let tries = 0; tries < 3 && !(await reel.isVisible()); tries++) {
        await expect(canvas(page)).toHaveAttribute('data-fishing', 'bite', { timeout: 15000 });
        if (!touch) await page.keyboard.press('KeyE');
        else { await fish.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 3, isPrimary: true, button: 0 }); await fish.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 3, isPrimary: true, button: 0 }); }
      }
      await expect(reel).toBeVisible();
      await expect(canvas(page)).toHaveAttribute('data-fishing', 'hooked');
      // Play the reel: hold a while, let go, hold again.
      const hold = reel.locator('.lt__go');
      if (!touch) {
        await page.keyboard.down('Space'); await page.waitForTimeout(500); await shot(page, `${label}-reel`);
        await page.keyboard.up('Space'); await page.waitForTimeout(400); await page.keyboard.down('Space'); await page.waitForTimeout(600); await page.keyboard.up('Space');
      } else {
        await hold.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 4, isPrimary: true, button: 0 });
        await page.waitForTimeout(500); await shot(page, `${label}-reel`);
        await hold.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 4, isPrimary: true, button: 0 });
      }
      // Always landed once hooked: the reel closes and the catch is named.
      await expect(reel).toBeHidden({ timeout: 10000 });
      const caught = await canvas(page).getAttribute('data-last-catch');
      expect(caught && NAMES.has(caught), `a catch from the tables (${caught})`).toBeTruthy();
      await expect(page.locator('.loot-toast').filter({ hasText: NAMES.get(caught!)! }).first()).toBeVisible();
      // The fishing ledger counts it (the Catalogue reads it), and the satchel holds it.
      await expect.poll(async () => (await blob<{ caught: Record<string, number> }>(page, 'godforge-fishing'))?.caught?.[caught!] ?? 0).toBeGreaterThan(0);
      const fishXp = await page.evaluate(() => {
        const raw = localStorage.getItem('godforge-activity');
        return raw ? (JSON.parse(raw).progress?.xpByDiscipline?.fishing ?? 0) : 0;
      });
      expect(fishXp, 'Fishing XP paid').toBeGreaterThan(0);
      const inv = await page.evaluate(() => localStorage.getItem('godforge-inventory') ?? '');
      expect(inv).toContain(caught!);
      await shot(page, `${label}-landed`);

      // The Codex: the Catalogue of Strange Fish names it.
      await page.goto('/codex');
      await page.locator('.tabs .tab', { hasText: 'Lore' }).first().click();
      await expect(page.getByText('Catalogue of Strange Fish').first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: new RegExp(`${NAMES.get(caught!)!} Catalogue of Strange Fish`) }).first()).toBeVisible();
      await shot(page, `${label}-catalogue`);
    });
  });
}
