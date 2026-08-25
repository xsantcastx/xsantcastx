/**
 * rune-celebration.spec.ts — what a good drop does to the screen.
 *
 * The tiers this is about cannot be waited for. A Rare is one strike in ten
 * thousand and the Void is one in two million, so a test that struck the anvil
 * until something turned up would either never finish or would assert on
 * whatever it happened to get.
 *
 * So the drop table is made deterministic instead of the celebration being
 * faked: `rollRune` takes its randomness as a parameter defaulting to
 * `Math.random`, and every caller uses the default. Pinning `Math.random` to a
 * chosen point in the table therefore drives the whole real path — the strike,
 * the ledger write, the reveal card, the celebration — with nothing stubbed
 * inside the app and no test-only API on the build.
 *
 * The table's shape is the one thing this couples to. Each helper asserts the
 * tier it actually landed, so a retune fails here with "expected Mythic, got
 * Legendary" rather than silently testing the wrong rung.
 */
import { expect, test, type Page } from '@playwright/test';

type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'singular';

const ECONOMY_KEY = 'godforge-economy';

/**
 * Where in the drop table to land, and the label the reveal should then show.
 *
 * `rollRune` walks the runes in ladder order subtracting each drop rate from
 * `random() * DROP_TABLE_TOTAL`, so these are the midpoints of each tier's
 * cumulative budget — the safest point inside each band rather than its edge.
 */
const AIM: Record<Tier, { roll: number; label: string }> = {
  common:    { roll: 0.5,          label: 'Common' },
  uncommon:  { roll: 0.99860,      label: 'Uncommon' },
  rare:      { roll: 0.99990,      label: 'Rare' },
  epic:      { roll: 0.9999690,    label: 'Epic' },
  legendary: { roll: 0.9999915,    label: 'Legendary' },
  mythic:    { roll: 0.9999980,    label: 'Mythic' },
  singular:  { roll: 0.99999975,   label: 'Singular' },
};

async function openForge(page: Page, tier: Tier): Promise<void> {
  await page.addInitScript(
    ({ key, blob, roll }) => {
      window.localStorage.setItem('xsantcastx_consent', 'denied');
      window.sessionStorage.setItem('visit-counted', '1');
      window.localStorage.setItem(key, blob);
      // Pinned before the bundle runs, so the very first strike is the one we
      // aimed at. High values also keep the explorer roll (5%) and the extra
      // copy roll from firing, which keeps the reveal to one rune.
      Math.random = () => roll;
    },
    { key: ECONOMY_KEY, blob: JSON.stringify({ version: 2, gold: 400_000_000 }), roll: AIM[tier].roll },
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

/**
 * Strike the anvil and report everything the celebration did, in one shot.
 *
 * One `evaluate` rather than an assertion per channel, because the layer is on
 * a teardown timer — a Legendary owns the screen for three seconds and a
 * Mythic for four. Reading it across half a dozen round-trips races that timer
 * and turns "the effect was never built" and "the effect has already finished"
 * into the same failure. Everything is captured the moment the card lands, and
 * asserted afterwards against the snapshot.
 */
async function strike(page: Page, tier: Tier) {
  await page.getByRole('button', { name: /Roll new rune/ }).click();
  await expect(page.locator('.rf-pick')).toHaveClass(/rf-pick--landed/);
  if (tier !== 'common') {
    // The celebration is raised one frame after the card, so that the element
    // it radiates from has a box to measure.
    await page.waitForSelector('.gf-fx', { state: 'attached', timeout: 2_000 });
  }

  const snapshot = await page.evaluate(() => {
    const layer = document.querySelector('.gf-fx') as HTMLElement | null;
    const root = document.documentElement;
    const card = document.querySelector('.rf-pick__card.is-chosen');
    // One shape whether or not a layer went up, so a Common reads as "every
    // channel at zero" rather than as a different type to narrow past.
    const count = (sel: string) => layer?.querySelectorAll(sel).length ?? 0;
    return {
      present: !!layer,
      tierLabel: document.querySelector('.rf-pick__tier')?.textContent?.trim() ?? '',
      tier: layer?.dataset['tier'] ?? null,
      color: layer?.style.getPropertyValue('--fx-color') ?? '',
      pointerEvents: layer ? getComputedStyle(layer).pointerEvents : '',
      ariaHidden: layer?.getAttribute('aria-hidden') ?? null,
      layers: document.querySelectorAll('.gf-fx').length,
      dark: count('.gf-fx__dark'),
      flash: count('.gf-fx__flash'),
      rings: count('.gf-fx__ring'),
      beams: count('.gf-fx__beam'),
      specks: count('.gf-fx__speck'),
      motes: count('.gf-fx__mote'),
      bolts: count('.gf-fx__bolt'),
      fissures: count('.gf-fx__fissure'),
      shaking: layer?.classList.contains('gf-jolt') ?? false,
      docTransform: getComputedStyle(root).transform,
      bodyTransform: getComputedStyle(document.body).transform,
      distorting: root.classList.contains('gf-distorting'),
      slowmo: root.dataset['gfSlowmo'] ?? null,
      letters: document.querySelectorAll('.rf-pick__char').length,
      // Read here rather than in a follow-up call, for the same reason as
      // everything else: by the time a second round-trip lands, the flag that
      // drives it may already have been cleared.
      cardDuration: card ? getComputedStyle(card).animationDuration : '',
    };
  });

  // The coupling to the drop table, asserted rather than assumed: a retune
  // fails here with "expected Mythic, got Legendary" instead of silently
  // testing the wrong rung.
  expect(snapshot.tierLabel).toBe(AIM[tier].label);
  return snapshot;
}

test.describe('rune celebration', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('a Common gets nothing at all', async ({ page }) => {
    // Asserted, not assumed. A Common should feel like nothing — that is what
    // makes every rung above it work, and a fanfare here would cost the fanfare.
    await openForge(page, 'common');
    const fx = await strike(page, 'common');
    expect(fx.present).toBe(false);
    expect(fx.letters).toBe(0);
    expect(fx.slowmo).toBeNull();
  });

  test('an Uncommon gets colour and nothing that moves the screen', async ({ page }) => {
    await openForge(page, 'uncommon');
    const fx = await strike(page, 'uncommon');
    expect(fx.present).toBe(true);
    expect(fx.rings).toBeGreaterThan(0);
    expect(fx.specks).toBe(0);
    expect(fx.shaking).toBe(false);
  });

  test('a Rare is the first real hit — particles, and a name typed out', async ({ page }) => {
    await openForge(page, 'rare');
    const fx = await strike(page, 'rare');
    expect(fx.specks).toBeGreaterThan(0);
    expect(fx.letters).toBeGreaterThan(0);
    // The design-system rare colour (tokens/rarity.css). Was #a48bff before the
    // ladder moved onto the system — this assertion is the palette's contract,
    // so it changes with the palette rather than pinning the old value.
    expect(fx.color).toBe('#00d4ff');
    // The screen still does not move. That is Epic's.
    expect(fx.shaking).toBe(false);
    expect(fx.dark).toBe(0);
  });

  test('an Epic shakes, without ever transforming the document', async ({ page }) => {
    await openForge(page, 'epic');
    const fx = await strike(page, 'epic');
    expect(fx.shaking).toBe(true);
    expect(fx.beams).toBeGreaterThan(0);
    expect(fx.motes).toBe(0);
    // The bug this guards: a transform on <html> or <body> makes it the
    // containing block for every position:fixed descendant, which re-anchors
    // the reveal dialog against the document instead of the viewport.
    expect(fx.docTransform).toBe('none');
    expect(fx.bodyTransform).toBe('none');
  });

  test('a Legendary goes dark first, then gold', async ({ page }) => {
    await openForge(page, 'legendary');
    const fx = await strike(page, 'legendary');
    expect(fx.dark).toBe(1);
    expect(fx.bolts).toBeGreaterThan(0);
    expect(fx.motes).toBeGreaterThan(0);
    expect(fx.slowmo).toBeNull();
  });

  test('a Mythic distorts and drops the card reveal to half speed', async ({ page }) => {
    await openForge(page, 'mythic');
    const fx = await strike(page, 'mythic');
    expect(fx.distorting).toBe(true);
    expect(fx.slowmo).toBe('2');
    expect(fx.fissures).toBe(0);
    // The flag has to actually reach the card, or slow motion is a data
    // attribute nobody reads. It did not, once: the rules were written in the
    // component's stylesheet, where Angular appended the scoping attribute to
    // `html[data-gf-slowmo]` as well and the selector stopped matching
    // anything at all — no warning, no error, no slow motion.
    expect(fx.cardDuration).toBe('0.64s, 2.2s');
  });

  test('a Singular breaks the screen', async ({ page }) => {
    await openForge(page, 'singular');
    const fx = await strike(page, 'singular');
    expect(fx.fissures).toBeGreaterThan(0);
    expect(fx.bolts).toBeGreaterThan(0);
    expect(fx.distorting).toBe(true);
  });

  test('the reveal dialog does not move when the screen shakes', async ({ page }) => {
    // The concrete failure a document-level transform would cause: `.rf-focus`
    // is `position: fixed; inset: 0`, so a transformed ancestor re-measures it
    // against the document — it grows to scrollHeight and jumps to the top of
    // the page, taking the card the player is reading with it.
    await openForge(page, 'singular');
    await page.getByRole('button', { name: /Roll new rune/ }).click();
    const focus = page.locator('.rf-focus');
    await expect(focus).toBeVisible();
    const box = (await focus.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(900);
    expect(box.y).toBeGreaterThanOrEqual(-1);
  });

  test('the layer is weather, never a target', async ({ page }) => {
    await openForge(page, 'legendary');
    const fx = await strike(page, 'legendary');
    expect(fx.pointerEvents).toBe('none');
    expect(fx.ariaHidden).toBe('true');

    // And the card underneath is still dismissible. A celebration that ate the
    // click would be the worst kind of bug here: it only appears on the drops
    // that matter most.
    await page.locator('.rf-pick__done').click();
    await expect(page.locator('.rf-focus')).toHaveCount(0);
  });

  test('one celebration at a time, and it always comes down', async ({ page }) => {
    await openForge(page, 'singular');
    const first = await strike(page, 'singular');
    expect(first.layers).toBe(1);

    // Singular is the longest run on the ladder at 5.6s. Nothing may outlive it.
    await expect.poll(
      () => page.evaluate(() => ({
        layers: document.querySelectorAll('.gf-fx').length,
        jolted: document.querySelectorAll('.gf-jolt').length,
        distorting: document.documentElement.classList.contains('gf-distorting'),
        slowmo: document.documentElement.dataset['gfSlowmo'] ?? null,
      })),
      { timeout: 9_000 },
    ).toEqual({ layers: 0, jolted: 0, distorting: false, slowmo: null });
  });

  test('the animations are real, not dangling references', async ({ page }) => {
    // A CSS animation name that matches no @keyframes rule instantiates
    // nothing, reports `animation-play-state: running` from getComputedStyle,
    // and produces no console error — the exact failure that left the hero
    // carousel invisible for a release. getAnimations() is the only thing that
    // tells the difference, and this whole layer is built with createElement,
    // so a rule that landed in a component stylesheet by mistake would be
    // rewritten to require a scoping attribute these nodes never carry.
    await openForge(page, 'singular');
    await strike(page, 'singular');
    const live = await page.evaluate(() => {
      const layer = document.querySelector('.gf-fx')!;
      const named = ['.gf-fx__dark', '.gf-fx__flash', '.gf-fx__ring', '.gf-fx__beam',
        '.gf-fx__speck', '.gf-fx__mote', '.gf-fx__fissure', '.gf-fx__pour', '.gf-fx__bolt'];
      const out: Record<string, number> = {};
      for (const sel of named) {
        const el = layer.querySelector(sel);
        out[sel] = el ? el.getAnimations().length : -1;
      }
      out['.gf-jolt'] = layer.getAnimations().length;
      out['.rf-pick__char'] = document.querySelector('.rf-pick__char')?.getAnimations().length ?? -1;
      return out;
    });
    for (const [sel, n] of Object.entries(live)) {
      expect(n, `${sel} has no live animation`).toBeGreaterThan(0);
    }
  });

  test('reduced motion keeps the colour and drops everything that moves', async ({ browser }) => {
    // The house rule: a static end state, not an absent one. A visitor who has
    // asked for less motion should still be told a Singular landed.
    const ctx = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    try {
      await openForge(page, 'singular');
      const fx = await strike(page, 'singular');
      expect(fx.present).toBe(true);
      expect(fx.flash).toBe(1);
      expect(fx.specks).toBe(0);
      expect(fx.motes).toBe(0);
      expect(fx.bolts).toBe(0);
      expect(fx.rings).toBe(0);
      expect(fx.fissures).toBe(0);
      expect(fx.shaking).toBe(false);
      expect(fx.distorting).toBe(false);
      expect(fx.slowmo).toBeNull();
      expect(fx.letters).toBe(0);
      // The rune is still named, in one readable string.
      await expect(page.locator('.rf-pick__name')).toHaveText(/\S/);
    } finally {
      await ctx.close();
    }
  });

  test('a phone gets the event, without the lightning', async ({ page }) => {
    // Six animated SVG paths under a full-viewport drop-shadow filter is a
    // compositor stall on exactly the hardware least able to absorb one. The
    // rest of the Singular survives the cut — it is the one drop a player may
    // only ever see on the device in their hand.
    await page.setViewportSize({ width: 375, height: 812 });
    await openForge(page, 'singular');
    const fx = await strike(page, 'singular');
    expect(fx.bolts).toBe(0);
    expect(fx.fissures).toBeGreaterThan(0);
    expect(fx.specks).toBeGreaterThan(0);
    expect(fx.shaking).toBe(true);
  });

  test('the fanfare is off until it is asked for, and then it is remembered', async ({ page }) => {
    await openForge(page, 'common');
    const toggle = page.locator('.gf-sound');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // 44px is the site's own floor for a standalone control.
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('forge-sound-enabled'))).toBe('1');

    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('.gf-sound')).toHaveAttribute('aria-pressed', 'true');
  });
});
