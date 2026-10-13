/**
 * play-minigames.spec.ts — the Smithing anvil game and the Enchanting rune
 * ritual, played inside the world's Crafting Bench and Enchanting Table.
 *
 * Timing: both games move a marker with requestAnimationFrame and write its
 * position to one CSS custom property (`--pos` on the anvil marker, `--s` on
 * the ritual pulse). A press from Node lands tens of ms late, which is a whole
 * Perfect zone, so the press is fired from the page's own frame loop the moment
 * the marker is where a player would aim: a real pointerdown on the real button.
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, openPlay, purse, seed } from './play-helpers';

const KRIS = 'Briarvein Kris';
const KRIS_BAG = { thornroot: 24, 'verdant-sap': 12, 'world-root-bark': 8 };

const panel = (page: Page) => page.locator('section.place');

/**
 * Wait (in the page) for the marker, then press `target`.
 *
 * `centre` / `one` aim at a point: frames are too coarse under load (a dropped
 * frame skips the whole Perfect zone), so the loop measures the marker's speed
 * between frames and fires a timer for the predicted moment it crosses the
 * point. `edge` / `far` aim at a wide band and fire on the first frame inside it.
 */
async function pressWhen(page: Page, marker: string, prop: string, aim: 'centre' | 'edge' | 'one' | 'far', target: string): Promise<number> {
  return page.evaluate(({ marker, prop, aim, target }) => new Promise<number>((resolve, reject) => {
    const until = performance.now() + 15000;
    const point = aim === 'centre' ? 0.5 : aim === 'one' ? 1 : NaN;
    let prev: { v: number; t: number } | null = null;
    const fire = (v: number) => {
      const btn = document.querySelector<HTMLElement>(target);
      if (!btn) { reject(new Error(`no ${target}`)); return; }
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }));
      resolve(v);
    };
    const loop = () => {
      const el = document.querySelector<HTMLElement>(marker);
      const v = el ? parseFloat(el.style.getPropertyValue(prop)) : NaN;
      const t = performance.now();
      if (Number.isFinite(v)) {
        if (aim === 'edge' && (v < 0.2 || v > 0.8)) { fire(v); return; }
        if (aim === 'far' && v > 1.45) { fire(v); return; }
        if (!Number.isNaN(point) && prev && t > prev.t) {
          const speed = (v - prev.v) / (t - prev.t);
          const eta = speed !== 0 ? (point - v) / speed : Infinity;
          if (eta >= 0 && eta < 60) { setTimeout(() => fire(point), eta); return; }
        }
        prev = { v, t };
      }
      if (t > until) { reject(new Error(`marker ${prop} never reached ${aim} (last ${v})`)); return; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }), { marker, prop, aim, target });
}

async function openBench(page: Page): Promise<void> {
  await seed(page, { ...bag(KRIS_BAG), ...purse(3_000_000) });
  await openPlay(page, '?at=crafting');
  await expect(panel(page).locator('.cb-hero')).toBeVisible({ timeout: 15000 });
  await expect(panel(page).locator('.cb-hero .dh__name')).toHaveText(KRIS);
}

async function startCraft(page: Page): Promise<void> {
  await panel(page).locator('.cb-hero .ab__btn').click();
  await expect(panel(page).locator('app-anvil-game .mg__go')).toBeVisible();
}

async function playAnvil(page: Page, aim: 'centre' | 'edge'): Promise<string> {
  for (let i = 0; i < 4; i++) {
    await pressWhen(page, 'app-anvil-game .mg-bar__marker', '--pos', aim, 'app-anvil-game .mg__go');
    await expect(panel(page).locator('app-anvil-game .mg-pip[data-grade]')).toHaveCount(i + 1);
  }
  const grade = panel(page).locator('app-anvil-game .mg__grade');
  await expect(grade).toContainText('Quality');
  return (await grade.textContent()) ?? '';
}

function pct(text: string): number { return Number(/Quality (\d+)%/.exec(text)?.[1] ?? NaN); }
function smithXp(text: string): number { return Number(/\+(\d+) Smithing XP/.exec(text)?.[1] ?? 0); }

test.describe('Anvil mini-game, played', () => {
  test.describe.configure({ timeout: 90000 });

  test('four Perfect strikes: quality 100% and the top Smithing XP bonus', async ({ page }) => {
    await openBench(page);
    await startCraft(page);
    const result = await playAnvil(page, 'centre');
    expect(pct(result)).toBe(100);
    await expect(panel(page).locator('app-anvil-game .mg-pip[data-grade="perfect"]')).toHaveCount(4);
    const reward = panel(page).locator('app-reward-pop .rp');
    await expect(reward).toContainText(KRIS, { timeout: 10000 });
    expect(smithXp(await reward.textContent() ?? '')).toBe(40);
  });

  test('four Off strikes: low quality and a smaller bonus', async ({ page }) => {
    await openBench(page);
    await startCraft(page);
    const result = await playAnvil(page, 'edge');
    expect(pct(result)).toBeLessThanOrEqual(20);
    await expect(panel(page).locator('app-anvil-game .mg-pip[data-grade="off"]')).toHaveCount(4);
    const reward = panel(page).locator('app-reward-pop .rp');
    await expect(reward).toContainText(KRIS, { timeout: 10000 });
    const xp = smithXp(await reward.textContent() ?? '');
    expect(xp).toBeGreaterThan(0);
    expect(xp).toBeLessThan(40);
  });

  test("Skip is today's craft: the timed beat, the item, no anvil bonus", async ({ page }) => {
    await openBench(page);
    await startCraft(page);
    await panel(page).locator('app-anvil-game .mg__skip').click();
    await expect(panel(page).locator('app-anvil-game')).toHaveCount(0);
    const reward = panel(page).locator('app-reward-pop .rp');
    await expect(reward).toContainText(KRIS, { timeout: 15000 });
    expect(await reward.textContent()).not.toContain('Smithing XP');
    const items = await blob<{ records?: { definitionId?: string }[] }>(page, 'godforge-inventory');
    expect((items?.records ?? []).filter(r => r.definitionId === 'briarvein-kris')).toHaveLength(1);
  });

  test('at 390 px the NPC bubble yields and Skip is the element under its own centre', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBench(page);
    await startCraft(page);
    await expect(page.locator('app-npc-dialogue .npc')).toHaveCount(0);
    const skip = panel(page).locator('app-anvil-game .mg__skip');
    await skip.scrollIntoViewIfNeeded();
    const hit = await skip.evaluate(el => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!at && (at === el || el.contains(at));
    });
    expect(hit).toBe(true);
    await skip.click();
    await expect(panel(page).locator('app-anvil-game')).toHaveCount(0);
  });
});

test('routed /forge/crafting at 390 px: Kael yields while the anvil is open, Skip is hit-testable, and he returns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { ...bag(KRIS_BAG), ...purse(3_000_000) });
  await page.goto('/forge/crafting');
  const npc = page.locator('app-npc-dialogue .npc');
  await expect(npc).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.cb-hero .dh__name')).toHaveText(KRIS, { timeout: 15000 });
  await page.locator('.cb-hero .ab__btn').click();
  const skip = page.locator('app-anvil-game .mg__skip');
  await expect(skip).toBeVisible();
  await expect(npc).toHaveCount(0);
  // The corner Forge Flame steps aside too: on a phone it is centred at the
  // bottom and its mode switch sat right where a scrolled-to Skip lands.
  await expect(page.locator('app-forge-flame .ff')).toBeHidden();
  // Every phone width the layout claims, not just the one the test opened at.
  for (const width of [390, 360, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await skip.scrollIntoViewIfNeeded();
    const hit = await skip.evaluate(el => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!at && (at === el || el.contains(at));
    });
    expect(hit, `Skip is the element under its own centre at ${width} px`).toBe(true);
  }
  await skip.click();
  await expect(page.locator('app-anvil-game')).toHaveCount(0);
  await expect(npc).toBeVisible();
  await expect(page.locator('app-forge-flame .ff')).toBeVisible();
});

test.describe('In-world panel focus', () => {
  test('closing a place with Escape hands focus back to the game canvas, not <body>', async ({ page }) => {
    await seed(page, { ...bag(KRIS_BAG), ...purse(3_000_000) });
    await openPlay(page, '?at=crafting');
    await expect(panel(page).locator('.cb-hero')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden({ timeout: 5000 });
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName), { timeout: 3000 }).toBe('CANVAS');
  });

  test('a place opened from a keyboard-focused control returns focus to that control', async ({ page }) => {
    await seed(page, { ...bag(KRIS_BAG), ...purse(3_000_000) });
    await openPlay(page);
    // Tab onto the Places toggle (focus-visible), then Enter: the list opens and focuses its first row.
    await page.locator('.places-toggle').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#places-list')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#places-list')).toHaveCount(0);
    await expect(page.locator('.places-toggle')).toBeFocused();
  });
});

test.describe('Rune ritual, played', () => {
  test.describe.configure({ timeout: 120000 });

  test('a miss costs nothing and retries; a hit sockets the rune and pays Enchanting XP', async ({ page }) => {
    await seed(page, {
      ...bag(KRIS_BAG), ...purse(3_000_000),
      'godforge-runes': { version: 1, runes: { 'ash': 2 }, firstFound: {}, strikes: 0, goldSpent: 0 },
    });
    // Forge the Kris first (skipping the anvil), so there is a weapon with an empty well.
    await openPlay(page, '?at=crafting');
    await expect(panel(page).locator('.cb-hero .dh__name')).toHaveText(KRIS, { timeout: 15000 });
    await startCraft(page);
    await panel(page).locator('app-anvil-game .mg__skip').click();
    await expect(panel(page).locator('app-reward-pop .rp')).toContainText(KRIS, { timeout: 15000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);

    await openPlay(page, '?at=enchanting');
    await expect(panel(page).locator('app-station-shell.eb')).toBeVisible({ timeout: 15000 });
    await panel(page).locator('app-journal-list .jl__row', { hasText: KRIS }).first().click();
    await panel(page).locator('app-requirement-grid button.rg__cell').first().click();
    const add = panel(page).locator('.eb-detail app-action-button .ab__btn');
    await expect(add).not.toHaveAttribute('aria-disabled', 'true');
    await add.click();
    const ritual = panel(page).locator('app-rune-ritual');
    await expect(ritual).toBeVisible();
    // Beat 1: tap the rune onto the circle.
    await ritual.locator('.mg-token').click();
    await expect(ritual.locator('.mg--ritual')).toHaveAttribute('data-phase', 'pulse');
    // Beat 2, first try: tap while the light is still far out — a miss.
    await pressWhen(page, 'app-rune-ritual .mg-circle__pulse', '--s', 'far', 'app-rune-ritual .mg-circle');
    await expect(ritual.locator('.mg__how')).toContainText('Almost');
    await expect(ritual.locator('.mg--ritual')).toHaveAttribute('data-phase', 'pulse');
    const runesAfterMiss = await blob<{ runes: Record<string, number> }>(page, 'godforge-runes');
    expect(runesAfterMiss?.runes['ash']).toBe(2);
    // Second try: tap as the light meets the gold ring — a hit.
    await pressWhen(page, 'app-rune-ritual .mg-circle__pulse', '--s', 'one', 'app-rune-ritual .mg-circle');
    await expect(ritual.locator('.mg--ritual')).toHaveAttribute('data-phase', 'hit');
    await expect(panel(page)).toContainText('Enchanting XP', { timeout: 10000 });
    await expect.poll(async () => (await blob<{ runes: Record<string, number> }>(page, 'godforge-runes'))?.runes['ash']).toBe(1);
    const inv = await blob<{ records?: { definitionId?: string; sockets?: (string | null)[] }[] }>(page, 'godforge-inventory');
    const kris = (inv?.records ?? []).find(r => r.definitionId === 'briarvein-kris');
    expect(kris?.sockets).toContain('ash');
  });
});
