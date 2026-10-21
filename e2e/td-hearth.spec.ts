/**
 * td-hearth.spec.ts — the Cold Hearth (design-bible §5.8, roadmap §10 item 5), desktop and phone. A level-30 Keeper with
 * Gold lights the Basalt Seamworks hearth (E at the fire: it takes the flame, the wake point is saved per character),
 * buys a Hearth Blessing at the shrine beside it, walks off and falls (the engine's test hook `?fxfall=1`, honoured
 * only under an automated browser): the world goes dark, they wake at that hearth, the wake card says what it cost
 * (a share of the purse left where they fell, the Ember debt in the HUD, the blessing burned away), and walking back
 * to the purse brings the Gold home. Nothing else is lost: no item, no level.
 * Screenshots: docs/handoff/cozy-ui/hearth-{lit,wake,purse,shrine}{,-phone}.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

const canvas = (page: Page) => page.locator('canvas').first();
const blob = (page: Page, key: string) => page.evaluate(k => {
  const raw = JSON.parse(localStorage.getItem(k) || 'null');
  return raw && typeof raw === 'object' && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
}, key);
const gold = async (page: Page) => Number((await blob(page, 'godforge-economy'))?.gold ?? 0);
const hook = (page: Page, call: string) => page.evaluate(c => {
  const h = (window as unknown as { __tdHearth?: Record<string, (...a: unknown[]) => unknown> }).__tdHearth;
  if (!h) throw new Error('no __tdHearth hook');
  const [name, arg] = c.split(':');
  return h[name](arg);
}, call);

const SIZES = [
  { name: '', width: 1280, height: 800, phone: false },
  { name: '-phone', width: 390, height: 844, phone: true },
];

for (const size of SIZES) {
  test(`the Cold Hearth: light it, bless it, fall, wake by it, walk back for the purse${size.phone ? ' (phone)' : ''}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
    const act = emptyActivityLedger();
    act.progress.xpByDiscipline = { hunting: keeperXpForLevel(30) + 500 } as typeof act.progress.xpByDiscipline;
    await seed(page, {
      'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'godforge-activity': act,
      'godforge-economy': { version: 3, goldEra: 1, gold: 20_000, totalGoldEarned: 20_000, runGoldEarned: 20_000 },
    });
    await page.goto('/play?td=1&hour=21&fxfall=1');
    await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
    await expect.poll(() => page.evaluate(() => !!(window as unknown as { __tdHearth?: unknown }).__tdHearth), { timeout: 10000 }).toBe(true);

    // ── Lighting the hearth: stand at the cold fire, E. ──
    const fire = await hook(page, 'at:hearth');
    expect(fire).toBe('hearth:ember-isle:basalt-seamworks');
    await expect(canvas(page)).toHaveAttribute('data-hearth-near', 'hearth:ember-isle:basalt-seamworks', { timeout: 5000 });
    await canvas(page).focus();
    await page.keyboard.press('e');
    await expect(canvas(page)).toHaveAttribute('data-hearth-wake', 'hearth:ember-isle:basalt-seamworks', { timeout: 5000 });
    await expect(canvas(page)).toHaveAttribute('data-hearths-lit', '1');
    await expect.poll(async () => (await blob(page, 'godforge-hearth'))?.wake).toBe('hearth:ember-isle:basalt-seamworks');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `docs/handoff/cozy-ui/hearth-lit${size.name}.jpg`, type: 'jpeg', quality: 86 });

    // ── The shrine beside it: the five blessings, one plain button each. ──
    await hook(page, 'at:shrine');
    await expect(canvas(page)).toHaveAttribute('data-hearth-near', /^shrine:ember-isle:/, { timeout: 5000 });
    await canvas(page).focus();
    await page.keyboard.press('e');
    const shrine = page.locator('[data-hearth-shrine]');
    await expect(shrine).toBeVisible({ timeout: 5000 });
    await expect(shrine.locator('[data-blessing]')).toHaveCount(5);
    // The price is on the button (one minute of a level-30 hunt); the purchase flushes the wallet at once.
    const price = Number((await shrine.locator('[data-blessing="pyre"] button').innerText()).replace(/\D/g, ''));
    expect(price).toBeGreaterThan(0);
    await shrine.locator('[data-blessing="pyre"] button').click();
    await expect(shrine).toHaveAttribute('data-blessings', '1');
    await expect(shrine.locator('[data-blessing="pyre"]')).toContainText('Kindled');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `docs/handoff/cozy-ui/hearth-shrine${size.name}.jpg`, type: 'jpeg', quality: 86 });
    await page.locator('.place-close').click();
    await expect(shrine).toBeHidden();

    // ── Walk off a little, then fall. ──
    await canvas(page).focus();
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(900);
    await page.keyboard.up('ArrowDown');
    const fellAt = Number(await canvas(page).getAttribute('data-player-y'));
    await hook(page, 'fall');
    await expect(canvas(page)).toHaveAttribute('data-waking', /out|in/, { timeout: 3000 });
    const card = page.locator('[data-wake-card]');
    await expect(card).toBeVisible({ timeout: 8000 });
    await expect(canvas(page)).toHaveAttribute('data-waking', '', { timeout: 8000 });
    await expect(card).toHaveAttribute('data-wake-hearth', 'true');
    await expect(card).toContainText('Basalt Seamworks');
    // 5% of the purse, less a fifth for the one blessing, left where the Keeper fell (the spend flushes the wallet).
    const share = Number((await card.locator('[data-wake-purse]').innerText()).match(/(\d+) Gold/)?.[1] ?? 0);
    const carried = await gold(page) + share;
    expect(share).toBeGreaterThan(0);
    expect(share).toBe(Math.floor(carried * 0.05 * 0.8));
    await expect(card.locator('[data-wake-blessed]')).toBeVisible();
    await expect(card.locator('[data-wake-debt]')).toBeVisible();
    await expect(page.locator(size.phone ? '[data-ember-debt-orb]' : '[data-ember-debt]')).toBeVisible();
    const hearth = await blob(page, 'godforge-hearth');
    expect(hearth.blessings).toEqual([]);
    expect(hearth.debt).toBeGreaterThan(0);
    await expect(canvas(page)).toHaveAttribute('data-fallen-purse', /here|away/);
    // No level lost: the badge still reads 30.
    if (!size.phone) await expect(page.locator('[data-keeper-level]')).toHaveText('30');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `docs/handoff/cozy-ui/hearth-wake${size.name}.jpg`, type: 'jpeg', quality: 86 });
    await card.locator('button').click();
    await expect(card).toBeHidden();

    // ── The purse where they fell: walk back for it. ──
    expect(fellAt).toBeGreaterThan(0);
    await expect(canvas(page)).toHaveAttribute('data-fallen-purse', 'here');
    // Back to where the walk began (beside the shrine), and down the same way.
    await hook(page, 'at:shrine');
    await canvas(page).focus();
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowDown');
    // Let the place-name card fade before the picture.
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `docs/handoff/cozy-ui/hearth-purse${size.name}.jpg`, type: 'jpeg', quality: 86 });
    await page.keyboard.down('ArrowDown');
    await expect(canvas(page)).toHaveAttribute('data-fallen-purse', '', { timeout: 8000 });
    await page.keyboard.up('ArrowDown');
    await expect.poll(() => gold(page), { timeout: 12000 }).toBe(carried);
  });
}
