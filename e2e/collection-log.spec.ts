/**
 * collection-log.spec.ts — the Collection Log, against the built bundle.
 *
 * Two things a unit test cannot reach and this can:
 *
 *   • The panel is server-rendered as a complete, fully-locked catalogue. The
 *     component builds its cards from pure data at construction precisely so
 *     that the prerendered HTML is correct rather than empty, and the only way
 *     to prove that is to read the HTML a crawler would get.
 *   • A locked card must not name itself. The whole point of the log is that
 *     what you have *not* found is a silhouette, and a name leaking into the
 *     DOM behind `???` — through a title attribute, an alt, or a search that
 *     matches it — turns the log into a checklist.
 */
import { test, expect, Page } from '@playwright/test';

const CONSENT_KEY = 'xsantcastx_consent';
const COLLECTION_KEY = 'godforge-collection';

/** A log with three things in it and everything else dark. */
const SEEDED = JSON.stringify({
  version: 1,
  rewards: [],
  backfilled: true,
  entries: {
    ash: { firstDiscoveredAt: 1_770_000_000_000, count: 12 },
    'cinder-ore': { firstDiscoveredAt: 1_770_100_000_000, count: 340 },
    'first-light': { firstDiscoveredAt: 1_770_200_000_000, count: 1 },
  },
});

async function openLog(page: Page, seeded = false): Promise<void> {
  await page.addInitScript(
    (state) => {
      for (const [key, value] of Object.entries(state as Record<string, string>)) {
        window.localStorage.setItem(key, value);
      }
      window.sessionStorage.setItem('visit-counted', '1');
    },
    seeded
      ? { [CONSENT_KEY]: 'denied', [COLLECTION_KEY]: SEEDED }
      : { [CONSENT_KEY]: 'denied' },
  );
  await page.goto('/codex?tab=collection', { waitUntil: 'load' });
  await page.locator('app-collection-log').waitFor();
}

test.describe('Collection Log', () => {
  test('prerenders the whole catalogue, locked, before any script runs', async ({ page }) => {
    // JS off: what is on screen is exactly what the server sent.
    const html = await (await page.request.get('/codex?tab=collection')).text();
    expect(html).toContain('app-collection-log');
    expect(html).toContain('The Collection Log');
    // Every card is on the page and every one of them is dark. The class match
    // is anchored on the delimiter: `cl-card__art`, `cl-card__badge` and six
    // more element classes all start with the block name, and a loose match
    // counts each card eight times and then compares that to itself.
    const cards = (html.match(/class="cl-card[ "]/g) ?? []).length;
    expect(cards).toBeGreaterThan(60);
    // Anchored on `class="` for the same reason, plus one more: Angular inlines
    // the component's stylesheet into the SSR HTML, and the CSS names this
    // modifier six times.
    const locked = (html.match(/class="[^"]*cl-card--locked/g) ?? []).length;
    expect(locked).toBe(cards);
    expect(html).toContain('???');
  });

  test('shows what has been found, and only that', async ({ page }) => {
    await openLog(page, true);

    await expect(page.locator('.cl-dial__count')).toHaveText('3 / 68');
    await expect(page.locator('.cl-card:not(.cl-card--locked)')).toHaveCount(3);

    const ash = page.locator('.cl-card', { hasText: 'Ash' }).first();
    await expect(ash.locator('.cl-card__name')).toHaveText('Ash');
    await expect(ash.locator('.cl-card__count')).toHaveText('×12');
  });

  test('never leaks the name of something still missing', async ({ page }) => {
    await openLog(page);

    // The Godstone is a Mythic rune nobody has found here. Nothing in the DOM
    // may say so — not the card, not a title, not an alt.
    await expect(page.locator('.cl').getByText('Godstone', { exact: false })).toHaveCount(0);
    await expect(page.locator('.cl [title*="Godstone" i]')).toHaveCount(0);
    await expect(page.locator('.cl img[alt*="Godstone" i]')).toHaveCount(0);

    // ...and searching for it finds nothing, rather than confirming it exists.
    await page.locator('#cl-search').fill('godstone');
    await expect(page.locator('.cl-empty')).toBeVisible();
  });

  test('names what the world cannot yet grant instead of hiding it', async ({ page }) => {
    await openLog(page);
    const absent = page.locator('.cl-card--absent');
    await expect(absent.first()).toBeVisible();
    await expect(absent.first()).toContainText('not yet in the world');
    // ...and says so under the grid, so the denominator is not a mystery.
    await expect(page.locator('.cl-foot')).toContainText('68 entries count toward completion');
  });

  test('filters down to one category and back', async ({ page }) => {
    await openLog(page, true);
    const total = await page.locator('.cl-card').count();

    await page.locator('.cl-bar', { hasText: 'Runewords' }).click();
    await expect(page.locator('.cl-card')).toHaveCount(6);
    await expect(page.locator('.cl-section')).toHaveCount(1);

    await page.locator('.cl-bar', { hasText: 'Runewords' }).click();
    await expect(page.locator('.cl-card')).toHaveCount(total);
  });
});
