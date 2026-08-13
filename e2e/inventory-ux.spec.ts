/**
 * inventory-ux.spec.ts — the Vault on /forge-keeper.
 *
 * The hover test is the reason this file exists. The bug it guards was a
 * geometry problem rather than a wrong value: the card lifted 2px on `:hover`,
 * and hit testing follows a transform, so entering the bottom two pixels of a
 * card lifted it out from under the cursor that had just entered it. Measured
 * against the old rule, the card fires `mouseenter` then `mouseleave` and comes
 * to rest lifted-but-unhovered — and a hand, unlike a test, keeps emitting
 * mousemove, which re-runs the hit test and re-enters the loop over and over.
 * That is the flicker.
 *
 * Nothing in the DOM is wrong at any instant, so only a real cursor against a
 * real compositor catches it — which is why this is a Playwright spec and not a
 * unit test. Two details are load-bearing, and both were arrived at by watching
 * this test pass against the bug first: the cursor must enter the band at the
 * bottom of the card *at rest* (a box measured while already hovered puts the
 * cursor somewhere safe in both states), and the page must have finished
 * scrolling before any coordinate is read (see `hoverSettled`).
 *
 * The seeded ledger below is a plain localStorage blob in the shape
 * `EconomyService.load()` reads. Driving the UI to earn the same state would
 * take thousands of clicks through the Forge Flame.
 */
import { test, expect, Locator, Page } from '@playwright/test';

const ECONOMY_KEY = 'godforge-economy';
const EGGS_FOUND_KEY = 'easter-eggs-found';
const CONSENT_KEY = 'xsantcastx_consent';

/**
 * Arriving on /forge-keeper awards the `forge-self-aware` achievement, and its
 * drop toast is a full-viewport overlay that swallows clicks for several
 * seconds. Landing with the egg already found means no award and no toast — the
 * page under test rather than the page's welcome.
 */
const SETTLED_FIRST_VISIT = ['forge-self-aware'];

/** A ledger holding Bellows at 4 and a couple of one-offs. */
const SEEDED_LEDGER = {
  gold: 250_000,
  essence: 900,
  upgrades: { 'forge-bellows': 4, 'ember-stoker': 2, 'iron-hammer': 1 },
  artifacts: [] as string[],
  cosmetics: [] as string[],
  equipped: {} as Record<string, string>,
  enchantments: [] as unknown[],
};

async function openVault(page: Page, seed = true): Promise<void> {
  await page.addInitScript(
    (state) => {
      for (const [key, value] of Object.entries(state as Record<string, string>)) {
        window.localStorage.setItem(key, value);
      }
      // The site-visit counter fires a full-viewport milestone flourish on the
      // first page view of a session, and a fresh browser profile is always a
      // first view. `recordVisit()` returns early when the session has already
      // been counted, so arriving as a second page view is what stops it —
      // deterministically, and without a network round trip to decide.
      window.sessionStorage.setItem('visit-counted', '1');
    },
    {
      [CONSENT_KEY]: 'denied',
      [EGGS_FOUND_KEY]: JSON.stringify(SETTLED_FIRST_VISIT),
      ...(seed ? { [ECONOMY_KEY]: JSON.stringify(SEEDED_LEDGER) } : {}),
    },
  );
  await page.goto('/forge-keeper');
  await page.locator('.fk-inv__card').first().waitFor();
  // The shelf is prerendered empty and refilled after hydration; waiting for a
  // card is not the same as waiting for the ledger to have landed on it.
  await expect(page.locator('.fk-inv__result')).toContainText('entries');
}

/**
 * Hover the card, and keep hovering until it actually stays hovered.
 *
 * Scrolling this far down the page settles a beat *after* the hover lands:
 * lazy images above the vault finish and the scroll anchor jumps, in one case
 * by 524px. The cursor does not move with it, so a single `hover()` ends up
 * parked over whatever slid into that screen position — which looks exactly
 * like the bug under test and is not it. Re-hovering until the box has stopped
 * moving *and* the card reports itself hovered is the difference between
 * testing this page and testing its scroll anchor.
 */
async function hoverSettled(page: Page, card: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  let previous = Number.NaN;
  for (let attempt = 0; attempt < 12; attempt++) {
    await card.hover();
    await page.waitForTimeout(250);
    const box = (await card.boundingBox())!;
    const held = await card.evaluate((el: HTMLElement) => el.matches(':hover'));
    if (held && Math.abs(box.y - previous) < 0.5) return box;
    previous = box.y;
  }
  throw new Error('the card never settled under the cursor');
}

test.describe('Forge Keeper — the Vault', () => {
  test('hovering a card never drops its own hover state', async ({ page }) => {
    await openVault(page, false);

    const card = page.locator('.fk-inv__card').nth(6);
    const settled = await hoverSettled(page, card);

    // Step off the card and let it come to rest. The measurement has to be of
    // the *resting* box: the bottom two pixels of a card at rest are the band
    // the lift used to move out from under the cursor, and a box measured while
    // already lifted puts the cursor somewhere safe in both states — which is
    // how this test passed against the bug on the first attempt.
    await page.mouse.move(settled.x + settled.width / 2, settled.y - 40);
    await page.waitForTimeout(400);
    const rest = (await card.boundingBox())!;

    await card.evaluate((el: HTMLElement) => {
      const w = window as unknown as { __flips: number };
      w.__flips = 0;
      el.addEventListener('mouseenter', () => w.__flips++);
      el.addEventListener('mouseleave', () => w.__flips++);
    });

    // Enter the bottom-most pixel and hold still.
    await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height - 1);
    await page.waitForTimeout(900);

    const [flips, hovered] = await card.evaluate((el: HTMLElement) => [
      (window as unknown as { __flips: number }).__flips,
      el.matches(':hover'),
    ]);

    // One crossing — inward — and the cursor is still on the card it entered.
    // Against the old rule this is 2 and false: the card lifted, the cursor was
    // left underneath it, and the hover that caused the lift was dropped.
    expect(flips).toBe(1);
    expect(hovered).toBe(true);
  });

  test('the card box holds still while its face lifts', async ({ page }) => {
    await openVault(page, false);

    const card = page.locator('.fk-inv__card').nth(6);
    await hoverSettled(page, card);

    // Wait for the lift to arrive rather than for a fixed number of
    // milliseconds — a read timed against a .15s transition is a coin toss the
    // suite loses a few runs in ten.
    await expect
      .poll(() => card.locator('.fk-inv__face').evaluate(
        (el: HTMLElement) => Math.round(new DOMMatrix(getComputedStyle(el).transform).m42)))
      .toBe(-2);

    // Every reading below is taken in one instant, against the card's own
    // unhovered row-mate. Comparing a before shot to an after shot would be
    // measuring the page's scroll as much as the card's hover.
    const geometry = await card.evaluate((el: HTMLElement) => {
      const face = el.querySelector('.fk-inv__face') as HTMLElement;
      const row = Array.from(el.parentElement!.children) as HTMLElement[];
      // A card on the same grid row, so its top is what this card's top would
      // be if hovering moved it.
      const mate = row.find(c => c !== el
        && Math.abs(c.getBoundingClientRect().top - el.getBoundingClientRect().top) < 40);
      return {
        lift: new DOMMatrix(getComputedStyle(face).transform).m42,
        faceMinusCard: face.getBoundingClientRect().top - el.getBoundingClientRect().top,
        cardMinusMate: mate ? el.getBoundingClientRect().top - mate.getBoundingClientRect().top : null,
      };
    });

    // The art moved — otherwise this would pass on a card with no hover effect
    // at all.
    expect(geometry.lift).toBeCloseTo(-2, 1);
    // ...and it moved out of the card rather than taking the card with it.
    expect(geometry.faceMinusCard).toBeCloseTo(-2, 1);
    // The card itself is still level with the neighbour it shares a row with.
    expect(geometry.cardMinusMate).not.toBeNull();
    expect(geometry.cardMinusMate!).toBeCloseTo(0, 1);
  });

  test('the tooltip cannot take the cursor', async ({ page }) => {
    await openVault(page, false);

    const card = page.locator('.fk-inv__card').nth(6);
    await hoverSettled(page, card);

    const tip = card.locator('.fk-inv__tip');
    await expect(tip).toHaveCSS('opacity', '1');
    await expect(tip).toHaveCSS('pointer-events', 'none');
  });

  test('levels stack into one card with a count badge', async ({ page }) => {
    await openVault(page);

    const bellows = page.locator('.fk-inv__card', { hasText: 'Forge Bellows' }).first();
    await bellows.scrollIntoViewIfNeeded();
    await expect(bellows.locator('.fk-inv__count')).toHaveText('×4');

    // Opening the stack lists what the badge counted.
    await bellows.locator('.fk-inv__expand').click();
    await expect(bellows.locator('.fk-inv__unit')).toHaveCount(4);
    await expect(bellows.locator('.fk-inv__unit-label').first()).toHaveText('Level 1');

    // Something held once gets no badge — the badge means "more than one".
    const hammer = page.locator('.fk-inv__card', { hasText: 'Iron Hammer' }).first();
    await expect(hammer.locator('.fk-inv__count')).toHaveCount(0);
  });

  test('tier chips, search and sort narrow the shelf', async ({ page }) => {
    await openVault(page);

    const cards = page.locator('.fk-inv__card');
    const all = await cards.count();
    expect(all).toBeGreaterThan(10);

    // Tier.
    await page.locator('.fk-inv__tier-chip', { hasText: 'Mythic' }).first().click();
    const mythic = await cards.count();
    expect(mythic).toBeLessThan(all);
    for (const label of await page.locator('.fk-inv__tier').allTextContents()) {
      expect(label.trim()).toContain('Mythic');
    }

    // Clearing puts everything back.
    await page.locator('.fk-inv__clear').first().click();
    expect(await cards.count()).toBe(all);

    // Search.
    await page.locator('.fk-inv__search-input').fill('bellows');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Bellows');

    // A search that matches nothing says so rather than showing an empty grid.
    await page.locator('.fk-inv__search-input').fill('zzzzz-no-such-thing');
    await expect(cards).toHaveCount(0);
    await expect(page.locator('.fk-inv__empty')).toBeVisible();

    await page.locator('.fk-inv__empty .fk-inv__clear').click();
    expect(await cards.count()).toBe(all);

    // Sort: A to Z really is A to Z.
    await page.locator('.fk-inv__sort-select').selectOption('name');
    const names = (await page.locator('.fk-inv__name').allTextContents())
      .map(n => n.trim().split('\n')[0].trim());
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    // Sort: rarest first never puts a lower tier above a higher one.
    await page.locator('.fk-inv__sort-select').selectOption('rarity');
    const ladder = ['Mortal', 'Eclipsed', 'Sacred', 'Anomalous', 'Mythic', 'Singular'];
    const weights = (await page.locator('.fk-inv__tier').allTextContents())
      .map(t => ladder.findIndex(r => t.includes(r)));
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  test('the shelf tabs still filter by kind', async ({ page }) => {
    await openVault(page);

    await page.locator('.fk-inv__tab', { hasText: 'Artifacts' }).click();
    const kinds = await page.locator('.fk-inv__card').evaluateAll(
      (els: HTMLElement[]) => els.map(e => e.dataset['kind']));
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set(['artifact']));
  });
});
