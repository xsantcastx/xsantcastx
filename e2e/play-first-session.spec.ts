/**
 * play-first-session.spec.ts — a brand-new player's first minutes, played.
 *
 * A browser that has never been here lands on the entry route, walks through
 * the tutorial, takes its "Enter the world" door into /play, and then follows
 * nothing but the HUD's goal line ("Goal n of 4" + "Show me") through the four
 * first goals: buy a Homestead building, forge AND equip the Basalt Edge,
 * defeat a Rivet Maw with it, dig in the Ember Delve. When all four are done
 * the line is gone, and the Crafting Bench has something in "Ready now" made
 * from what those goals left in the satchel.
 *
 * The audit that produced this (docs/handoff/first-session-audit.md) found the
 * first purchase unreachable on a phone: the Interact prompt sat on the Forge
 * Bellows' Buy button. The phone test checks that button with a hit test at its
 * centre, which is what a thumb does, rather than trusting visibility. The
 * order change (blade before the hunt) is docs/handoff/onboarding-aaa.md.
 *
 * Seeding: storage is cleared from /robots.txt (see play-helpers), and the
 * suite-wide "tutorial already seen" record is removed for the first test only.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvas, focusWorld, openPlay, seed } from './play-helpers';

const guide = (page: Page) => page.locator('.guide');
const goal = (page: Page) => guide(page).getAttribute('data-goal');
const panel = (page: Page) => page.locator('section.place');

async function showMe(page: Page): Promise<void> {
  await guide(page).getByRole('button', { name: /^Walk there/ }).click();
}

async function tally(page: Page): Promise<string> {
  return (await page.locator('.satchel .tally').innerText()).replace(/\s+/g, ' ').toUpperCase();
}
async function kills(page: Page): Promise<number> {
  return Number(/DEFEATED (\d+)/.exec(await tally(page))?.[1] ?? 0);
}

/** The satchel's Damage figure: what the worn loadout hits for. */
async function damage(page: Page): Promise<number> {
  return Number(/DAMAGE (\d+)/.exec(await tally(page))?.[1] ?? 0);
}

/** True when nothing paints over the centre of `target` (the way a tap would land). */
async function reachable(target: Locator): Promise<boolean> {
  return target.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (el === hit || el.contains(hit));
  });
}

/** Strike the Forge (E) until the Forge Bellows can be bought; returns its Buy button. */
async function strikeForBellows(page: Page, strike: () => Promise<void>): Promise<Locator> {
  const bellows = page.locator('.hc-row', { hasText: 'Forge Bellows' }).locator('.hc-buy');
  await expect(bellows).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => { await strike(); return bellows.isEnabled(); }, { timeout: 30000, intervals: [200] }).toBe(true);
  return bellows;
}

test.describe('First session, played', () => {
  test('a first visit: / is the world → the goal line walks buy, forge + equip, hunt, Delve; then a Ready-now craft', async ({ page }) => {
    test.setTimeout(300000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page);
    await page.evaluate(() => localStorage.removeItem('eclipse-onboarding'));
    const t0 = Date.now();
    const mark = (what: string) => test.info().annotations.push({ type: 'timing', description: `${what}: ${((Date.now() - t0) / 1000).toFixed(1)} s` });

    // ── The entry route IS the world (game-only shell): no landing, no site tutorial. ──
    await page.goto('/');
    await expect(page).toHaveURL(/\/play$/);
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
    await expect(page.locator('.ob')).toHaveCount(0);
    // A brand-new Keeper is offered "Make your Keeper" once (docs/handoff/make-your-keeper.md): keep the look.
    const glass = page.locator('section.place .km');
    await expect(glass).toBeVisible({ timeout: 20000 });
    await glass.getByRole('button', { name: 'Become this Keeper' }).click();
    await expect(glass).toBeHidden();
    mark('into the world');

    // ── Goal 1: buy a building. ──
    await expect(guide(page)).toContainText('Goal 1 of 4');
    await expect(guide(page)).toContainText('Your Homestead');
    await showMe(page);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Your Homestead', { timeout: 30000 });
    await expect(guide(page)).toContainText('Forge Bellows');
    await showMe(page); // walks to the Forge and strikes it once
    // A key press mid-walk would stop the Keeper short; wait until the Forge is in reach.
    await expect(page.locator('.prompt')).toContainText(/Strike the Forge/i, { timeout: 20000 });
    const bellows = await strikeForBellows(page, async () => { await focusWorld(page); await page.keyboard.press('e'); });
    expect(await reachable(bellows), 'the Bellows Buy button is covered').toBe(true);
    await bellows.click();
    await expect(page.locator('.hc-notice')).toContainText(/Forge Bellows built/);
    mark('goal 1, first building');

    // ── Goal 2: forge the Basalt Edge, then equip it. No fighting needed. ──
    await expect.poll(() => goal(page)).toBe('craft');
    await expect(guide(page)).toContainText('Goal 2 of 4');
    // One World: the plot is on the same street; the line names the seam straight away (no "head back").
    await expect(guide(page)).toContainText('Mine the Cinder Ore seam');
    await showMe(page); // walks to the Cinder Ore seam and mines once
    await expect(page.locator('.prompt')).toContainText(/Cinder Ore|Seam recovering/i, { timeout: 20000 });
    // The seam recovers between strikes; an ember turns up by the 8th ore.
    await expect.poll(async () => {
      if (await guide(page).textContent().then(t => /Seamworks Forge/.test(t ?? ''))) return true;
      await focusWorld(page);
      await page.keyboard.press('e');
      return false;
    }, { timeout: 60000, intervals: [600] }).toBe(true);
    await showMe(page); // walks to the forge and forges the blade
    await expect(page.locator('.objective')).toContainText(/Basalt Edge is ready|equipped/, { timeout: 30000 });
    // Forged is not armed: the line sends the Keeper back to the forge to wear it.
    await expect(guide(page)).toContainText('equip it before you hunt');
    const bare = await damage(page);
    expect(bare, 'no Damage figure in the satchel').toBeGreaterThan(0);
    await showMe(page); // the forge equips the blade
    await expect(page.locator('.objective')).toContainText('Basalt Edge equipped', { timeout: 10000 });
    await expect.poll(() => damage(page), { timeout: 10000 }).toBeGreaterThan(bare);
    const armed = await damage(page);
    mark('goal 2, Basalt Edge forged and worn');

    // ── Goal 3: defeat a Rivet Maw, blade in hand. ──
    await expect.poll(() => goal(page), { timeout: 10000 }).toBe('hunt');
    await expect(guide(page)).toContainText('Goal 3 of 4');
    await expect(guide(page)).toContainText('east past the Waystone');
    expect(await damage(page), 'the Keeper walks to the Maws unarmed').toBe(armed);
    await showMe(page); // walks east, short of the first Maw
    // One World: the Maws keep to the Quarry Road (x 4140+), east of the town: let the walk arrive before fighting.
    await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-x')), { timeout: 40000 }).toBeGreaterThan(4100);
    await focusWorld(page);
    const start = await kills(page);
    let dir: 'd' | 'a' = 'd';
    for (let i = 0; i < 300 && (await kills(page)) === start; i++) {
      await page.keyboard.press('j');
      await page.waitForTimeout(180);
      if (i % 4 === 3 && !/Maw/i.test(await page.locator('.vitals').innerText())) {
        await page.keyboard.down(dir); await page.waitForTimeout(250); await page.keyboard.up(dir);
      }
      if (i % 60 === 59) dir = dir === 'd' ? 'a' : 'd';
      if (await page.locator('.fall-card').isVisible()) await page.locator('.fall-card button').click();
    }
    expect(await kills(page), 'no Rivet Maw fell').toBeGreaterThan(start);
    mark('goal 3, first Rivet Maw');

    // ── Goal 4: dig in the Ember Delve. ──
    await expect.poll(() => goal(page), { timeout: 10000 }).toBe('delve');
    await expect(guide(page)).toContainText('Goal 4 of 4');
    // One World: the Delve is under the street; Show me walks to the old shaft's spot beside the mine head.
    await expect(guide(page)).toContainText('under the street');
    await showMe(page);
    await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-x')), { timeout: 40000 }).toBeLessThan(300);
    await page.waitForTimeout(400);
    await focusWorld(page);
    await page.keyboard.down('s');
    await page.keyboard.down('j');
    try {
      await expect(guide(page)).toBeHidden({ timeout: 20000 });
    } finally {
      await page.keyboard.up('j');
      await page.keyboard.up('s');
    }
    mark('goal 4, first Delve dig (all four done)');

    // ── The Crafting Bench: something is ready now, from what the goals left behind. ──
    await page.waitForTimeout(2500); // the debounced Delve write lands before the navigation
    await openPlay(page, '?at=crafting');
    await expect(panel(page).locator('.cb-hero')).toBeVisible({ timeout: 15000 });
    const readyTab = panel(page).locator('.tab', { hasText: 'Ready now' });
    await expect(readyTab).toHaveClass(/is-on/);
    await expect(readyTab.locator('.tab__badge')).toHaveText(/[1-9]/);
    await expect(panel(page).locator('.cb-hero .dh__name')).toHaveText('Torch');
    await expect(panel(page).locator('.cb-hero .ab__btn')).not.toHaveAttribute('aria-disabled', 'true');
    mark('Crafting Bench, Torch ready now');

    // ── The Rune Forge: not yet (the purse is far short of a strike)… ──
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden({ timeout: 10000 });
    await expect(guide(page)).toBeHidden();

    // …then the purse first covers a strike (the Gold is topped up from a page that
    // runs no app code, so nothing flushes over it), and one "next step" line appears.
    await page.waitForTimeout(1500);
    await page.goto('/robots.txt');
    await page.evaluate(() => {
      const economy = JSON.parse(localStorage.getItem('godforge-economy') ?? '{}');
      localStorage.setItem('godforge-economy', JSON.stringify({ ...economy, gold: 5000 }));
    });
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
    await expect(guide(page)).toHaveAttribute('data-goal', 'rune', { timeout: 10000 });
    await expect(guide(page)).toContainText('Next step');
    await expect(guide(page)).toContainText('Rune Forge');
    await showMe(page); // walks to the Rune Forge and opens it
    await expect(panel(page)).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(/at=runes/);
    await expect(guide(page)).toBeHidden();
    // Once: a reload with the same purse does not bring it back.
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);
    await openPlay(page);
    await page.waitForTimeout(1000);
    await expect(guide(page)).toBeHidden();
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('the goal line fits, and the first building can be bought with a thumb', async ({ page }) => {
      test.setTimeout(120000);
      await seed(page);
      await openPlay(page);
      await expect(guide(page)).toContainText('Goal 1 of 4');
      expect(await reachable(guide(page).locator('.guide-go')), 'Show me is covered').toBe(true);
      // The goal line sits under the top band, which holds the health bar and the satchel button.
      const [g, v, s] = await Promise.all([guide(page), page.locator('.vitals'), page.locator('.satchel')].map(l => l.boundingBox()));
      expect(g!.y).toBeGreaterThanOrEqual(v!.y + v!.height);
      expect(g!.y).toBeGreaterThanOrEqual(s!.y + s!.height);

      await guide(page).locator('.guide-go').tap();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Your Homestead', { timeout: 30000 });
      // A Keeper with no building yet gets the Gold list unfolded, not a folded "1 Gold" chip.
      await expect(page.locator('.hc-toggle')).toHaveAttribute('aria-expanded', 'true');
      await guide(page).locator('.guide-go').tap(); // to the Forge: the Interact prompt is now up
      await expect(page.locator('.prompt.armed')).toBeVisible({ timeout: 20000 });
      const strike = page.locator('.hc-strike');
      const bellows = await strikeForBellows(page, async () => { await strike.tap(); });
      expect(await reachable(bellows), 'the Bellows Buy button is covered (by the Interact prompt?)').toBe(true);
      await bellows.tap();
      await expect(page.locator('.hc-notice')).toContainText(/Forge Bellows built/);
      // Next: the blade, not the Maws.
      await expect.poll(() => goal(page)).toBe('craft');
    });
  });

  test('the goal line speaks Spanish', async ({ page }) => {
    await seed(page, { 'preferred-language': 'es' });
    await openPlay(page);
    await expect(guide(page)).toContainText('Objetivo 1 de 4');
    // The goal row also holds Glim's hint button (e2e/play-glim.spec.ts): name Show me by its class.
    await expect(guide(page).locator('.guide-go')).toHaveText('Llevame');
  });
});
