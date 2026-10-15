/**
 * play-world-clock.spec.ts — the world clock, played (docs/handoff/world-clock.md).
 *
 * A Keeper carrying a Mirror Slate stands at the Rootglass Canopy's root path.
 * The world clock is driven through its test hook (`window.__eclipseClock`,
 * only there under automation; the skew lives in sessionStorage so a reload
 * keeps it): noon → the Slate's phone face shows the time, the day and the
 * sky, and counts down to the next eclipse; in the Rootglass Thicket the
 * Moonwake Bloom is a shut bud; dusk tints the sky; at night it opens and is
 * cut; under an eclipse the sky goes dark, the Eclipse Glass outcrop rises and
 * is mined, Sera Quill's ledger writes the eclipse down once, and the Slate's
 * widget reads "Eclipse now"; a reload keeps the sky and pays nothing twice.
 * At 1280×800 (keys) and 390×844 (touch, 44 px targets). Screenshots in
 * output/world-clock/ (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, canvas, focusWorld, messageLine, openPlay, placePanel, seed, stackQty, walkTo, ERA } from './play-helpers';

const SEEDED = {
  'preferred-language': 'en',
  ...bag({ 'mirror-slate': 1 }),
  // The beacon is lit; the Keeper last stood in the Rootglass Canopy (the play view's own save).
  'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null },
  'eclipse-play-world-v1': { town: 'verdant' },
};
/** world-clock.model: day 1 has no eclipse; every fifth day from day 2 does (10:00–18:00). */
const CALM_DAY = 1;
const MOONWAKE_X = 880;
const GLASS_X = 620;

const shot = (page: Page, name: string) => page.screenshot({ path: `output/world-clock/${name}.png` });

async function setClock(page: Page, day: number, minute: number): Promise<void> {
  await page.evaluate(([d, m]) => (window as unknown as { __eclipseClock: { to(d: number, m: number): void } }).__eclipseClock.to(d, m), [day, minute]);
}
async function toEclipse(page: Page, minute = 14 * 60): Promise<void> {
  await page.evaluate(m => (window as unknown as { __eclipseClock: { toEclipse(m: number): void } }).__eclipseClock.toEclipse(m), minute);
}
async function sky(page: Page): Promise<string | null> { return canvas(page).getAttribute('data-sky'); }
async function act(page: Page, phone: boolean): Promise<void> {
  const button = page.locator('.prompt.armed > button').first();
  await expect(button).toBeEnabled();
  if (phone) await button.click(); else { await focusWorld(page); await page.keyboard.press('KeyE'); }
}
async function openSlate(page: Page, phone: boolean): Promise<void> {
  if (phone) await page.locator('.slate-btn').click();
  else { await focusWorld(page); await page.keyboard.press('KeyP'); }
  await expect(placePanel(page)).toHaveClass(/place--slate/);
  await expect(placePanel(page).locator('[data-slate-clock]')).toBeVisible();
}
async function closeSlate(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(placePanel(page)).toBeHidden();
}
async function ledger(page: Page): Promise<{ seen: number[]; marks: string[] }> {
  const raw = await blob<{ v?: { seen: number[]; marks: string[] }; seen?: number[]; marks?: string[] }>(page, 'godforge-eclipse');
  const v = raw?.v ?? raw;
  return { seen: v?.seen ?? [], marks: v?.marks ?? [] };
}
async function atLeast44(page: Page, selector: string): Promise<void> {
  // Polled: the panel opens with a small scale-in, so the first frame measures a hair under its size.
  for (const el of await placePanel(page).locator(selector).all()) {
    await expect.poll(async () => { const box = (await el.boundingBox())!; return Math.min(box.width, box.height); }, { message: selector }).toBeGreaterThanOrEqual(44);
  }
}

for (const size of [{ tag: '1280x800', width: 1280, height: 800, phone: false }, { tag: '390x844', width: 390, height: 844, phone: true }]) {
  test(`${size.tag}: the world clock — the Slate shows the time, night opens the Moonwake, an eclipse darkens the sky and is written down once`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await seed(page, SEEDED);
    // The clock is real time: pin it before the world opens, or a real eclipse in progress would be witnessed first.
    await page.evaluate(ms => sessionStorage.setItem('eclipse-clock-skew', String(ms - Date.now())), Date.UTC(2026, 0, 1) + CALM_DAY * 1_440_000 + 12 * 60 * 1000);
    await openPlay(page, '?at=passage');
    await setClock(page, CALM_DAY, 12 * 60);
    await expect.poll(() => sky(page), { timeout: 10000 }).toBe('day');

    // ── The Slate is a phone: the big time, the day, the sky, the next eclipse counting down ──
    await openSlate(page, size.phone);
    const panel = placePanel(page);
    await expect(panel.locator('[data-world-time]')).toHaveText(/^12:\d\d$/);
    await expect(panel.locator('.ph-date')).toContainText('Lightday');
    await expect(panel.locator('[data-sky-label]')).toHaveText('Day');
    await expect(panel.locator('[data-eclipse-countdown]')).toContainText('Next eclipse in');
    await expect(panel.locator('[data-now-playing]')).toContainText('Now playing');
    await expect(panel.locator('.sl-tile--game')).toHaveText(['Reels', 'Rune Drop', 'Seam Sweeper', 'Eclipse Ascent']);
    await expect(panel.locator('.sl-tile[data-face="factory"]')).toBeVisible();
    await expect(panel.locator('.sl-tile[data-app="pets"]')).toBeVisible();
    await expect(panel.locator('.sl-tile[data-app="codex"]')).toBeVisible();
    await expect(panel.locator('.ph-dock__app')).toHaveCount(4);
    if (size.phone) await atLeast44(page, '.sl-tile, .ph-dot, .ph-dock__app, .ph-round, [data-eclipse-widget]');
    await page.waitForTimeout(400);
    await shot(page, `${size.width}-slate-day`);
    // Page 2: the calendar (eclipse days marked) and Sera's ledger; back to page 1.
    await panel.locator('[data-page-dot="1"]').click();
    await expect(panel.locator('[data-slate-calendar] .ph-cal__day.is-eclipse')).not.toHaveCount(0);
    await expect(panel.locator('[data-slate-ledger]')).toContainText('0 eclipses observed');
    await page.waitForTimeout(400);
    await shot(page, `${size.width}-slate-calendar`);
    await panel.locator('[data-page-dot="0"]').click();
    await closeSlate(page);

    // ── Through the root path to the Rootglass Thicket: by day the Moonwake is a shut bud ──
    await act(page, size.phone);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Rootglass Thicket', { timeout: 30000 });
    await page.waitForTimeout(400);
    await walkTo(page, MOONWAKE_X, 30);
    await expect(canvas(page)).toHaveAttribute('data-timed', '');
    await expect(page.locator('.prompt.armed')).toContainText('opens at night');
    await expect(page.locator('.prompt.armed > button').first()).toBeDisabled();
    await shot(page, `${size.width}-1-day`);

    // ── Dusk: the sky warms and darkens ──
    await setClock(page, CALM_DAY, 19 * 60);
    await expect.poll(() => sky(page), { timeout: 10000 }).toBe('dusk');
    await page.waitForTimeout(300);
    await shot(page, `${size.width}-2-dusk`);

    // ── Night: the Moonwake opens and is cut ──
    await setClock(page, CALM_DAY, 23 * 60);
    await expect.poll(() => sky(page), { timeout: 10000 }).toBe('night');
    await expect(canvas(page)).toHaveAttribute('data-timed', 'moonwake', { timeout: 10000 });
    await walkTo(page, MOONWAKE_X, 30);
    await act(page, size.phone);
    await expect.poll(() => stackQty(page, 'moonwake-bloom'), { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(300);
    await shot(page, `${size.width}-3-night`);

    // ── An eclipse: the sky goes dark at noon, the glass rises, Sera's ledger writes it down once ──
    await toEclipse(page, 13 * 60);
    await expect.poll(() => sky(page), { timeout: 10000 }).toBe('eclipse');
    await expect(canvas(page)).toHaveAttribute('data-timed', /eclipse-glass/, { timeout: 10000 });
    await expect.poll(async () => (await ledger(page)).seen.length, { timeout: 10000 }).toBe(1);
    expect((await ledger(page)).marks).toEqual(['eclipse:mark-1']);
    await expect.poll(() => stackQty(page, 'eclipse-glass'), { timeout: 10000 }).toBe(2);
    await expect(messageLine(page)).toContainText(/ledger|eclipse/i);
    await walkTo(page, GLASS_X, 30);
    for (let i = 0; i < 6 && (await stackQty(page, 'eclipse-glass')) < 3; i++) { await act(page, size.phone); await page.waitForTimeout(450); }
    expect(await stackQty(page, 'eclipse-glass')).toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(300);
    await shot(page, `${size.width}-4-eclipse`);

    // The Slate counts it: "Eclipse now", and the eclipse app lists the ledger.
    await openSlate(page, size.phone);
    await expect(panel.locator('[data-eclipse-widget]')).toHaveAttribute('data-eclipse-on', 'true');
    await expect(panel.locator('[data-eclipse-countdown]').first()).toContainText('Eclipse now');
    await expect(panel.locator('[data-sky-label]')).toHaveText('Eclipse');
    await page.waitForTimeout(400);
    await shot(page, `${size.width}-slate-eclipse`);
    await panel.locator('[data-eclipse-widget]').click();
    await expect(panel.locator('.sl-eclipse [data-ledger-count]')).toHaveText('1 eclipses observed');
    await expect(panel.locator('.sl-eclipse [data-effect]')).toHaveCount(6);
    if (size.phone) await atLeast44(page, '.sl-back');
    await page.waitForTimeout(400);
    await shot(page, `${size.width}-slate-eclipse-app`);
    await closeSlate(page);

    // ── A reload: the same sky (the clock is real time; the test skew stays in this tab), nothing paid twice ──
    const glass = await stackQty(page, 'eclipse-glass');
    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
    await expect.poll(() => sky(page), { timeout: 10000 }).toBe('eclipse');
    await page.waitForTimeout(2500);
    const after = await ledger(page);
    expect(after.seen.length).toBe(1);
    expect(after.marks).toEqual(['eclipse:mark-1']);
    expect(await stackQty(page, 'eclipse-glass')).toBe(glass);
  });
}
