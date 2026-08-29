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
  // Deliberately no readiness wait here — see the retry in the filter test.
  //
  // `app-collection-log` is in the prerendered HTML, so waiting for it proves
  // the server responded and nothing more. Every spec in this file that only
  // *reads* the page is fine with that; the one that clicks a filter is not,
  // because a click can land before Angular has attached the handler. It is
  // reported as a completed click — the element really was there, visible and
  // enabled — nothing happens, and the assertion then reads the unfiltered grid
  // and blames the filter for showing 255 cards instead of 6.
  //
  // Waiting for the boot loader to dismiss was tried here and is NOT a fix.
  // Measured in WebKit across runs of the same build: the loader hid at 2557ms
  // while the first effective click was at 236ms, and in the next run the
  // loader hid at 2675ms and the first effective click was at 2817ms. The two
  // are not ordered, so no single wait on the loader can gate on
  // interactivity — in one direction it wastes two and a half seconds, in the
  // other it returns 140ms too early and the click is still lost.
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

    await expect(page.locator('.cl-dial__count')).toHaveText('3 / 253');
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

  /*
   * This used to assert that at least one card was `--absent`, because thirteen
   * equipment pieces were flagged unobtainable. They were not: the Gambler's
   * pool had been minting them for releases, and the flag was stale. Now that
   * `obtainable` is worked out from what can actually drop, nothing in the
   * catalogue is absent — the Gambler reaches every equipment and charm
   * definition, expeditions reach every material, and the two Collector rewards
   * are the only entries held out of the denominator.
   *
   * So the assertion is the rule rather than the sighting: an absent card, if
   * one ever appears again, has to say why it is dark instead of just being
   * dark. The foot's number is the part that fails today if the denominator
   * moves without anyone noticing.
   */
  test('names what the world cannot yet grant instead of hiding it', async ({ page }) => {
    await openLog(page);
    const absent = page.locator('.cl-card--absent');
    for (let i = 0; i < await absent.count(); i++) {
      await expect(absent.nth(i)).toContainText('not yet in the world');
    }
    // ...and says so under the grid, so the denominator is not a mystery. The
    // number moved from 201 to 253 when the crafting bench added its fifty-two
    // recipes as their own category: a recipe is a thing you can know, so it is
    // counted like everything else the log tracks.
    await expect(page.locator('.cl-foot')).toContainText('253 entries count toward completion');
  });

  test('filters down to one category and back', async ({ page }) => {
    await openLog(page, true);
    const total = await page.locator('.cl-card').count();

    const runewords = page.locator('.cl-bar', { hasText: 'Runewords' });

    // Retry the *first* interaction until it takes, rather than waiting on a
    // proxy for hydration that does not order reliably against it (see
    // openLog). This is not a sleep and not a loosened assertion: it clicks
    // only while the filter is off, so a click that was swallowed pre-hydration
    // is re-sent and one that landed is never toggled back off, and the
    // assertion it must satisfy is still exactly "six cards".
    await expect(async () => {
      const on = (await runewords.getAttribute('class'))?.includes('is-on');
      if (!on) await runewords.click();
      await expect(page.locator('.cl-card')).toHaveCount(6, { timeout: 750 });
    }).toPass({ timeout: 20_000 });
    await expect(page.locator('.cl-section')).toHaveCount(1);

    // By here the page is demonstrably live, so the way back needs no retry.
    await runewords.click();
    await expect(page.locator('.cl-card')).toHaveCount(total);
  });
});
