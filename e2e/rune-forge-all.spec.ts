/**
 * rune-forge-all.spec.ts — ALL means all.
 *
 * The button offered "spend what you can afford" and was then clamped to a
 * thousand strikes, so on a purse holding forty thousand strikes' worth it
 * spent two and a half percent of it and stopped. This pins the contract:
 * whatever the purse holds, ALL offers it and ALL spends it.
 *
 * The purse here is deliberately small. A strike does real work — it mints an
 * item into a capped bag, rolls a scroll, records the collection, awards XP
 * and checks achievements — which measures at roughly 2ms, so a forty-thousand
 * strike run is minutes of honest work and no kind of test. Four hundred
 * strikes proves the same contract in a couple of seconds, and the arithmetic
 * that used to be wrong is not sensitive to the size of the number.
 */
import { expect, test, type Page } from '@playwright/test';

const ECONOMY_KEY = 'godforge-economy';
const STRIKE_COST = 10_000;

async function openForge(page: Page, strikes: number): Promise<void> {
  await page.addInitScript(
    ({ key, gold }) => {
      window.localStorage.setItem('xsantcastx_consent', 'denied');
      window.sessionStorage.setItem('visit-counted', '1');
      window.localStorage.setItem(key, JSON.stringify({ version: 2, gold }));
    },
    { key: ECONOMY_KEY, gold: STRIKE_COST * strikes },
  );
  await page.goto('/forge/runes', { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const l = document.querySelector('.gf-loader');
    return !l || getComputedStyle(l).opacity === '0' || l.classList.contains('gf-loader--hidden');
  }, { timeout: 8000 });
}

/** Gold as the ledger holds it, not as the header rounds it for display. */
function goldNow(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw).gold as number) : -1;
  }, ECONOMY_KEY);
}

test.describe('the ALL button', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('offers every strike the purse covers, not a capped thousand', async ({ page }) => {
    // 4,000 strikes' worth — four times the old cap, so a clamp would show.
    await openForge(page, 4_000);
    await page.getByRole('button', { name: /Roll new rune/ }).click();
    const all = page.locator('.rf-acts__btn').filter({ hasText: /ALL/i }).first();
    // Four thousand strikes' worth, compacted the way the rest of the game
    // renders large numbers. The old cap would have shown ×1000 here whatever
    // the purse held, which is the whole bug.
    await expect(all).toContainText('4K');
  });

  test('drains the purse when it runs', async ({ page }) => {
    test.setTimeout(120_000);
    await openForge(page, 400);
    await page.getByRole('button', { name: /Roll new rune/ }).click();

    // A range, not an equality: Gold accrues on an idle timer while the page
    // is open, so the purse is never exactly the seeded figure by the time the
    // first strike has resolved.
    const before = await goldNow(page);
    expect(before).toBeGreaterThanOrEqual(STRIKE_COST * 399);
    expect(before).toBeLessThan(STRIKE_COST * 400);

    await page.locator('.rf-acts__btn').filter({ hasText: /ALL/i }).first().click();
    await expect(page.locator('.rf-acts__btn--again')).toBeVisible({ timeout: 110_000 });

    // Everything the purse could pay for is spent — less than one more strike
    // is left, which is the definition of drained.
    const after = await goldNow(page);
    expect(after).toBeLessThan(STRIKE_COST);
    expect(after).toBeGreaterThanOrEqual(0);

    // And the run reports every strike it made, not a capped subset.
    await expect(page.locator('.rf-pick__prompt')).toContainText('399');
  });

  test('past the grid cap it draws one card, however long the run was', async ({ page }) => {
    // The reveal must not try to paint four hundred thumbnails — and the run
    // must not have kept four hundred finds in order to offer them.
    await openForge(page, 400);
    await page.getByRole('button', { name: /Roll new rune/ }).click();
    await page.locator('.rf-acts__btn').filter({ hasText: /ALL/i }).first().click();
    await expect(page.locator('.rf-acts__btn--again')).toBeVisible({ timeout: 110_000 });

    await expect(page.locator('.rf-pick__card')).toHaveCount(1);
    await expect(page.locator('.rf-pick__card').first()).toHaveClass(/is-best/);
    // The tally is what stands in for the cards, and it must add up.
    const counts = await page.locator('.rf-pick__tally-row, .rf-pick__tally li').allTextContents();
    expect(counts.length).toBeGreaterThan(0);
  });

  test('Stop banks what landed and leaves the rest of the purse alone', async ({ page }) => {
    await openForge(page, 4_000);
    await page.getByRole('button', { name: /Roll new rune/ }).click();
    await page.locator('.rf-acts__btn').filter({ hasText: /ALL/i }).first().click();

    await page.locator('.rf-acts__btn--stop').click({ timeout: 10_000 });
    await expect(page.locator('.rf-acts__btn--again')).toBeVisible({ timeout: 30_000 });

    // A stopped run keeps the Gold it did not spend. The bug this guards is a
    // Stop that charges for the whole run it was going to make.
    const left = await goldNow(page);
    expect(left).toBeGreaterThan(STRIKE_COST);
    expect(left).toBeLessThan(STRIKE_COST * 4_000);
  });
});
