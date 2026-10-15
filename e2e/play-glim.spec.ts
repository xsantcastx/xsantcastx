/**
 * play-glim.spec.ts — Glim, the Margin-Light, played (docs/handoff/glim.md).
 *
 * The companion from docs/world/world-and-cast.md §4, slice S1:
 *   - a new save meets Glim: it flies in to the Keeper's shoulder and says hello;
 *     the meeting is remembered through the save gateway (godforge-glim);
 *   - the moth in the goal row opens the hint ladder one step at a time:
 *     a nudge, a direction, then Show me, where Glim flies ahead to the place
 *     and the Keeper follows; the step is remembered across a reload;
 *   - Show me itself is unchanged (play-first-session keeps its timings);
 *   - in the Delve Glim is the lantern and says so; beside a Mirror Substitute
 *     it dims (the readable tell);
 *   - on a phone its line is never over the middle half of the world and never
 *     on a control, and its buttons are at least 44×44 and take their own taps.
 *
 * Secrets are never on the ladder: that is a property of the hint table and is
 * pinned in Karma (shared/glim/glim.spec.ts), over every Codex secret id.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { blob, canvas, focusWorld, openPlay, playerX, seed, walk, walkTo } from './play-helpers';
import { DelveFixture } from './play-delve-fixtures';

const say = (page: Page) => page.locator('.glim-say');
const ask = (page: Page) => page.locator('.guide .guide-glim');
const viewport = (page: Page) => page.locator('.viewport');

/** Glim already met, so a spec can watch a later beat without the hello. */
/** One World: the Homestead's Forge in the Ember world (plot x 720 at the world's half scale from x −1700). */
const HOME_FORGE_X = -1700 + 720 / 2;
const MET = { 'godforge-glim': { version: 1, met: true, metAt: '2026-10-14T00:00:00.000Z', ladder: {}, said: { meet: 1 }, lastAt: { meet: 1 } } };

interface Box { left: number; top: number; right: number; bottom: number }
const meets = (a: Box, b: Box) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;

async function box(l: Locator): Promise<Box> {
  return l.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; });
}

/** True when a tap at the centre of `target` lands on it. */
async function reachable(target: Locator): Promise<boolean> {
  return target.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (el === hit || el.contains(hit));
  });
}

/** Glim's line clears the middle half of the world and every visible HUD control. */
async function clearOfWorldAndControls(page: Page, label: string): Promise<void> {
  const bubble = await box(say(page));
  const c = await box(canvas(page));
  const h = c.bottom - c.top;
  const middle = { left: c.left, right: c.right, top: c.top + h * .25, bottom: c.top + h * .75 };
  expect(meets(bubble, middle), `${label}: Glim's line over the middle of the world ${JSON.stringify(bubble)}`).toBe(false);
  const controls = await page.evaluate(() => Array.from(document.querySelectorAll(
    '.guide, .vitals, .satchel, .title-block, .places-toggle, .hotbar, .prompt.armed, .dock, .hearth-pill, .m-take, .touch-move, .touch-act, .touch .tb',
  )).filter(el => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }).map(el => { const r = el.getBoundingClientRect(); return { sel: el.className, left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
  for (const ctl of controls) expect(meets(bubble, ctl), `${label}: Glim's line on ${ctl.sel}`).toBe(false);
}

test.describe('Glim, the Margin-Light', () => {
  test.describe.configure({ timeout: 120000 });

  test('a new save meets Glim; the hint ladder opens one step at a time and Show me flies ahead', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page);
    await openPlay(page);

    // ── The meeting: Glim lands on the shoulder and says hello, once. ──
    await expect(say(page)).toHaveAttribute('data-glim-line', 'meet', { timeout: 5000 });
    await expect(say(page)).toContainText("I'm Glim. I keep the maps.");
    await expect(viewport(page)).toHaveAttribute('data-glim-x', /\d/);
    await clearOfWorldAndControls(page, '1280×800 meet');
    const saved = await blob<{ met: boolean; said: Record<string, number> }>(page, 'godforge-glim');
    expect(saved?.met).toBe(true);
    expect(saved?.said['meet']).toBe(1);

    // ── The goal line is the same; Glim voices it from the row's moth. ──
    await expect(page.locator('.guide')).toContainText('Goal 1 of 4');
    await expect(ask(page)).toHaveAttribute('aria-label', 'Ask Glim for a hint (1 of 3)');
    const size = await ask(page).boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(44);
    expect(size!.height).toBeGreaterThanOrEqual(44);

    // Step 1: a nudge. Nothing moves.
    const x0 = await playerX(page);
    await ask(page).click();
    await expect(say(page)).toHaveAttribute('data-glim-step', '1');
    await expect(say(page)).toContainText('Gold here comes from work');
    await expect(say(page)).toContainText('Hint 1 of 3');
    await expect(ask(page)).toHaveAttribute('aria-label', 'Ask Glim for a hint (2 of 3)');
    await clearOfWorldAndControls(page, '1280×800 hint 1');

    // Step 2: a direction, in plain words.
    await ask(page).click();
    await expect(say(page)).toHaveAttribute('data-glim-step', '2');
    await expect(say(page)).toContainText('Your Homestead is west along the street');
    expect(await playerX(page)).toBe(x0);

    // Step 3: Show me. Glim flies ahead to the plot's Forge (its trail ends there) and the Keeper follows (One World: west along the street).
    await ask(page).click();
    await expect(say(page)).toHaveAttribute('data-glim-step', '3');
    await expect(say(page)).toContainText('Follow me');
    await expect(viewport(page)).toHaveAttribute('data-glim-target', String(HOME_FORGE_X));
    await expect(viewport(page)).toHaveAttribute('data-glim-arrived', 'true', { timeout: 10000 });
    await expect(canvas(page)).toHaveAttribute('data-area', 'Your Homestead', { timeout: 20000 });

    // Dismissible.
    await page.locator('.glim-say__close').click();
    await expect(say(page)).toHaveCount(0);

    // Remembered across a reload: no second hello, and the ladder stays where it was.
    await openPlay(page);
    await expect(ask(page)).toHaveAttribute('aria-label', 'Ask Glim for a hint (3 of 3)');
    await page.waitForTimeout(1500);
    await expect(page.locator('.glim-say[data-glim-line="meet"]')).toHaveCount(0);
    const after = await blob<{ ladder: Record<string, number>; said: Record<string, number> }>(page, 'godforge-glim');
    expect(after?.ladder['goal.buy']).toBe(3);
    expect(after?.said['meet']).toBe(1);
  });

  test('Show me still walks the goal, with Glim flying ahead', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, MET);
    await openPlay(page);
    await page.locator('.guide-go').click();
    await expect(viewport(page)).toHaveAttribute('data-glim-target', String(HOME_FORGE_X));
    await expect(canvas(page)).toHaveAttribute('data-area', 'Your Homestead', { timeout: 20000 });
    await expect(page.locator('.guide')).toHaveAttribute('data-goal', 'buy');
  });

  test('in the Delve Glim is the lantern, and it says so once', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, MET);
    // One World: the Delve is under the street. Beside the mine head, dig down until the Keeper is in the rock.
    await openPlay(page, '?at=delve');
    await focusWorld(page);
    await walkTo(page, 260, 10);
    await page.keyboard.down('s'); await page.keyboard.down('j');
    try { await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 20000 }); }
    finally { await page.keyboard.up('j'); await page.keyboard.up('s'); }
    await expect(say(page)).toHaveAttribute('data-glim-line', 'delve', { timeout: 5000 });
    // It rides at the Keeper's chest, a little ahead: the light has a source.
    await expect.poll(async () => Math.abs(Number(await viewport(page).getAttribute('data-glim-x')) - await playerX(page)), { timeout: 5000 }).toBeLessThan(60);
  });

  test('Glim dims beside a Mirror Substitute (the readable tell)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, { ...MET, 'eclipse-play-world-v1': { town: 'umbral' } });
    await openPlay(page, '?at=passage');
    await focusWorld(page);
    await page.keyboard.press('e');
    await expect(canvas(page)).toHaveAttribute('data-area', /Unrecorded Corridors/i, { timeout: 15000 });
    await expect(viewport(page)).toHaveAttribute('data-glim-dim', 'false');
    await walk(page, 'd', 820);
    await expect(viewport(page)).toHaveAttribute('data-glim-dim', 'true', { timeout: 8000 });
    await expect(say(page)).toHaveAttribute('data-glim-line', 'mirror', { timeout: 5000 });
  });
});

test.describe('Glim on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.describe.configure({ timeout: 120000 });

  test('never over the middle of the world or a control; 44px buttons that take their own taps', async ({ page }) => {
    await seed(page);
    await openPlay(page);
    await expect(say(page)).toHaveAttribute('data-glim-line', 'meet', { timeout: 5000 });
    await page.waitForTimeout(400); // the line's entrance
    await clearOfWorldAndControls(page, '390×844 meet');
    // The message toast steps aside while Glim speaks (they share the band).
    const toast = page.locator('.objective-line');
    if (await toast.count()) expect(await toast.evaluate(el => getComputedStyle(el).visibility)).toBe('hidden');

    for (const control of [ask(page), page.locator('.glim-say__close'), page.locator('.guide-go')]) {
      const b = await control.boundingBox();
      expect(b!.width, 'a Glim control under 44px').toBeGreaterThanOrEqual(44);
      expect(b!.height, 'a Glim control under 44px').toBeGreaterThanOrEqual(44);
      expect(await reachable(control), 'a Glim control does not take its own tap').toBe(true);
    }

    // The ladder on a thumb: step 1, then step 2, each still clear of the world.
    await ask(page).tap();
    await expect(say(page)).toHaveAttribute('data-glim-step', '1');
    await page.waitForTimeout(400);
    await clearOfWorldAndControls(page, '390×844 hint 1');
    await ask(page).tap();
    await expect(say(page)).toHaveAttribute('data-glim-step', '2');
    await page.waitForTimeout(400);
    await clearOfWorldAndControls(page, '390×844 hint 2');

    // Show me still answers a tap, with Glim's line up.
    expect(await reachable(page.locator('.guide-go'))).toBe(true);
    const x0 = await playerX(page);
    await page.locator('.guide-go').tap();
    await expect.poll(() => playerX(page), { timeout: 10000 }).not.toBe(x0);

    // Dismiss with a thumb.
    await page.locator('.glim-say__close').tap();
    await expect(say(page)).toHaveCount(0);
  });

  test('speaks Spanish', async ({ page }) => {
    await seed(page, { 'preferred-language': 'es' });
    await openPlay(page);
    await expect(say(page)).toContainText('Soy Glim. Guardo los mapas.', { timeout: 5000 });
    await expect(ask(page)).toHaveAttribute('aria-label', 'Pide una pista a Glim (1 de 3)');
  });
});

/**
 * Map v2: a Delve mission's hint ladder has its third step. In the Skills
 * Lodge's mission chip, the moth's third answer is "I'll mark it": Glim drops
 * a temporary mark on the Delve map at the mission's target (the nearest
 * shadow-root for Verrin's first mission), and the full map leads the way to it.
 */
for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`Glim's mark on the map (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });

    test('the third hint of a Delve mission marks its target on the Delve map', async ({ page }) => {
      test.setTimeout(150_000);
      const f = new DelveFixture().carve(14, 34, 6, 8).floor(14, 34, 9).camp(22, 8);
      await seed(page, { ...MET, ...f.blobs() });
      await openPlay(page, '?at=skills');
      const chip = page.locator('section.place app-delve-mission-chip');
      await expect(chip).toContainText('The Shadow Beneath', { timeout: 15000 });
      const moth = chip.locator('.dmc__glim');
      const mothBox = await moth.boundingBox();
      expect(Math.min(mothBox!.width, mothBox!.height), 'the moth is a 44px target').toBeGreaterThanOrEqual(44);
      for (const n of [1, 2, 3]) {
        if (touch) await moth.tap(); else await moth.click();
        await expect(chip.locator('.dmc__glim-line')).toContainText(`Hint ${n} of 3`);
      }
      await expect(chip.locator('.dmc__glim-line')).toContainText('mark it on your Delve map');
      const glim = await blob<{ lastAt: Record<string, number> }>(page, 'godforge-glim');
      expect(glim?.lastAt['mark.delve-verrin-shadow'] ?? 0).toBeGreaterThan(0);

      // Down to the camp: the mark is on the map, on a shadow-root.
      await openPlay(page, '?at=delve');
      await page.getByRole('button', { name: /Descend to your camp/ }).click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
      await expect(canvas(page)).toHaveAttribute('data-glim-mark', /^\d+,\d+$/, { timeout: 10000 });
      const [col, row] = (await canvas(page).getAttribute('data-glim-mark'))!.split(',').map(Number);
      expect(f.kindAt(col, row)).toBe('shadow-root');
      if (!touch) { await focusWorld(page); await page.keyboard.press('KeyM'); }
      else await page.locator('.map-mini-open').tap();
      await expect(page.locator('.map-full')).toBeVisible();
      await expect(page.locator('.map-hint')).toContainText('Glim\'s mark');
      await expect(page.locator('.map-legend')).toContainText('Glim\'s mark');
      if (process.env['BOUNTY_SHOTS']) await page.screenshot({ path: `output/bounties/${label}-glim-mark.png` });
    });
  });
}
