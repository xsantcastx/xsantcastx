/**
 * play-world-feel.spec.ts — the sound of the world and catch & craft
 * (docs/handoff/world-feel.md), played at 1280×800 with keys and at 390×844 with touch:
 *
 *   - Menu → Sound: the three sliders and the mute are saved (godforge-sound) and come back after a reload
 *   - the Grotto Mere shows fish under its surface ("when fishing, where are the fish?")
 *   - a craft at the bench flies the made thing to the Satchel, says so, and Open shows it there
 *     ("when crafting, where do the items go?")
 *
 * Screenshots go to output/world-feel/ when FEEL_SHOTS is set (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, canvas, focusWorld, openPlay, placePanel, purse, seed, walk, walkTo, openMenu } from './play-helpers';
import { CELL, DelveFixture } from './play-delve-fixtures';

const SHOTS = process.env['FEEL_SHOTS'];
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `output/world-feel/${name}.png` });
}

/** A dry shore west of the Mere (as play-fishing.spec.ts): the camp at col 16, the lake past the sill at col 19. */
function mereShore(): DelveFixture {
  const f = new DelveFixture().carve(15, 18, 30, 34).carve(19, 19, 30, 32).floor(15, 19, 35);
  f.set(19, 33, 'bedrock').set(19, 34, 'bedrock');
  return f.camp(15, 34);
}

async function openSound(page: Page): Promise<void> {
  await page.locator('.places-toggle').click();
  await openMenu(page);
  await page.locator('#game-menu [data-open="sound"]').click();
  await expect(page.locator('app-sound-sheet .ss')).toBeVisible();
}

async function setSlider(page: Page, channel: string, value: number): Promise<void> {
  await page.locator(`app-sound-sheet input[data-channel="${channel}"]`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

const exactName = (name: string) => new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`);

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`World feel (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
    });

    test('Menu → Sound: the sliders and the mute are saved and come back after a reload', async ({ page }) => {
      test.setTimeout(90_000);
      await seed(page);
      await openPlay(page);
      await openSound(page);
      const sheet = page.locator('app-sound-sheet .ss');
      // First visit is quiet: nothing is above half.
      for (const ch of ['music', 'ambience', 'effects']) {
        expect(Number(await sheet.locator(`input[data-channel="${ch}"]`).inputValue())).toBeLessThanOrEqual(50);
      }
      // A tap in the world started it (the director's chunk loads on the first gesture).
      await expect(sheet).not.toHaveAttribute('data-sound-status', /idle|waiting/, { timeout: 10000 });
      await setSlider(page, 'music', 80);
      await setSlider(page, 'ambience', 10);
      await sheet.locator('[data-sound-mute]').check();
      await expect(sheet.locator('.ss__note')).toHaveText('Muted');
      await shot(page, `${label}-sound-sheet`);
      await expect.poll(() => blob<{ music: number; ambience: number; muted: boolean }>(page, 'godforge-sound')).toMatchObject({ music: .8, ambience: .1, muted: true });

      await page.reload();
      await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
      await openSound(page);
      await expect(sheet.locator('input[data-channel="music"]')).toHaveValue('80');
      await expect(sheet.locator('input[data-channel="ambience"]')).toHaveValue('10');
      await expect(sheet.locator('[data-sound-mute]')).toBeChecked();
      await sheet.locator('.ss__done').click();
      await expect(sheet).toBeHidden();
    });

    test('the Grotto Mere shows fish under its surface', async ({ page }) => {
      test.setTimeout(120_000);
      await seed(page, { ...mereShore().blobs() });
      await openPlay(page);
      await walkTo(page, 590, 30);
      const button = page.getByRole('button', { name: /Descend to your camp/ });
      await expect(button).toBeVisible();
      await button.click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
      await page.waitForTimeout(1500);
      await focusWorld(page);
      await walk(page, 'd', 18 * CELL + 12, 10000);
      await expect.poll(async () => Number(await canvas(page).getAttribute('data-fish-shadows')), { timeout: 10000 }).toBeGreaterThan(0);
      await shot(page, `${label}-mere-fish`);
    });

    test('a craft pops, flies to the Satchel, says so, and Open shows it there', async ({ page }) => {
      test.setTimeout(120_000);
      await seed(page, { ...bag({ 'cinder-ore': 8, 'starlight-herb': 2 }), ...purse(10_000) });
      await openPlay(page, '?at=crafting');
      const panel = placePanel(page);
      await expect(panel.locator('.cb-hero')).toBeVisible({ timeout: 15000 });
      // Watch for the flying icon (it lives ~1.3 s).
      await page.evaluate(() => {
        const w = window as unknown as { craftFly?: string };
        new MutationObserver(records => {
          for (const r of records) for (const n of Array.from(r.addedNodes)) {
            if (n instanceof HTMLElement && n.classList.contains('craft-fly')) w.craftFly = n.getAttribute('data-item') ?? '?';
          }
        }).observe(document.body, { childList: true, subtree: true });
      });
      await panel.getByText('Details', { exact: true }).click();
      await panel.getByPlaceholder('Search recipes and materials').fill('Pickaxe');
      await panel.locator('.cb-card', { hasText: exactName('Pickaxe I') }).first().click();
      await expect(panel.locator('.cb-hero .dh__name')).toHaveText('Pickaxe I');
      await panel.locator('.cb-hero .ab__btn').click();
      const skip = panel.locator('app-anvil-game .mg__skip');
      const reward = panel.locator('app-reward-pop .rp');
      await expect(skip.or(reward)).toBeVisible({ timeout: 15000 });
      if (await skip.isVisible()) await skip.click();
      await expect(reward).toContainText('Pickaxe I', { timeout: 20000 });
      // Where it went: a toast over the bench, and the icon flew to the Satchel.
      const toast = page.locator('.craft-toast');
      await expect(toast).toContainText('Crafted Pickaxe I — in your Satchel');
      await expect.poll(() => page.evaluate(() => (window as unknown as { craftFly?: string }).craftFly ?? '')).not.toBe('');
      await shot(page, `${label}-crafted`);
      const open = toast.getByRole('button', { name: /Open the Satchel/ });
      const box = await open.boundingBox();
      expect(box!.height, 'Open is a 44px target (sub-pixel rounding allowed)').toBeGreaterThanOrEqual(43.5);
      await open.click();
      // The bench closes, the Satchel opens on the pockets, and the pickaxe is there; the clasp pulsed.
      await expect(panel).toBeHidden({ timeout: 5000 });
      const book = page.locator('#satchel-book');
      await expect(book).toBeVisible();
      await expect(book.locator('[aria-label="Pickaxe I"]').first()).toBeVisible();
      await expect(page.locator('.satchel .clasp')).toHaveAttribute('data-pulse', /[1-9]/);
      await shot(page, `${label}-satchel`);
    });
  });
}
