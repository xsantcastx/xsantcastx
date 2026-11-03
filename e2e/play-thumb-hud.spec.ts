/**
 * play-thumb-hud.spec.ts — the portrait phone's thumb-zone HUD (docs/design/ui-pass-3.md §A.2, Accept 1–7).
 *
 * Android Chrome emulated at 360×640 (compact) and 390×844 (regular), in Isometric and Classic graphics, in English and
 * Spanish, with a Keeper in the Seamworks square and one on a hunt with a creature targeted:
 *   1. no persistent HUD piece meets the play centre (0.25W–0.75W × 0.25H–0.75H);
 *   2. every HUD control is ≥ 44 px; the arc keys are 52 (regular) or 48 (compact), the disc 76 or 64;
 *   3. no two controls overlap (a hit test at the centre and four inner corners of each);
 *   4. the disc, the arc and the ⇅ chip lie within 300 px of the bottom-right corner, the belt and the bag row within
 *      300 px of the bottom-left;
 *   5. the disc says Attack with a hostile near and Enter at Edrin Kade's stall, where a tap opens the General Store and
 *      the ticker names the stall;
 *   6. ☰ More opens the tile sheet, every tile opens its window, and the sheet scrolls to its last tile at 360×640;
 *   7. the tutorial step is the goal chip, Glim's button is never covered, and Glim's line and the area title are
 *      ticker lines, never centre cards.
 * Landscape (844×390) keeps its own HUD: the thumb HUD is not drawn there.
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed, SKILLS_LEARNED } from './play-helpers';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const SIZES = [
  { name: '360x640', width: 360, height: 640, compact: true },
  { name: '390x844', width: 390, height: 844, compact: false },
];
const canvas = (page: Page) => page.locator('.viewport canvas');
const SHOTS = process.env['UIWA_SHOTS'] ?? '';

/** The persistent HUD pieces (Accept 1). */
const PIECES = ['.th-arc .th-key', '.th-page', '.th-disc', '.th-belt .th-slot', '.th-bag .th-btn', '.td-mini', '.td-orbs .td-orb', '.td-orbs .td-soul',
  '.th-face', '.glim-hud', '.guide', '.th-ticker', '.td-party'];
/** The HUD's controls (Accept 2, 3). */
const CONTROLS = ['.th-arc .th-key', '.th-page', '.th-disc', '.th-belt .th-slot', '.th-bag .th-btn', '.th-face', '.glim-hud', '.guide .guide-go', '.td-orbs .td-orb'];

async function boot(page: Page, opts: { gfx: string; lang: string; query?: string }): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { ...SKILLS_LEARNED, 'eclipse-td': '1', 'eclipse-td-graphics': opts.gfx, 'godforge-realm-era': String(ERA), 'preferred-language': opts.lang });
  await page.goto(`/play?td=1&hour=12${opts.query ?? ''}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await expect(page.locator('.stage.stage--thumb')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.th-disc')).toBeVisible();
  await page.waitForTimeout(800);
}

type Box = { sel: string; l: number; t: number; r: number; b: number; w: number; h: number; label: string };
const boxes = (page: Page, sels: string[]) => page.evaluate(ss => {
  const shown = (el: Element) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden' && !el.closest('[hidden]'); };
  return ss.flatMap(s => [...document.querySelectorAll(s)].filter(shown).map(el => {
    const r = el.getBoundingClientRect();
    return { sel: s, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, label: (el.getAttribute('aria-label') ?? el.className.toString()).slice(0, 40) };
  }));
}, sels) as Promise<Box[]>;

/** Accept 1–4 at the page as it stands. */
async function checkLayout(page: Page, size: { width: number; height: number; compact: boolean }, where: string): Promise<void> {
  const W = size.width, H = size.height;
  const c = { l: .25 * W, t: .25 * H, r: .75 * W, b: .75 * H };
  // 1. Nothing persistent in the play centre.
  for (const b of await boxes(page, PIECES)) {
    const meets = b.l < c.r - .5 && b.r > c.l + .5 && b.t < c.b - .5 && b.b > c.t + .5;
    expect(meets, `${where}: ${b.sel} "${b.label}" (${Math.round(b.l)},${Math.round(b.t)} ${Math.round(b.w)}×${Math.round(b.h)}) meets the play centre`).toBe(false);
  }
  const ctrls = await boxes(page, CONTROLS);
  expect(ctrls.length, `${where}: the HUD has its controls`).toBeGreaterThan(10);
  // 2. Every control at least 44; the arc 52 / 48, the disc 76 / 64.
  for (const b of ctrls) {
    expect(Math.min(b.w, b.h), `${where}: ${b.sel} "${b.label}" is ${Math.round(b.w)}×${Math.round(b.h)}`).toBeGreaterThanOrEqual(43.5);
  }
  for (const b of ctrls.filter(x => x.sel === '.th-arc .th-key')) expect(Math.round(b.w)).toBe(size.compact ? 48 : 52);
  const disc = ctrls.find(x => x.sel === '.th-disc')!;
  expect(Math.round(disc.w)).toBe(size.compact ? 64 : 76);
  expect(ctrls.filter(x => x.sel === '.th-arc .th-key').length).toBe(4);
  // 3. No two controls overlap: the centre and four inner corners of each are the control itself.
  const covered = await page.evaluate(ss => {
    const out: string[] = [];
    for (const s of ss) for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      for (const [fx, fy] of [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]]) {
        const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
        if (!hit || !(hit === el || el.contains(hit))) { out.push(`${s} at ${fx},${fy} under ${hit?.tagName}.${String((hit as HTMLElement | null)?.className ?? '').slice(0, 30)}`); break; }
      }
    }
    return out;
  }, CONTROLS);
  expect(covered, `${where}: ${covered.join('; ')}`).toEqual([]);
  // 4. Thumb zones: every corner of the right cluster within 300 px of the bottom-right, the left within 300 of the bottom-left.
  const far = (b: Box, cx: number, cy: number) => Math.max(...[[b.l, b.t], [b.r, b.t], [b.l, b.b], [b.r, b.b]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
  for (const b of ctrls.filter(x => ['.th-arc .th-key', '.th-page', '.th-disc'].includes(x.sel))) expect(far(b, W, H), `${where}: ${b.sel} in the right thumb's reach`).toBeLessThanOrEqual(300);
  for (const b of ctrls.filter(x => ['.th-belt .th-slot', '.th-bag .th-btn'].includes(x.sel))) expect(far(b, 0, H), `${where}: ${b.sel} in the left thumb's reach`).toBeLessThanOrEqual(300);
}

for (const size of SIZES) {
  test.describe(`the thumb HUD at ${size.name} (Android, portrait)`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });

    for (const gfx of ['iso', 'classic']) for (const lang of ['en', 'es']) {
      test(`zones, sizes, no overlap, thumb reach — the square and a hunt (${gfx}, ${lang})`, async ({ page }) => {
        test.setTimeout(120_000);
        await boot(page, { gfx, lang, query: '&fxcoop=1' });
        await checkLayout(page, size, `square ${gfx} ${lang}`);
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/hud-${size.name}-${gfx}-${lang}.png` }); }
        // A hunt with a target: a creature beside the Keeper, struck from the disc.
        await page.waitForFunction(() => !!(window as unknown as { __tdCoop?: unknown }).__tdCoop);
        await page.evaluate(() => (window as unknown as { __tdCoop: { lay: (t: string, dx: number, dy: number, calm: boolean) => unknown } }).__tdCoop.lay('ash-wolf', 36, 0, true));
        await expect(page.locator('.th-disc')).toHaveAttribute('data-verb', 'attack', { timeout: 5000 });
        await page.locator('.th-disc').tap();
        await page.waitForTimeout(500);
        await checkLayout(page, size, `hunt ${gfx} ${lang}`);
      });
    }

    test('the disc: Enter at Edrin Kade\'s stall opens the General Store; Attack with a hostile near', async ({ page }) => {
      test.setTimeout(90_000);
      await boot(page, { gfx: 'iso', lang: 'en', query: '&fxcoop=1&fxparty=1' });
      // The Keeper starts at Edrin Kade's stall.
      await expect(page.locator('.th-disc')).toHaveAttribute('data-verb', 'enter', { timeout: 10000 });
      await expect(page.locator('.th-disc .th-disc__verb')).toHaveText('Enter');
      // Glim's greeting has the whole ticker first; then the reach line names the stall.
      await expect(page.locator('.th-ticker [data-th-line="armed"]')).toContainText(/Edrin Kade's General Store/, { timeout: 30000 });
      await page.locator('.th-disc').tap();
      await expect(page.locator('.place:not([hidden]) h2').first()).toContainText(/General Store|Edrin/i, { timeout: 10000 });
      await page.keyboard.press('Escape');
      await expect(page.locator('.place:not([hidden])')).toHaveCount(0, { timeout: 5000 });
      // A corpse with loot in reach: the disc says Loot, and a tap opens the satchel on Nearby (§A.4).
      await page.waitForFunction(() => !!(window as unknown as { __tdParty?: unknown }).__tdParty);
      await page.evaluate(() => { const h = (window as unknown as { __tdParty: { smite: (t: string, dx: number) => unknown; stock: () => unknown } }).__tdParty; h.smite('ash-wolf', 20); h.stock(); });
      await expect(page.locator('.th-disc')).toHaveAttribute('data-verb', 'loot', { timeout: 5000 });
      await page.locator('.th-disc').tap();
      await expect(page.locator('#satchel-book')).toHaveAttribute('data-bag-tab', 'nearby');
      await page.locator('#satchel-book .book-close').tap();
      // A hostile near: the disc is Attack again.
      await page.waitForFunction(() => !!(window as unknown as { __tdCoop?: unknown }).__tdCoop);
      await page.evaluate(() => (window as unknown as { __tdCoop: { lay: (t: string, dx: number, dy: number, calm: boolean) => unknown } }).__tdCoop.lay('ash-wolf', 40, 0, true));
      await expect(page.locator('.th-disc')).toHaveAttribute('data-verb', 'attack', { timeout: 5000 });
      await expect(page.locator('.th-disc')).toHaveAttribute('aria-label', 'Attack');
    });

    test('☰ More: the tile sheet, every tile opens its window, the sheet reaches its last tile', async ({ page }) => {
      test.setTimeout(150_000);
      await boot(page, { gfx: 'classic', lang: 'en' });
      const more = page.locator('[data-th="more"]');
      const sheet = page.locator('[data-th="more-sheet"]');
      const WINDOW: Record<string, string> = {
        book: '.spellbook.sbt', character: '.ksheet', journal: '.place:not([hidden])', chat: '.td-chat', friends: '.friends-host', bestiary: '.td-best',
        settings: '.sound-host', loot: '.sound-host', lore: '.ksheet', account: '.place:not([hidden])', feedback: '.feedback-host', menu: '#game-menu',
      };
      await more.tap();
      await expect(sheet).toBeVisible();
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/more-${size.name}.png` }); }
      const ids = await sheet.locator('[data-tile]').evaluateAll(els => els.map(e => e.getAttribute('data-tile')!));
      expect(ids.slice(0, 12)).toEqual(['book', 'character', 'journal', 'chat', 'friends', 'bestiary', 'settings', 'loot', 'names', 'lore', 'account', 'feedback']);
      // The sheet scrolls inside itself when taller than half the screen; its last tile is reachable.
      const reach = await sheet.evaluate(async el => {
        const scrolls = el.scrollHeight > el.clientHeight + 2;
        el.scrollTop = el.scrollHeight;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const tiles = el.querySelectorAll('[data-tile]'), last = tiles[tiles.length - 1] as HTMLElement;
        const r = last.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { scrolls, ok: !!hit && last.contains(hit), inside: r.bottom <= innerHeight && r.top >= 0, h: el.getBoundingClientRect().height };
      });
      if (size.compact) expect(reach.scrolls, 'the More sheet scrolls at 360×640').toBe(true);
      expect(reach.h).toBeLessThanOrEqual(size.height * .5 + 1);
      expect(reach.ok && reach.inside, 'the last tile is reachable').toBe(true);
      // The item-name toggle flips in place.
      const names = sheet.locator('[data-tile="names"]');
      await names.scrollIntoViewIfNeeded();
      const was = await names.getAttribute('aria-pressed');
      await names.tap();
      await expect(names).not.toHaveAttribute('aria-pressed', String(was));
      await page.locator('.th-more__x').tap();
      // Every other tile opens its window.
      for (const id of ids.filter(i => i !== 'names' && i !== 'slate')) {
        await more.tap();
        await expect(sheet).toBeVisible();
        const tile = sheet.locator(`[data-tile="${id}"]`);
        await tile.scrollIntoViewIfNeeded();
        await tile.tap();
        await expect(sheet, `${id}: the sheet closes on choosing`).toHaveCount(0);
        await expect(page.locator(WINDOW[id]).first(), `${id} opens its window`).toBeVisible({ timeout: 10000 });
        for (let i = 0; i < 4 && await page.locator('.place:not([hidden]), .spellbook.sbt, .ksheet, .td-best, .sound-host, .friends-host, .feedback-host, #game-menu').count(); i++) {
          await page.keyboard.press('Escape'); await page.waitForTimeout(200);
        }
        if (id === 'chat') { await page.locator('.td-chat__x').tap(); await expect(page.locator('.td-chat')).toBeHidden(); }
      }
    });

    test('the goal chip holds the tutorial step; Glim is never covered; Glim and the area speak in the ticker', async ({ page }) => {
      test.setTimeout(90_000);
      await boot(page, { gfx: 'iso', lang: 'en' });
      const guide = page.locator('.guide');
      await expect(guide).toBeVisible();
      await expect(guide.locator('.guide-text')).toContainText(/Step 1 of 7/);
      const g = (await guide.boundingBox())!;
      expect(Math.round(g.y)).toBe(56);
      expect(Math.round(g.height)).toBe(44);
      expect(Math.round(g.width)).toBe(size.width - 168);
      // Glim's button: its own tap, never under the goal chip or anything else.
      const glim = page.locator('.glim-hud');
      await expect(glim).toBeVisible();
      const hit = await glim.evaluate(el => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && el.contains(h); });
      expect(hit, 'Glim is never covered').toBe(true);
      // Glim's greeting and the area title arrive as ticker lines; the centre cards are not drawn.
      await expect(page.locator('.th-ticker [data-th-line="glim"]')).toBeVisible({ timeout: 10000 });
      // While Glim speaks he has the ticker to himself, uncut.
      await expect(page.locator('.th-ticker .th-line')).toHaveCount(1);
      expect(await page.locator('.th-ticker [data-th-line="glim"]').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      // The goal chip: no "Step 1 of 7" words in view (the bar and a 1/7 badge carry it), the goal itself on two lines.
      await expect(guide.locator('.guide-text b')).toBeHidden();
      await expect(guide.locator('.guide-text')).toHaveAttribute('data-step', '1/7');
      await expect(page.locator('.glim-say')).toBeHidden();
      await expect(page.locator('.area-card')).toBeHidden();
      const tick = (await page.locator('.th-ticker').boundingBox())!;
      expect(tick.y + tick.height).toBeLessThanOrEqual(size.height * .25);
      // A tap on the chip opens its card (Skip lives inside), and it folds again.
      await guide.locator('.guide-text').tap();
      await expect(guide).toHaveClass(/guide--open/);
      await expect(page.locator('[data-prologue-skip]')).toBeVisible();
      await guide.locator('.guide-text').tap();
      await expect(guide).not.toHaveClass(/guide--open/);
    });
  });
}

test.describe('sideways phones keep their own HUD (844×390)', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
  test('no thumb HUD, the touch row and dock as before', async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'preferred-language': 'en' });
    await page.goto('/play?td=1&hour=12');
    await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
    await expect(page.locator('.stage--thumb')).toHaveCount(0);
    await expect(page.locator('.th-disc')).toHaveCount(0);
    await expect(page.locator('.td-dock')).toBeVisible();
    await expect(page.locator('.touch-act .tb--use')).toBeVisible();
  });
});
