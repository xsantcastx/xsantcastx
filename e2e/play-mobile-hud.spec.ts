/**
 * play-mobile-hud.spec.ts — on a phone the world gets the screen.
 *
 * The phone HUD (docs/handoff/mobile-hud.md) lives in two thin bands, Terraria
 * mobile style: hotbar + satchel button + area / health / menu along the top,
 * the context row and one row of touch controls along the bottom, with the goal
 * line and the message toast just under the top band. At 360×740, 375×812,
 * 390×844, 430×932 and 844×390, and the landscape phones wider than 900px
 * (932×430, 915×412: touch-first and short), in a town, a hunt and the Delve:
 *
 *   - no two HUD pieces meet;
 *   - nothing sits over the middle half (vertically) of the canvas;
 *   - every touch control is at least 44×44, they are all on one row, each is
 *     an icon with an accessible name (no 8–11px words), and a hit test at each
 *     one's centre reaches it (so does the menu, the satchel button and the
 *     goal's Show me); every HUD button there has an accessible name;
 *   - the unobstructed world (the canvas minus every HUD rect over it) is at
 *     least 65% of the viewport, portrait and landscape;
 *   - the first-visit consent bar docks under it all, covering no control;
 *   - the Homestead's Gold list, unfolded, stays off the centre of the world
 *     (a bottom sheet in portrait, a side drawer in landscape) and folds on a
 *     tap on the world or Escape;
 *   - a mouse at 1280×800 (and at 932×430) keeps the desktop HUD.
 *
 * MOBILE_HUD_MEASURE=1 only measures (no assertions) and writes the numbers to
 * MOBILE_HUD_OUT (JSON); MOBILE_HUD_SHOTS=<dir>/<prefix> also saves a
 * screenshot per scene and size. That is how the before/after table in the
 * handoff was made, against the old build and this one.
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { bag, canvas, ERA, focusWorld, hotbarCount, openPlay, seed, walkTo } from './play-helpers';

const MEASURE_ONLY = !!process.env['MOBILE_HUD_MEASURE'];
const OUT = process.env['MOBILE_HUD_OUT'];
const SHOTS = process.env['MOBILE_HUD_SHOTS'];

const SIZES: { width: number; height: number }[] = [
  { width: 360, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 915, height: 412 },
];

/** The phone HUD's pieces: none may meet another, none may sit over the middle of the world. */
const PIECES = [
  '.title-block', '.places-toggle', '.vitals', '.satchel', '.hotbar', '.guide', '.objective-line',
  '.prompt.armed', '.dock', '.m-take', '.touch-move', '.touch-act', '.map-toggle', '.map-mini-open', '.glim-say', '.loot-toast',
];
/** Everything that can cover the world, old layout and new (for the before/after numbers). */
const COVERS = [
  '.topbar', '.vitals', '.satchel', '.hotbar', '.guide', '.objective-line', '.prompt', '.dock', '.m-take',
  '.touch', '.touch-move', '.touch-act', 'app-homestead-column .hc', '.places', '.keys', '.map-toggle', '.map-mini-open',
];

interface Rect { sel: string; left: number; top: number; right: number; bottom: number }
interface Measure { ratio: number; canvas: Rect; rects: Rect[]; vw: number; vh: number }
const meets = (a: Rect, b: Rect) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;

async function measure(page: Page, selectors: string[]): Promise<Measure> {
  return page.evaluate(sels => {
    const shown = (el: Element): boolean => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < .05) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const rects: { sel: string; left: number; top: number; right: number; bottom: number }[] = [];
    for (const sel of sels) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        if (!shown(el)) continue;
        const r = el.getBoundingClientRect();
        rects.push({ sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
    }
    const c = document.querySelector('.viewport canvas')!.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight, step = 2;
    let free = 0;
    for (let y = Math.max(0, c.top) + 1; y < Math.min(vh, c.bottom); y += step) {
      for (let x = Math.max(0, c.left) + 1; x < Math.min(vw, c.right); x += step) {
        if (!rects.some(r => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) free++;
      }
    }
    return {
      ratio: free * step * step / (vw * vh), rects, vw, vh,
      canvas: { sel: 'canvas', left: c.left, top: c.top, right: c.right, bottom: c.bottom },
    };
  }, selectors);
}

/** The message toast fades after a few seconds: wait it out (a new message restarts it). */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => {
    const line = document.querySelector('.objective-line');
    // The desktop line (a mouse, or the old build at 932×430) is not a toast: nothing to wait for.
    if (!line || !line.getAnimations().length) return true;
    const cs = getComputedStyle(line);
    return cs.visibility === 'hidden' || Number(cs.opacity) < .05;
  }), { timeout: 12000, intervals: [250] }).toBe(true);
  await page.waitForTimeout(150);
}

const results: Record<string, unknown> = {};

async function check(page: Page, scene: string): Promise<void> {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.waitForTimeout(250);
    await settle(page);
    const label = `${scene} ${size.width}×${size.height}`;
    const all = await measure(page, COVERS);
    results[label] = { ratio: Math.round(all.ratio * 1000) / 10, covers: all.rects.map(r => r.sel) };
    if (OUT) {
      const kept = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) as Record<string, unknown> : {};
      fs.writeFileSync(OUT, JSON.stringify({ ...kept, ...results }, null, 2));
    }
    if (SHOTS) {
      fs.mkdirSync(path.dirname(SHOTS), { recursive: true });
      await page.screenshot({ path: `${SHOTS}-${scene}-${size.width}x${size.height}.png` });
    }
    if (MEASURE_ONLY) continue;

    expect(all.ratio, `${label}: unobstructed world ${(all.ratio * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(.65);

    // A catch banner at its longest ("BLINDFIN ×1 · +8 FISHING XP", three stacked) has its own slot:
    // injected into the real container, un-animated, so it is measured at full opacity.
    await page.evaluate(() => {
      const host = document.querySelector('.loot-toasts');
      for (const text of ['Blindfin ×1 · +8 Fishing XP', '+2 Pyrite Dust', '+1 Ember Grub']) {
        const chip = document.createElement('span');
        chip.className = 'loot-toast test-banner';
        chip.style.animation = 'none';
        chip.textContent = text;
        host?.appendChild(chip);
      }
    });
    const { rects, canvas: c } = await measure(page, PIECES);
    await page.evaluate(() => document.querySelectorAll('.test-banner').forEach(n => n.remove()));
    expect(rects.some(r => r.sel === '.loot-toast'), `${label}: the catch banner is on screen`).toBe(true);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(meets(rects[i]!, rects[j]!), `${label}: ${rects[i]!.sel} ${JSON.stringify(rects[i])} meets ${rects[j]!.sel} ${JSON.stringify(rects[j])}`).toBe(false);
      }
    }
    const h = c.bottom - c.top;
    const middle: Rect = { sel: 'middle', left: c.left, right: c.right, top: c.top + h * .25, bottom: c.top + h * .75 };
    for (const r of rects) expect(meets(r, middle), `${label}: ${r.sel} over the middle of the world`).toBe(false);

    // A prompt's label and its button never say the same thing ("FISH HERE | FISH HERE").
    const prompt = await page.evaluate(() => {
      const el = document.querySelector('.prompt.armed');
      if (!el) return null;
      const norm = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      const label = norm(el.querySelector('strong')?.textContent);
      const buttons = Array.from(el.querySelectorAll('button:not(.keys-toggle)')).map(b => {
        const clone = b.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('kbd').forEach(k => k.remove());
        return norm(clone.textContent);
      });
      return { label, buttons };
    });
    if (prompt) for (const b of prompt.buttons) expect(b, `${label}: the prompt label "${prompt.label}" repeats its button`).not.toBe(prompt.label);

    // The touch row: ≥ 44×44, one row, labels that fit, and each takes its own tap.
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('.touch .tb')).filter(b => getComputedStyle(b).display !== 'none').map(b => {
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return {
        name: b.getAttribute('aria-label'), w: r.width, h: r.height, top: r.top,
        right: r.right, left: r.left, fits: b.scrollWidth <= b.clientWidth + 1, reached: !!hit && (hit === b || b.contains(hit)),
        // An icon, not a word: something drawn at least 14px across, and no visible text.
        icon: Array.from(b.querySelectorAll('svg, .tri')).some(i => getComputedStyle(i).display !== 'none' && Math.max(i.getBoundingClientRect().width, i.getBoundingClientRect().height) >= 14),
        text: Array.from(b.querySelectorAll('span')).filter(t => getComputedStyle(t).display !== 'none').map(t => (t.textContent ?? '').trim()).join(''),
      };
    }));
    expect(buttons.length, `${label}: touch controls`).toBeGreaterThanOrEqual(5);
    for (const b of buttons) {
      expect(b.w, `${label}: ${b.name} width`).toBeGreaterThanOrEqual(44);
      expect(b.h, `${label}: ${b.name} height`).toBeGreaterThanOrEqual(44);
      expect(Math.abs(b.top - buttons[0]!.top), `${label}: ${b.name} on the one row`).toBeLessThanOrEqual(1);
      expect(b.fits, `${label}: ${b.name} fits`).toBe(true);
      expect(b.name?.trim(), `${label}: a touch control without an accessible name`).toBeTruthy();
      expect(b.icon, `${label}: ${b.name} shows an icon`).toBe(true);
      expect(b.text, `${label}: ${b.name} shows no small text`).toBe('');
      expect(b.reached, `${label}: ${b.name} takes its own tap`).toBe(true);
      expect(b.left, `${label}: ${b.name} on screen`).toBeGreaterThanOrEqual(0);
      expect(b.right, `${label}: ${b.name} on screen`).toBeLessThanOrEqual(size.width);
    }
    // Nothing is drawn behind the touch row: it sits under the canvas, not over it.
    const touchTop = Math.min(...buttons.map(b => b.top));
    expect(c.bottom, `${label}: the world ends above the touch row`).toBeLessThanOrEqual(touchTop);

    // Every HUD button a thumb can reach has a name a screen reader can read.
    const nameless = await page.evaluate(() => Array.from(document.querySelectorAll(
      '.touch .tb, .places-toggle, .satchel .clasp, .guide button, .hearth-pill, .prompt.armed > button, .m-take, .hotbar .hot, .map-toggle, .map-mini-open',
    )).filter(b => getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0)
      .filter(b => !(b.getAttribute('aria-label') || (b as HTMLElement).innerText || '').trim())
      .map(b => b.outerHTML.slice(0, 80)));
    expect(nameless, `${label}: HUD buttons without an accessible name`).toEqual([]);

    for (const sel of ['.places-toggle', '.satchel .clasp', '.guide-go', '.hearth-pill', '.prompt.armed > button', '.m-take', '.map-toggle', '.map-mini-open']) {
      const ok = await page.evaluate(s => {
        const el = document.querySelector(s);
        if (!el || getComputedStyle(el).display === 'none') return null;
        const r = el.getBoundingClientRect();
        if (!r.width) return null;
        const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        return !!hit && (hit === el || el.contains(hit));
      }, sel);
      if (ok !== null) expect(ok, `${label}: ${sel} takes its own tap`).toBe(true);
    }
  }
}

test.describe('the /play HUD on phones', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test.describe.configure({ timeout: 240000 });

  test('in a town (Basalt Seamworks, goal line up)', async ({ page }) => {
    await seed(page);
    await openPlay(page);
    await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks');
    await check(page, 'town');
  });

  test('on a hunt (Ember Quarry)', async ({ page }) => {
    await seed(page, { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } });
    await openPlay(page);
    await page.locator('.places-toggle').click();
    await page.locator('#places-list button', { hasText: 'East Passage' }).click();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry', { timeout: 60000 });
    await check(page, 'hunt');
  });

  test('in the Ember Delve (hotbar up)', async ({ page }) => {
    await seed(page, bag({ torch: 6, 'dirt-block': 9, ladder: 4 }));
    await openPlay(page);
    await walkTo(page, 590, 30);
    await page.keyboard.press('e');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 30000 });
    await focusWorld(page);
    await check(page, 'delve');
  });

  test('the menu holds Return to camp, Restart hunt and Keys; the goal folds; a placeable turns Use into Place', async ({ page }) => {
    if (MEASURE_ONLY) return; // measuring only
    await seed(page, bag({ torch: 6 }));
    await openPlay(page);
    await expect(page.locator('.top-actions .quiet').first()).toBeHidden();
    await page.locator('.places-toggle').click();
    await expect(page.locator('#places-list .menu-extra button')).toHaveCount(3);
    await page.locator('#places-list .menu-extra button', { hasText: 'Return to camp' }).click();
    await expect(page.locator('#places-list')).toHaveCount(0);
    // The goal line folds to its chip and back; folded it is narrower and still one row.
    const guide = page.locator('.guide');
    const open = (await guide.boundingBox())!;
    await page.locator('.guide-fold').click();
    await expect(page.locator('.guide-fold')).toHaveAttribute('aria-expanded', 'false');
    const folded = (await guide.boundingBox())!;
    expect(folded.width).toBeLessThan(open.width);
    expect(folded.height).toBeLessThanOrEqual(46);
    await page.locator('.guide-fold').click();
    await expect(page.locator('.guide-go')).toBeVisible();
    // The Delve: the pick is chosen; a torch slot makes the Use button Place, the pick makes it Attack again.
    await walkTo(page, 590, 30);
    await page.keyboard.press('e');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 30000 });
    await expect(page.locator('.hot--pick')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.hotbar .hot[title="Torch"]').click();
    await expect(page.locator('.touch-act .tb--use:visible')).toHaveAttribute('aria-label', /^Place: Torch/);
    await expect(page.locator('.touch-act .tb--use:visible svg.ts')).toBeVisible();
    await page.locator('.hot--pick').click();
    await expect(page.locator('.touch-act .tb--use:visible')).toHaveAttribute('aria-label', 'Attack');
  });

  test('smart cursor: with the pick a tap digs a block, with a block chosen a tap places it there', async ({ page }) => {
    if (MEASURE_ONLY) return; // measuring only
    // A pinned Delve seed, so the rock beside the shaft is the same every run.
    await seed(page, { ...bag({ 'dirt-block': 9 }), 'godforge-delve': { version: 1, seed: 424242, createdAt: 1, areas: {}, claimed: [] } });
    await openPlay(page);
    await walkTo(page, 590, 30);
    await page.keyboard.press('e');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 30000 });
    await page.waitForTimeout(800);
    const before = await hotbarCount(page, 'Dirt block');
    // The Keeper lands at about x 140 with his feet near y 428 on this phone: tap the ground beside them.
    let at: [number, number] | null = null;
    for (const [x, y] of [[165, 440], [150, 440], [180, 440], [165, 455], [125, 440]] as [number, number][]) {
      for (let i = 0; i < 6 && !at; i++) {
        await page.touchscreen.tap(x, y);
        await page.waitForTimeout(350);
        if (await hotbarCount(page, 'Dirt block') > before) at = [x, y];
      }
      if (at) break;
    }
    expect(at, 'a tap with the pick dug a block').not.toBeNull();
    const dug = await hotbarCount(page, 'Dirt block');
    await page.locator('.hotbar .hot[title="Dirt block"]').tap();
    await page.touchscreen.tap(at![0], at![1]);
    await expect.poll(() => hotbarCount(page, 'Dirt block'), { message: 'a tap with a block chosen placed it' }).toBe(dug - 1);
  });

  test('Spanish: the touch controls are named in Spanish and fit at 360px', async ({ page }) => {
    if (MEASURE_ONLY) return; // measuring only
    await seed(page, { 'preferred-language': 'es', ...bag({ torch: 2 }) });
    await page.setViewportSize({ width: 360, height: 740 });
    await openPlay(page);
    await walkTo(page, 590, 30);
    await page.keyboard.press('e');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve', { timeout: 30000 });
    await expect(page.locator('.touch-act .tb--dodge')).toHaveAttribute('aria-label', 'Esquivar');
    await expect(page.locator('.touch-act .tb--jump')).toHaveAttribute('aria-label', 'Saltar');
    const tight = await page.evaluate(() => Array.from(document.querySelectorAll('.touch .tb'))
      .filter(b => getComputedStyle(b).display !== 'none' && b.scrollWidth > b.clientWidth + 1).map(b => b.textContent));
    expect(tight).toEqual([]);
    await expect(page.locator('.hot--pick')).toHaveAttribute('aria-label', 'Pico: toca un bloque para excavarlo');
  });
});

test.describe('the /play phone HUD with the first-visit consent bar', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test('the bar docks under the touch row and covers no control', async ({ page }) => {
    if (MEASURE_ONLY) return; // measuring only
    await page.goto('/robots.txt');
    await page.evaluate(() => {
      const keep = localStorage.getItem('eclipse-onboarding');
      const keepLobby = localStorage.getItem('eclipse-lobby');
      localStorage.clear();
      if (keepLobby) localStorage.setItem('eclipse-lobby', keepLobby);
      localStorage.setItem('eclipse-onboarding', keep ?? JSON.stringify({ done: true, lastStep: 5, at: '2026-01-01T00:00:00.000Z' }));
      sessionStorage.setItem('visit-counted', '1');
    });
    await openPlay(page);
    await expect(page.locator('.cookie-banner--world')).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect.poll(async () => {
      const m = await measure(page, ['.cookie-banner--world', '.touch-move', '.touch-act', '.dock']);
      const bar = m.rects.find(r => r.sel === '.cookie-banner--world');
      return !!bar && m.rects.filter(r => r !== bar).every(r => !meets(r, bar)) && m.canvas.bottom <= bar.top;
    }, { timeout: 10000 }).toBe(true);
  });
});

/** The middle half of the canvas, across and down: where the Keeper is. */
async function centreOf(page: Page): Promise<Rect> {
  const c = (await canvas(page).boundingBox())!;
  return { sel: 'centre', left: c.x + c.width * .25, right: c.x + c.width * .75, top: c.y + c.height * .25, bottom: c.y + c.height * .75 };
}
async function rectOf(page: Page, sel: string): Promise<Rect> {
  const b = (await page.locator(sel).first().boundingBox())!;
  return { sel, left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
}
/** A hit test at its centre (after scrolling it into its list), which is what a thumb does. */
async function reachable(page: Page, sel: string): Promise<boolean> {
  return page.locator(sel).first().evaluate(el => {
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
}

test.describe('the Homestead Gold list on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test.describe.configure({ timeout: 180000 });

  test('unfolded it is a bottom sheet (portrait) or a side drawer (landscape) off the centre of the world; a world tap or Escape folds it', async ({ page }) => {
    if (MEASURE_ONLY) return; // measuring only
    await seed(page);
    await openPlay(page);
    await page.locator('.guide-go').tap();
    await expect(canvas(page)).toHaveAttribute('data-area', 'Your Homestead', { timeout: 30000 });
    const toggle = page.locator('.hc-toggle');
    // (The furnace and automatons are retired since forge income ended, so the list no longer unfolds itself for a
    // Keeper with no building; the loop below unfolds it by hand.)
    await expect(toggle).toBeVisible();
    const sizes = [
      { width: 375, height: 812 }, { width: 360, height: 740 }, { width: 430, height: 932 },
      { width: 844, height: 390 }, { width: 932, height: 430 }, { width: 915, height: 412 },
    ];
    for (const size of sizes) {
      const label = `${size.width}×${size.height}`;
      await page.setViewportSize(size);
      await page.waitForTimeout(300);
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.tap();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const sheet = await rectOf(page, 'app-homestead-column .hc');
      const centre = await centreOf(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}-homestead-${size.width}x${size.height}.png` });
      expect(meets(sheet, centre), `${label}: the Gold list ${JSON.stringify(sheet)} covers the centre of the world ${JSON.stringify(centre)}`).toBe(false);
      for (const piece of ['.touch-move', '.touch-act', '.vitals', '.places-toggle']) {
        expect(meets(sheet, await rectOf(page, piece)), `${label}: the Gold list meets ${piece}`).toBe(false);
      }
      expect(await reachable(page, '.hc-strike'), `${label}: Strike is covered`).toBe(true);
      expect(await reachable(page, '.hc-row .hc-buy'), `${label}: the first Buy is covered`).toBe(true);
      if (size.height > 500) expect(sheet.top, `${label}: a bottom sheet`).toBeGreaterThan(centre.bottom);
      else expect(sheet.right, `${label}: a side drawer`).toBeLessThan(centre.left);
    }
    // A tap on the world folds it; the chip unfolds it again; Escape folds it.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    const c = await centreOf(page);
    await page.touchscreen.tap((c.left + c.right) / 2, (c.top + c.bottom) / 2);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.hc-rows')).toHaveCount(0);
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('the /play HUD with a mouse', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test('a mouse keeps the desktop HUD at 1280×800 and on a short 932×430 window', async ({ page }) => {
    if (MEASURE_ONLY) return; // measuring only
    await seed(page, bag({ torch: 2 }));
    await openPlay(page);
    for (const size of [{ width: 1280, height: 800 }, { width: 932, height: 430 }]) {
      const label = `${size.width}×${size.height} mouse`;
      await page.setViewportSize(size);
      await page.waitForTimeout(250);
      const hud = await page.evaluate(() => {
        const shown = (sel: string) => {
          const el = document.querySelector(sel);
          return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
        };
        const v = document.querySelector('.viewport')!.getBoundingClientRect();
        const st = document.querySelector('.stage')!.getBoundingClientRect();
        return {
          phoneVars: getComputedStyle(document.querySelector('.stage')!).getPropertyValue('--hud-top').trim(),
          fullBleed: Math.abs(v.top - st.top) < 1 && Math.abs(v.bottom - st.bottom) < 1,
          wordmark: shown('.wordmark'), tally: shown('.satchel .tally'), quiet: shown('.top-actions .quiet'),
          placesLabel: document.querySelector('.places-label')!.getBoundingClientRect().width > 1,
          touch: shown('.touch'), menuIcon: shown('.menu-ico'), bagIcon: shown('.bag-ico'),
        };
      });
      expect(hud, label).toEqual({
        phoneVars: '', fullBleed: true, wordmark: true, tally: true, quiet: true, placesLabel: true,
        touch: false, menuIcon: false, bagIcon: false,
      });
    }
  });
});
