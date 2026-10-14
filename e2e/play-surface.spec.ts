/**
 * play-surface.spec.ts — the surface with height (world/heights.ts,
 * docs/handoff/surface-height.md), in the Ember Quarry:
 *   - mantle the low shelf (jump into its side, catch the lip, push on) and open
 *     its courier cache;
 *   - climb the tree into its canopy (Jump at the trunk);
 *   - the summit route: up the snag, wall-jump onto the ruin block, the slab,
 *     catch the spire's lip; add a stone to the summit cairn;
 *   - reload: the cache stays opened and pays nothing again; the summit is saved.
 * At 1280×800 with the keyboard and at 390×844 with the touch buttons (held by
 * pointer events, as a finger holds them; Playwright's touchscreen only taps).
 */
import { expect, Page, test } from '@playwright/test';
import { blob, canvas, ERA, focusWorld, openPlay, playerX, seed, settleBetween, walkTo } from './play-helpers';

test.use({ screenshot: 'only-on-failure' });

const X0 = 560;
const LOW = 330, CANOPY = 290, SNAG_TOP = 40, BLOCK = -150, SLAB = -270, SPIRE = -560;
type Act = 'left' | 'right' | 'jump' | 'down';
const KEY: Record<Act, string> = { left: 'KeyA', right: 'KeyD', jump: 'Space', down: 'KeyS' };

async function playerY(page: Page): Promise<number> {
  return Number(await canvas(page).getAttribute('data-player-y'));
}
async function gold(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('godforge-economy') || '{}');
    return Number((raw && 'v' in raw ? raw.v : raw)?.gold ?? 0);
  });
}
async function found(page: Page): Promise<string[]> {
  const raw = await blob<{ v?: { found?: string[] }; found?: string[] }>(page, 'godforge-heights');
  return (raw?.v?.found ?? raw?.found ?? []);
}

function controls(page: Page, touch: boolean) {
  const button = (act: Act) => page.locator(`.touch .tb--${act === 'jump' ? 'jump' : act}`).first();
  const set = async (act: Act, on: boolean) => {
    if (!touch) { if (on) await page.keyboard.down(KEY[act]); else await page.keyboard.up(KEY[act]); return; }
    await button(act).dispatchEvent(on ? 'pointerdown' : 'pointerup', { pointerType: 'touch', pointerId: 11, isPrimary: true, button: 0, buttons: on ? 1 : 0, bubbles: true });
  };
  return {
    down: (act: Act) => set(act, true),
    up: (act: Act) => set(act, false),
    /** Release and press again (a fresh press of a held button). */
    repress: async (act: Act) => { await set(act, false); await page.waitForTimeout(40); await set(act, true); },
    async walkTo(x: number, slack = 12) {
      // The keyboard: the shared helper (it walks back after an overshoot on a busy machine).
      if (!touch) { await walkTo(page, x, slack); return; }
      for (let i = 0; i < 4; i++) {
        const at = await playerX(page);
        if (Math.abs(at - x) <= slack) return;
        const act: Act = at < x ? 'right' : 'left';
        await set(act, true);
        try { await expect.poll(async () => { const p = await playerX(page); return act === 'right' ? p >= x - slack / 2 : p <= x + slack / 2; }, { timeout: 15000, intervals: [30] }).toBe(true); }
        finally { await set(act, false); }
        await page.waitForTimeout(200);
      }
    },
    /** Stand within a trunk's grab (24 px of its centre). */
    async toTrunk(x: number) {
      if (!touch) { await settleBetween(page, x - 16, x + 16); await focusWorld(page); return; }
      await this.walkTo(x, 10);
      // Short taps toward the trunk until the Keeper stands within its grab.
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(300);
        const at = await playerX(page);
        if (Math.abs(at - x) <= 16) return;
        const act: Act = at < x ? 'right' : 'left';
        await set(act, true); await page.waitForTimeout(40); await set(act, false);
      }
    },
    async releaseAll() { for (const act of ['left', 'right', 'jump', 'down'] as Act[]) await set(act, false); },
  };
}

async function untilY(page: Page, y: number, timeout = 8000): Promise<void> {
  await expect.poll(() => playerY(page), { timeout, intervals: [30] }).toBe(y);
}

/** Run at the low shelf and jump: catch the lip, let go of the run, Jump mantles (no run carries on past the cache). */
async function mantleLow(page: Page, c: ReturnType<typeof controls>): Promise<void> {
  // A step short of the shelf: Jump, then push into it; the hands catch the lip and hang.
  await c.walkTo(X0 - 110, 25);
  await c.down('jump'); await c.down('right');
  await settleGrab(page, c, LOW);
}
/**
 * After a jump that should catch a lip: once the Keeper hangs (or is already up),
 * let go of any run so they do not carry on off the far side, then Jump mantles.
 */
async function settleGrab(page: Page, c: ReturnType<typeof controls>, y: number): Promise<void> {
  // Watched every frame in the page: the hang and the mantle last a fraction of a second.
  await page.waitForFunction(target => {
    const el = document.querySelector('.viewport canvas');
    const climb = el?.getAttribute('data-climb');
    return climb === 'hang' || climb === 'mantle' || Number(el?.getAttribute('data-player-y')) === target;
  }, y, { polling: 'raf', timeout: 8000 });
  await c.up('right');
  if (await canvas(page).getAttribute('data-climb') === 'hang') await c.repress('jump');
  await untilY(page, y);
  await c.releaseAll();
}

async function toQuarry(page: Page, touch: boolean): Promise<void> {
  await openPlay(page);
  if (touch) await page.locator('.places-toggle').first().click(); else await page.getByRole('button', { name: 'Places' }).click();
  await page.locator('#places-list button', { hasText: 'East Passage' }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry', { timeout: 60000 });
  await page.waitForTimeout(500);
  await focusWorld(page);
}

async function useFind(page: Page, touch: boolean): Promise<void> {
  const button = page.locator('.prompt.armed > button').first();
  await expect(button).toBeEnabled();
  if (touch) await button.dispatchEvent('click'); else { await focusWorld(page); await page.keyboard.press('KeyE'); }
}

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`the surface with height (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });
    test.setTimeout(240_000);

    test('mantle a ledge, climb a tree, reach the summit cairn; the cache pays once across a reload', async ({ page }) => {
      await seed(page, { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null }, 'preferred-language': 'en' });
      await toQuarry(page, touch);
      const c = controls(page, touch);

      // 1. The low shelf: run at its west face and jump; the hands catch the lip and pushing on mantles.
      await mantleLow(page, c);
      await expect(canvas(page)).toHaveAttribute('data-climb', 'free');
      // The mantle sets the Keeper down just inside the lip, already at the cache.
      const before = await gold(page);
      await expect(page.locator('.prompt.armed strong')).toContainText('Open the courier cache');
      await useFind(page, touch);
      await expect.poll(() => gold(page), { timeout: 15000 }).toBeGreaterThan(before);
      await expect.poll(() => found(page)).toContain('ember-quarry:low-cache');
      const afterCache = await gold(page);
      await expect(page.locator('.prompt.armed strong')).toContainText('Cache already opened');

      // 2. The tree: walk off the shelf to the trunk and hold Jump; it climbs into the canopy.
      await c.walkTo(X0 + 380, 10);
      await untilY(page, 610);
      await c.toTrunk(X0 + 380);
      await c.down('jump');
      await untilY(page, CANOPY);
      await c.up('jump');

      // 3. The summit route.
      await c.walkTo(X0 + 1400, 10);
      await untilY(page, 610);
      await c.toTrunk(X0 + 1400);
      await c.down('jump');
      await untilY(page, SNAG_TOP);
      await expect(canvas(page)).toHaveAttribute('data-climb', 'climb');
      await c.down('right'); await c.repress('jump');         // the wall-jump east, caught on the block's lip
      await settleGrab(page, c, BLOCK);
      await c.toTrunk(X0 + 1530 + 100);                        // short steps to the block's east end
      await c.down('jump'); await c.down('right');             // up onto the slab
      await untilY(page, SLAB);
      await c.up('jump');
      await expect.poll(() => playerX(page), { timeout: 8000, intervals: [20] }).toBeGreaterThanOrEqual(X0 + 1900 - 19); // at the spire's foot
      await c.up('right');
      await c.down('jump');                                    // catch its lip; Jump again mantles
      await settleGrab(page, c, SPIRE);
      await c.releaseAll();
      await expect(page.locator('.prompt.armed strong')).toContainText('Add your stone');
      await useFind(page, touch);
      await expect(page.locator('.objective')).toContainText('Cinder Ridgewalker');
      await expect.poll(() => found(page)).toContain('ember-quarry:summit');
      await expect.poll(() => gold(page), { timeout: 15000 }).toBeGreaterThan(afterCache);
      await page.screenshot({ path: `output/surface/${label}-summit.png` });

      // 4. Reload: the summit is saved, the cache stays opened and pays nothing again.
      await page.waitForTimeout(1500);
      await page.reload();
      await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
      expect(await found(page)).toEqual(expect.arrayContaining(['ember-quarry:low-cache', 'ember-quarry:summit']));
      if ((await canvas(page).getAttribute('data-area')) !== 'Ember Quarry') await toQuarry(page, touch);
      else await focusWorld(page);
      const reloaded = await gold(page);
      const c2 = controls(page, touch);
      await mantleLow(page, c2);
      await expect(page.locator('.prompt.armed strong')).toContainText('Cache already opened');
      await expect(page.locator('.prompt.armed > button').first()).toBeDisabled();
      expect(await gold(page)).toBe(reloaded);
    });
  });
}
