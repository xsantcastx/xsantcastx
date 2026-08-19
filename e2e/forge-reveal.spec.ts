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
    { key: ECONOMY_KEY, blob: JSON.stringify({ version: 2, gold: 400_000_000 }) },
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

  test('the loop is pull, read, pull — no dismissing between rolls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openForge(page);

    await page.getByRole('button', { name: /Roll new rune/ }).click();
    const focus = page.locator('.rf-focus');
    await expect(focus).toBeVisible();

    // Roll again lives on the result, and the result never leaves the screen.
    const again = page.locator('.rf-acts__btn--again');
    await expect(again).toBeVisible();
    await again.click();
    await expect(focus).toBeVisible();
    await expect(page.locator('.rf-pick__card')).toHaveCount(1);
    // Second pull of the sitting: the ceremony is cut short.
    await expect(page.locator('.rf-pick')).toHaveClass(/rf-pick--rapid/);

    // A bulk run reports a tally rather than a wall of thumbnails.
    await page.locator('.rf-acts__btn', { hasText: '×10' }).first().click();
    await expect(again).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.rf-pick__tally-row').first()).toBeVisible();
    await expect(page.locator('.rf-pick__card')).toHaveCount(10);

    // A hundred is past the grid cap, so only the best find is drawn.
    await page.locator('.rf-acts__btn', { hasText: '×100' }).first().click();
    await expect(again).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.rf-pick__card')).toHaveCount(1);
    await expect(page.locator('.rf-pick__card.is-best')).toHaveCount(1);
    await expect(page.locator('.rf-pick__tally-row').first()).toBeVisible();

    // And the way out is still one click.
    await page.locator('.rf-pick__done').click();
    await expect(focus).toHaveCount(0);
  });

  test('a bulk run reports progress and can be stopped part-way', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openForge(page);
    await page.getByRole('button', { name: /Roll new rune/ }).click();
    await expect(page.locator('.rf-acts__btn--again')).toBeVisible();

    await page.locator('.rf-acts__btn', { hasText: '×1K' }).first().click();
    // The run yields the frame between chunks, so Stop is reachable while it
    // is still striking — that is the whole point of chunking it.
    const stop = page.locator('.rf-acts__btn--stop');
    await stop.click();
    await expect(page.locator('.rf-acts__btn--again')).toBeVisible({ timeout: 30000 });
    // Whatever landed before the stop is banked, and it is fewer than the run
    // asked for.
    const prompt = await page.locator('.rf-pick__prompt').textContent();
    const struck = Number(/(\d+)/.exec(prompt ?? '')?.[1] ?? '0');
    expect(struck).toBeGreaterThan(0);
    expect(struck).toBeLessThan(1000);
  });

  test('every roll button is reachable on a 375px phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openForge(page);
    await page.getByRole('button', { name: /Roll new rune/ }).click();
    // A ten-card grid is the tallest the reveal gets before the summary takes
    // over, so it is the worst case for the row underneath it.
    await page.locator('.rf-acts__btn', { hasText: '×10' }).first().click();
    await expect(page.locator('.rf-acts__btn--again')).toBeVisible({ timeout: 30000 });
    // The celebration is a separate fixed layer and dismisses itself; it is
    // not what this test is about.
    const cine = page.locator('.ad--cine');
    if (await cine.count()) await cine.click({ timeout: 3000 }).catch(() => {});
    await expect(page.locator('.ad-veil--on')).toHaveCount(0, { timeout: 15000 });

    // The row is sticky inside the reveal's own scroller, so every control is
    // on screen without scrolling — and nothing fixed is sitting on top of it.
    // Both have bitten here before: the Forge Flame is z-index 940 with
    // clickable children, and .rf-focus cannot out-rank it because the routed
    // host's transform traps it.
    const report = await page.evaluate(() => {
      const tabs = document.querySelector('.gftabs')?.getBoundingClientRect();
      return [...document.querySelectorAll('.rf-acts__btn, .rf-acts .rf-pick__done')].map(node => {
        const r = node.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        const label = (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
        if (r.bottom > (tabs?.top ?? window.innerHeight)) return `${label}: behind the tab bar`;
        if (!hit?.closest('.rf-acts')) return `${label}: covered by ${hit?.tagName}.${(hit as HTMLElement)?.className}`;
        return `${label}: ok`;
      });
    });
    expect(report.every(line => line.endsWith(': ok')), report.join(' | ')).toBe(true);
    expect(report.length).toBeGreaterThanOrEqual(6);
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
