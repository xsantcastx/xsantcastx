/**
 * play-wave-b.spec.ts — ui-pass-3 Wave B, part 1 (docs/design/ui-pass-3.md "Waves" → Wave B, Accept when): the shops,
 * the Glass (New Keeper), the world map and the station kit.
 *
 *   - every shop shelf tile shows its price; a tap opens a buy card whose Buy is in view at scrollTop 0 at four sizes;
 *     1 · 5 · 10 · Max sets "Buy N · X Gold" and a press buys N; a desktop hover shows the whole card at the pointer;
 *   - at 844×390 and 932×430 no shop window control is under 44 px (the satchel grid's own pockets are Wave A's);
 *   - the Glass at 844×390 shows the class card at ≥ 300 px wide and the name field above the fold, no text under 11 px;
 *   - the map's empty frame area is under 5% at every size, and no two map labels intersect at the fit;
 *   - the floor rail switches floors in the Ember Mine;
 *   - no station tab is filled with the primary's brass;
 *   - every station's sticky footer leaves the body's last element fully visible at scrollTop max.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, openPlay, purse, seed } from './play-helpers';
import { STASH } from './play-menus';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const SIZES = [
  { tag: '360x640', width: 360, height: 640, touch: true },
  { tag: '390x844', width: 390, height: 844, touch: true },
  { tag: '844x390', width: 844, height: 390, touch: true },
  { tag: '1280x800', width: 1280, height: 800, touch: false },
];
const SHOPS = ['shop-general', 'shop-fishing', 'shop-wood'];
const place = (page: Page) => page.locator('.place:not([hidden])').first();
const canvas = (page: Page) => page.locator('.viewport canvas, canvas').first();

/** The brass the primary wears (_cozy.css --cozy-brass #c99a3e), as a computed colour. */
const BRASS = 'rgb(201, 154, 62)';

/** Every visible control inside `root` smaller than 44 px either way (skipping the satchel grid's pockets). */
const smallControls = (page: Page, root: string) => page.evaluate(sel => {
  const scope = document.querySelector(sel);
  if (!scope) return ['no root'];
  const out: string[] = [];
  for (const el of scope.querySelectorAll('button, input:not([type=hidden]), select, a[href], [role=tab], [role=button]')) {
    if (el.closest('.ig, app-item-grid, [hidden], .sh-tip')) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (Math.min(r.width, r.height) < 43.5) out.push(`${(el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.className.toString()).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return out;
}, root);

test.describe('the shops (ui-pass-3 §4)', () => {
  for (const size of SIZES) {
    test.describe(size.tag, () => {
      test.use(size.touch
        ? { viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA }
        : { viewport: { width: size.width, height: size.height } });

      test('every tile shows its price; a tap opens a buy card whose Buy is in view at scrollTop 0', async ({ page }) => {
        test.setTimeout(120_000);
        for (const at of SHOPS) {
          await seed(page, STASH);
          await openPlay(page, `?at=${at}`);
          const shelf = place(page).locator('[data-shop-shelf]');
          await expect(shelf).toBeVisible({ timeout: 15000 });
          // A price under every tile, readable (not a corner count), with a coin.
          const tiles = shelf.locator('[data-offer]');
          const n = await tiles.count();
          expect(n, `${at}: offers`).toBeGreaterThan(0);
          const prices = await shelf.locator('[data-offer] [data-shop-price]').evaluateAll(els => els.map(e => {
            const r = e.getBoundingClientRect();
            return { text: (e.textContent ?? '').trim(), size: parseFloat(getComputedStyle(e).fontSize), h: r.height, coin: !!e.querySelector('img') };
          }));
          expect(prices.length, `${at}: a price per tile`).toBe(n);
          for (const p of prices) {
            expect(p.text, `${at}: price text`).toMatch(/^[\d,]+$/);
            expect(p.size, `${at}: price at 12px`).toBeGreaterThanOrEqual(12);
            expect(p.coin, `${at}: a coin by the price`).toBe(true);
          }
          // The body opens at its top; a tap on an offer opens the card, and its Buy is in plain view.
          const offer = tiles.nth(Math.min(2, n - 1));
          if (size.touch) await offer.tap(); else await offer.click();
          const card = place(page).locator('[data-shop-card]');
          await expect(card).toBeVisible();
          const top = await page.evaluate(() => document.querySelector('.place-body')?.scrollTop ?? 0);
          expect(top, `${at}: the body was scrolled`).toBe(0);
          const buy = card.locator('[data-shop-buy]');
          const hit = await buy.evaluate(el => {
            const r = el.getBoundingClientRect();
            const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { ok: !!at && (at === el || el.contains(at)) && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, h: r.height, w: r.width };
          });
          expect(hit.ok, `${at}: Buy in view at scrollTop 0 and answers a tap`).toBe(true);
          expect(Math.min(hit.w, hit.h), `${at}: Buy is a 44px target`).toBeGreaterThanOrEqual(44);
          await page.screenshot({ path: `output/uiwb/after-test/${at}-card-${size.tag}.png` }).catch(() => null);
        }
      });
    });
  }

  test.describe('quantities, on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
    test('1 · 5 · 10 · Max sets "Buy N · X Gold" and a press buys N', async ({ page }) => {
      test.setTimeout(90_000);
      await seed(page, { ...STASH, ...purse(1000) });
      await openPlay(page, '?at=shop-general');
      const torch = place(page).locator('[data-shop-shelf] [data-offer="gen-torch"]');
      await torch.tap();
      const card = place(page).locator('[data-shop-card]');
      const buy = card.locator('[data-shop-buy]');
      const unit = Number((await torch.locator('[data-shop-price]').innerText()).replace(/\D/g, ''));
      expect(unit).toBeGreaterThan(0);
      await expect(buy).toHaveText(new RegExp(`Buy · ${unit} Gold`));
      await card.locator('[data-qty="5"]').tap();
      await expect(buy).toHaveText(new RegExp(`Buy 5 · ${(unit * 5).toLocaleString('en-US')} Gold`));
      await card.locator('[data-qty="10"]').tap();
      await expect(buy).toHaveText(new RegExp(`Buy 10 · ${(unit * 10).toLocaleString('en-US')} Gold`));
      await card.locator('[data-qty="max"]').tap();
      const max = Math.min(99, Math.floor(1000 / unit));
      await expect(buy).toHaveText(new RegExp(`Buy ${max} · ${(unit * max).toLocaleString('en-US')} Gold`));
      await card.locator('[data-qty="5"]').tap();
      await buy.tap();
      await expect(place(page).locator('[data-shop-announce]')).toContainText(/Bought Torch/);
      // The wallet chip in the head shows what is left.
      await expect(place(page).locator('app-cost-chip').first()).toContainText((1000 - unit * 5).toLocaleString('en-US'));
    });
  });

  test.describe('the desktop hover card', () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    test('a hover shows the whole card at the pointer, with how to buy; shift-click buys five', async ({ page }) => {
      test.setTimeout(90_000);
      await seed(page, { ...STASH, ...purse(1000) });
      await openPlay(page, '?at=shop-general');
      const torch = place(page).locator('[data-shop-shelf] [data-offer="gen-torch"]');
      await torch.hover();
      const tip = place(page).locator('[data-shop-tip]');
      await expect(tip).toBeVisible();
      await expect(tip).toContainText('Torch');
      await expect(tip).toContainText(/Click to buy · Shift-click buys 5/);
      await expect(tip.locator('img').first()).toBeVisible();
      // The card sits beside the tile, inside the window.
      const tb = (await tip.boundingBox())!, wb = (await place(page).boundingBox())!;
      expect(tb.x).toBeGreaterThanOrEqual(wb.x - 1);
      expect(tb.x + tb.width).toBeLessThanOrEqual(wb.x + wb.width + 1);
      await torch.click({ modifiers: ['Shift'] });
      await expect(place(page).locator('[data-shop-announce]')).toContainText(/Bought Torch/);
      // A plain click opens the buy card (the same as a phone's), beside the shelf.
      await torch.click();
      await expect(place(page).locator('[data-shop-card] [data-shop-buy]')).toBeVisible();
    });
  });

  for (const size of [{ width: 844, height: 390 }, { width: 932, height: 430 }]) {
    test.describe(`no small controls at ${size.width}x${size.height}`, () => {
      test.use({ viewport: size, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
      test('every shop window control is at least 44 px, the card open', async ({ page }) => {
        test.setTimeout(90_000);
        for (const at of SHOPS) {
          await seed(page, STASH);
          await openPlay(page, `?at=${at}`);
          await place(page).locator('[data-shop-shelf] [data-offer]').first().tap();
          await expect(place(page).locator('[data-shop-card]')).toBeVisible();
          expect(await smallControls(page, '.place:not([hidden])'), at).toEqual([]);
          await place(page).locator('[data-seg="satchel"]').tap();
          expect(await smallControls(page, '.place:not([hidden])'), `${at} satchel side`).toEqual([]);
        }
      });
    });
  }
});

test.describe('the Glass at 844×390 (ui-pass-3 §14)', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
  test('the class card is at least 300 px wide, the name is above the fold, Become is brass, no text under 11 px', async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'preferred-language': 'en' });
    await page.evaluate(() => { localStorage.removeItem('eclipse-lobby'); localStorage.removeItem('godforge-keeper-look'); });
    await page.goto('/play?td=1&hour=12');
    await page.locator('.lobby[data-lobby="title"] [data-lobby-guest]').tap();
    await page.waitForTimeout(800);
    if (await page.locator('.lobby[data-lobby="select"] [data-lobby-new]').count()) await page.locator('.lobby[data-lobby="select"] [data-lobby-new]').tap();
    const glass = page.locator('.lobby[data-lobby="create"]');
    await expect(glass).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(600);
    const card = (await glass.locator('[data-class-card]').boundingBox())!;
    expect(card.width, 'class card width').toBeGreaterThanOrEqual(300);
    const name = (await glass.locator('.km__name input').boundingBox())!;
    expect(name.y + name.height, 'name field above the fold').toBeLessThanOrEqual(390);
    const keep = glass.locator('.km__keep');
    expect(await keep.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(BRASS);
    const kb = (await keep.boundingBox())!;
    expect(kb.y + kb.height).toBeLessThanOrEqual(390);
    // Four portrait chips, each a 44px target; the chosen calling's card follows the choice.
    for (const v of ['warlock', 'ashguard', 'lanternwright', 'thornstrider']) {
      const chip = (await glass.locator(`[data-vocation="${v}"]`).boundingBox())!;
      expect(Math.min(chip.width, chip.height), v).toBeGreaterThanOrEqual(44);
    }
    await glass.locator('[data-vocation="ashguard"]').tap();
    await expect(glass.locator('[data-class-card]')).toContainText('Ashguard');
    await expect(glass.locator('[data-class-card]')).toContainText(/Melee/);
    const tiny = await glass.evaluate(root => {
      const out: string[] = [];
      for (const el of root.querySelectorAll('*')) {
        const own = [...el.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1);
        if (!own) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (r.width < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (parseFloat(cs.fontSize) < 11) out.push(`${(el.textContent ?? '').trim().slice(0, 20)} ${cs.fontSize}`);
      }
      return out;
    });
    expect(tiny).toEqual([]);
    // The skip-tutorial toggle is a 44px target.
    const skip = (await glass.locator('[data-lobby-skip-tut] input').boundingBox())!;
    expect(skip.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: 'output/uiwb/after-test/glass-844x390.png' }).catch(() => null);
  });
});

/** The visible empty share of the map frame, and the label pairs that overlap, at the fit. */
async function mapCheck(page: Page) {
  return page.evaluate(() => {
    const view = document.querySelector('[data-map-view]') as HTMLElement;
    const img = view.querySelector('img') as HTMLImageElement;
    const v = view.getBoundingClientRect(), i = img.getBoundingClientRect();
    const ix = Math.max(0, Math.min(v.right, i.right) - Math.max(v.left, i.left)), iy = Math.max(0, Math.min(v.bottom, i.bottom) - Math.max(v.top, i.top));
    const empty = 1 - (ix * iy) / (v.width * v.height);
    const labels = [...view.querySelectorAll<HTMLElement>('.mw__zone')].filter(l => getComputedStyle(l).visibility !== 'hidden' && getComputedStyle(l).display !== 'none')
      .map(l => ({ name: l.textContent?.trim() ?? '', r: l.getBoundingClientRect() }))
      .filter(l => l.r.right > v.left && l.r.left < v.right && l.r.bottom > v.top && l.r.top < v.bottom);
    const overlaps: string[] = [];
    for (let a = 0; a < labels.length; a++) for (let b = a + 1; b < labels.length; b++) {
      const A = labels[a].r, B = labels[b].r;
      if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom) overlaps.push(`${labels[a].name} × ${labels[b].name}`);
    }
    const scale = Number(view.dataset['scale']);
    return { empty, overlaps, shown: labels.length, scale, whole: scale >= 1 ? Number.isInteger(scale) : Number.isInteger(Math.round(1000 / scale) / 1000) };
  });
}

test.describe('the map (ui-pass-3 §8)', () => {
  for (const size of SIZES) {
    test.describe(size.tag, () => {
      test.use(size.touch
        ? { viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA }
        : { viewport: { width: size.width, height: size.height } });
      test('fills its frame at a whole-pixel zoom, and no two labels intersect', async ({ page }) => {
        test.setTimeout(90_000);
        await seed(page, STASH);
        await openPlay(page, '?td=1&hour=12');
        await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
        await page.keyboard.press('m');
        await expect(page.locator('[data-map-view]')).toBeVisible();
        await page.waitForTimeout(600);
        const m = await mapCheck(page);
        expect(m.empty, 'empty frame share').toBeLessThan(.05);
        expect(m.overlaps, 'labels that intersect').toEqual([]);
        expect(m.shown, 'some labels show').toBeGreaterThan(0);
        expect(m.whole, `whole-pixel scale (${m.scale})`).toBe(true);
        // The filter rail: a press hides that kind of pin and shows it again.
        const chip = page.locator('[data-map-filters] [data-filter]').nth(1);
        const kind = await chip.getAttribute('data-filter');
        await chip.click();
        await expect(chip).toHaveAttribute('aria-pressed', 'false');
        await chip.click();
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        expect(kind).toBeTruthy();
        // A pin's card: its name and one brass Walk here, in view.
        await page.locator('[data-map-view] .mw__pin').first().dispatchEvent('click');
        const walk = page.locator('[data-map-card] [data-map-walk]');
        await expect(walk).toBeVisible();
        expect(await walk.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(BRASS);
        const wb = (await walk.boundingBox())!;
        expect(wb.y + wb.height).toBeLessThanOrEqual(size.height);
        expect(wb.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `output/uiwb/after-test/map-card-${size.tag}.png` }).catch(() => null);
      });
    });
  }

  test.describe('the floor rail', () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    test('switches floors in the Ember Mine', async ({ page }) => {
      test.setTimeout(90_000);
      await seed(page, STASH);
      await openPlay(page, '?td=1&hour=12');
      await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
      await page.keyboard.press('m');
      const view = page.locator('[data-map-view]');
      await expect(view).toBeVisible();
      await page.locator('[data-map-section]').selectOption('ember-mine-1');
      await expect(view).toHaveAttribute('data-section', 'ember-mine-1');
      const rail = page.locator('[data-map-floors]');
      await expect(rail).toBeVisible();
      await expect(rail.locator('[data-floor="ember-mine-1"]')).toHaveAttribute('aria-pressed', 'true');
      const floors = await rail.locator('[data-floor]').evaluateAll(els => els.map(e => e.getAttribute('data-floor') ?? ''));
      expect(floors.filter(f => f.startsWith('ember-mine')).length).toBeGreaterThan(1);
      const next = floors.find(f => f.startsWith('ember-mine') && f !== 'ember-mine-1')!;
      await rail.locator(`[data-floor="${next}"]`).click();
      await expect(view).toHaveAttribute('data-section', next);
      await expect(rail.locator(`[data-floor="${next}"]`)).toHaveAttribute('aria-pressed', 'true');
      // And back up to the surface.
      await rail.locator('[data-floor="surface"]').click();
      await expect(view).toHaveAttribute('data-section', 'surface');
      await expect(page.locator('[data-map-floors]')).toHaveCount(0);
    });
  });
});

test.describe('the station kit (ui-pass-3 §5)', () => {
  for (const size of [{ tag: '360x640', width: 360, height: 640 }, { tag: '844x390', width: 844, height: 390 }]) {
    test.describe(size.tag, () => {
      test.use({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
      test('no tab is brass; one tab row; every sticky footer leaves the last element in view at the end', async ({ page }) => {
        test.setTimeout(150_000);
        for (const at of ['crafting', 'market', 'gambler', 'enchanting', 'shop-general']) {
          await seed(page, STASH);
          await openPlay(page, `?at=${at}`);
          await expect(place(page)).toBeVisible({ timeout: 15000 });
          await page.waitForTimeout(500);
          const tabs = await page.evaluate(() => [...document.querySelectorAll('.place [role=tab]')].map(t => {
            const cs = getComputedStyle(t), r = t.getBoundingClientRect();
            return { fill: cs.backgroundColor, image: cs.backgroundImage, top: Math.round(r.top), h: r.height, w: r.width, shown: r.width > 0 && cs.display !== 'none' };
          }).filter(t => t.shown));
          for (const t of tabs) {
            expect(t.fill, `${at}: a tab filled with brass`).not.toBe('rgb(201, 154, 62)');
            expect(t.image, `${at}: a tab painted with a gradient`).toBe('none');
            expect(Math.min(t.w, t.h), `${at}: a 44px tab`).toBeGreaterThanOrEqual(43.5);
          }
          // One row of tabs per tab bar (Market's ten scroll sideways instead of taking 40% of a phone).
          const rows = await page.evaluate(() => [...document.querySelectorAll('.place [role=tablist]')].map(l => new Set([...l.querySelectorAll('[role=tab]')].map(t => Math.round(t.getBoundingClientRect().top))).size));
          for (const r of rows) expect(r, `${at}: tab rows`).toBe(1);
          // At scrollTop max, the body's last element is fully in view and is what a tap there would hit.
          const end = await page.evaluate(async () => {
            const body = document.querySelector('.place-body') as HTMLElement | null;
            if (!body) return { ok: false, why: 'no body' };
            body.scrollTop = body.scrollHeight;
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const shown = (e: Element) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]'); };
            // The deepest last shown element that carries content (text or a control), outside any sticky bar.
            const all = [...body.querySelectorAll('*')].filter(shown).filter(e => {
              for (let a: Element | null = e; a && a !== body; a = a.parentElement) if (getComputedStyle(a).position === 'sticky') return false;
              return e.matches('button, input, select, a[href]') || [...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1);
            });
            const last = all[all.length - 1];
            if (!last) return { ok: true, why: 'nothing' };
            const r = last.getBoundingClientRect(), b = body.getBoundingClientRect();
            const inside = r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
            const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 20), r.top + r.height / 2);
            const ok = inside && !!hit && (hit === last || last.contains(hit) || hit.contains(last));
            return { ok, why: `${(last.textContent ?? '').trim().slice(0, 30)} ${Math.round(r.top)}..${Math.round(r.bottom)} in ${Math.round(b.top)}..${Math.round(b.bottom)} under ${hit?.className}` };
          });
          expect(end.ok, `${at}: ${end.why}`).toBe(true);
        }
      });
    });
  }
});
