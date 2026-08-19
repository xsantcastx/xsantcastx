/**
 * forge-reveal.spec.ts — the anvil answers in one move.
 *
 * The Forge used to deal a hand of ten face-down cards and ask you to pick
 * one. The ledger had already written the rune before a card was dealt, so the
 * choice decided nothing and the only thing it cost was the wait. This guards
 * the removal: one card, face up, on the same click that pays the Gold — and
 * the reveal animation, which was the part that was real, still runs.
 */
import { expect, test, type Page } from '@playwright/test';

const ECONOMY_KEY = 'godforge-economy';

async function openForge(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, blob }) => {
      window.localStorage.setItem('xsantcastx_consent', 'denied');
      window.sessionStorage.setItem('visit-counted', '1');
      // Merged over a fresh ledger on read, so gold alone is a valid seed.
      window.localStorage.setItem(key, blob);
    },
    { key: ECONOMY_KEY, blob: JSON.stringify({ version: 2, gold: 500_000 }) },
  );
  await page.goto('/forge/runes', { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden')
      || style.visibility === 'hidden'
      || style.opacity === '0';
  }, { timeout: 8000 });
}

test.describe('Rune Forge reveal', () => {
  test('a strike turns up one card, face up, with no hand to pick from', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openForge(page);

    const strike = page.getByRole('button', { name: /Roll new rune/ });
    await expect(strike).toBeEnabled();
    await strike.click();

    const focus = page.locator('.rf-focus');
    await expect(focus).toBeVisible();
    // One card. Not ten backs, and nothing to click before the rune is legible.
    await expect(page.locator('.rf-pick__card')).toHaveCount(1);
    await expect(page.locator('.rf-pick__card.is-chosen')).toHaveCount(1);
    await expect(page.locator('.rf-pick__skip')).toHaveCount(0);
    // Landed on the same tick, so the name, the tier and the way out are all up.
    await expect(page.locator('.rf-pick')).toHaveClass(/rf-pick--landed/);
    await expect(page.locator('.rf-pick__tier')).toBeVisible();
    await expect(page.locator('.rf-pick__done')).toBeVisible();
    // The juice survived the cut: the shards are drawn and the card animates in.
    await expect(page.locator('.rf-pick__card.is-chosen .rf-sparks--reveal')).toHaveCount(1);
    await expect
      .poll(async () => page.locator('.rf-pick__card.is-chosen')
        .evaluate(el => getComputedStyle(el).animationName))
      .not.toBe('none');

    await page.locator('.rf-pick__done').click();
    await expect(focus).toHaveCount(0);
  });

  test('reduced motion lands the same card without animating it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openForge(page);

    await page.getByRole('button', { name: /Roll new rune/ }).click();
    await expect(page.locator('.rf-pick__card.is-chosen')).toHaveCount(1);
    await expect(page.locator('.rf-pick__tier')).toBeVisible();
    await expect
      .poll(async () => page.locator('.rf-pick__card.is-chosen')
        .evaluate(el => getComputedStyle(el).animationName))
      .toBe('none');
  });
});
