/**
 * td-quick-belt.spec.ts — every usable stack on a hotkey (shared/belt; docs/design/verb-matrix.md "Belt / hotkey"), and
 * the D2-style status badges over heads (play/td/td-status-icons.ts).
 *
 * The owner's report (2026-11-02): cooked fish would not go on a hotkey. Desktop: the meal dragged from the satchel onto
 * the bar's first item hotkey, eaten with 9, the count on the glass, greyed at none, filled again by a pickup; a potion
 * put on the next one by its card. Phone (390×844): tap the meal, tap the satchel's belt slot, tap the HUD's slot.
 * The badges: the Keeper and a creature at once, Isometric and Classic, 1280×800 and 390×844 (shots in output/quickwins/).
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed, stackQty } from './play-helpers';

const MEAL = 'baked-ash-perch';
const BAG = { [MEAL]: 2, 'minor-health-potion': 1, 'waygate-scroll': 1, 'cinder-ore': 3 };
const OUT = 'output/quickwins';
const shot = async (page: Page, name: string) => { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); };

async function open(page: Page, query = ''): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), 'godforge-inventory': ledger(BAG) });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
  await page.waitForTimeout(600);
  if (await page.locator('.menu-scrim').count()) await page.locator('.menu-scrim').click({ position: { x: 4, y: 4 } }).catch(() => undefined);
}
/** A stack arriving through the real satchel path (the play view's `?fxgrid=1` hook). */
const arrive = (page: Page, key: string, n: number) => page.evaluate(([k, q]) => (window as unknown as { __tdGrid: { stack(k: string, n: number): boolean } }).__tdGrid.stack(k as string, q as number), [key, n] as const);

async function dragTo(page: Page, from: ReturnType<Page['locator']>, to: ReturnType<Page['locator']>): Promise<void> {
  const a = (await from.boundingBox())!, b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 24, a.y + 24, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('cooked fish dragged onto a hotkey: 9 eats it, the count shows, greys at none, a pickup fills it again', async ({ page }) => {
    test.setTimeout(90000);
    await open(page, '&fxgrid=1');
    await page.keyboard.press('i');
    const piece = page.locator(`#satchel-book [data-grid="b"] [data-stack="${MEAL}"]`).first();
    await expect(piece).toBeVisible({ timeout: 10000 });
    const slot = page.locator('[data-hud-bar] .td-quick[data-quick="0"]');
    await expect(slot).toBeVisible();
    await dragTo(page, piece, slot);
    await expect(slot).toHaveAttribute('data-quick-key', MEAL, { timeout: 5000 });
    await expect(slot).toHaveAttribute('data-quick-n', '2');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await shot(page, 'hotkey-food-1280');
    await page.keyboard.press('9');
    await expect.poll(() => stackQty(page, MEAL)).toBe(1);
    await expect(slot).toHaveAttribute('data-quick-n', '1');
    await expect(page.locator('.td-toast')).toContainText(/Baked Ash Perch/i);
    await page.keyboard.press('9');
    await expect.poll(() => stackQty(page, MEAL)).toBe(0);
    // None left: the slot keeps the meal, greyed.
    await expect(slot).toHaveAttribute('data-quick-n', '0');
    await expect(slot).toHaveClass(/td-quick--out/);
    await expect(slot).toHaveAttribute('data-quick-key', MEAL);
    await page.keyboard.press('9');
    await expect(page.locator('.td-toast')).toContainText(/No Baked Ash Perch left/i);
    // More arrive (as a catch cooked or a pickup would): it fills again by itself.
    await arrive(page, MEAL, 3);
    await expect(slot).toHaveAttribute('data-quick-n', '3', { timeout: 5000 });
    await expect(slot).not.toHaveClass(/td-quick--out/);
    // The slot survives a reload (it rides the settings blob).
    await page.reload();
    await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    await expect(page.locator('[data-hud-bar] .td-quick[data-quick="0"]')).toHaveAttribute('data-quick-key', MEAL, { timeout: 10000 });
  });

  test('the card\'s "Put on hotkey": a potion and a Town Portal scroll, each on the next free key; ore has no hotkey', async ({ page }) => {
    test.setTimeout(90000);
    await open(page);
    await page.keyboard.press('i');
    for (const [key, slotN] of [['minor-health-potion', '0'], ['waygate-scroll', '1']] as const) {
      await page.locator(`#satchel-book [data-grid="b"] [data-stack="${key}"]`).first().click();
      const put = page.locator('.d2tip--pinned [data-quick-belt]');
      await expect(put).toHaveText('Put on hotkey');
      await put.click();
      await expect(page.locator(`#satchel-book .book-belt__quick[data-belt="quick${slotN}"]`)).toHaveAttribute('data-quick-key', key);
      await expect(put).toHaveText('Off the hotkey');
      await page.locator('.d2tip--pinned .d2tip__close').click();
    }
    await page.locator('#satchel-book [data-grid="b"] [data-stack="cinder-ore"]').first().click();
    await expect(page.locator('.d2tip--pinned')).toBeVisible();
    await expect(page.locator('.d2tip--pinned [data-quick-belt]')).toHaveCount(0);
    await page.locator('.d2tip--pinned .d2tip__close').click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('9');
    await expect.poll(() => stackQty(page, 'minor-health-potion')).toBe(0);
    await expect(page.locator('[data-hud-bar] .td-quick[data-quick="0"]')).toHaveClass(/td-quick--out/);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('tap the meal, tap the satchel belt\'s slot; the HUD\'s slot eats it at a tap', async ({ page }) => {
    test.setTimeout(90000);
    await open(page);
    // A portrait phone opens the satchel from the thumb HUD's Bag (docs/design/ui-pass-3.md §A.2).
    await (await page.locator('[data-th="bag"]').count() ? page.locator('[data-th="bag"]') : page.locator('.td-dock button').first()).tap();
    const piece = page.locator(`#satchel-book [data-grid="b"] [data-stack="${MEAL}"]`).first();
    await expect(piece).toBeVisible({ timeout: 10000 });
    await piece.tap();
    const bookSlot = page.locator('#satchel-book .book-belt__quick[data-belt="quick0"]');
    await bookSlot.tap();
    await expect(bookSlot).toHaveAttribute('data-quick-key', MEAL, { timeout: 5000 });
    // Its card stays one tap away, as before (a tap elsewhere puts the piece down).
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.keyboard.press('Escape').catch(() => undefined);
    const hud = page.locator('.td-belt .td-quick[data-quick="0"]');
    await expect(hud).toBeVisible({ timeout: 5000 });
    const box = (await hud.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await shot(page, 'hotkey-food-390');
    await hud.tap();
    await expect.poll(() => stackQty(page, MEAL)).toBe(1);
    await expect(hud).toHaveAttribute('data-quick-n', '1');
  });
});

/** A creature beside the Keeper (the Ashguard's fx hook), and statuses laid on both, kept topped up for the shot. */
async function badges(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __tdAsh: { foe(t?: string, dx?: number): number | null }; __tdStatus: { lay(): string }; __badgeT?: number };
    w.__tdAsh.foe('ash-wolf', 30);
    w.__tdStatus.lay();
    clearInterval(w.__badgeT); w.__badgeT = window.setInterval(() => w.__tdStatus.lay(), 200);
  });
}

for (const [label, query] of [['iso', '&artopt=iso'], ['classic', '&artopt=live']] as const) {
  for (const size of [{ name: '1280', use: { viewport: { width: 1280, height: 800 } } }, { name: '390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } }] as const) {
    test.describe(`status badges ${label} ${size.name}`, () => {
      test.use(size.use);
      test(`the Keeper and a creature show their badges (${label}, ${size.name})`, async ({ page }) => {
        test.setTimeout(90000);
        await open(page, query);
        await badges(page);
        const canvas = page.locator('.viewport canvas').first();
        await expect.poll(async () => (await canvas.getAttribute('data-status-badges')) ?? '', { timeout: 10000 }).toMatch(/me:burn,poison,curse,chill,shield/);
        // The creature: stunned, taunted, burning, bleeding… four shown, the rest as +N.
        await expect.poll(async () => (await canvas.getAttribute('data-status-badges')) ?? '', { timeout: 10000 }).toMatch(/m:[^;]+:stun,taunt,burn,bleed,curse,slow/);
        await page.waitForTimeout(400);
        await shot(page, `status-${label}-${size.name}`);
      });
    });
  }
}
