/**
 * td-chat-phone.spec.ts — the chat on a phone (owner 2026-10-21: "the chat on the phone is kinda buggy, the send
 * button overlaps other parts").
 *
 * Android Chrome emulated (touch, mobile viewport) at 390×844, 360×640 and 844×390, joined to a private Hearth room
 * so the Chat tab shows its input row. The input and Send sit in one row inside the box, each at least 44px tall and
 * each the element a tap at its centre reaches; the box meets none of the touch controls (.touch-move, .touch-act),
 * the spell bar (.td-skills), the potion belt (.td-belt) or the menu tabs (.td-dock). Focusing the input keeps it on
 * screen. Screenshot (390×844): docs/handoff/cozy-ui/online-phone-chat-after.jpg.
 */
import { expect, test } from '@playwright/test';
import { enterAs, startHearth, type Hearth } from './hearth-helpers';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
  { name: '844x390', width: 844, height: 390 },
];
const KEEP_CLEAR = ['.touch-move', '.touch-act', '.td-skills', '.td-belt', '.td-dock'];

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL)); });
test.afterAll(async () => { await hearth?.stop(); });

for (const size of SIZES) {
  test.describe(`the phone chat at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });

    test('input and Send in one row inside the box, reachable, clear of the controls', async ({ page }) => {
      test.setTimeout(90_000);
      await enterAs(page, hearth.port, 'Aster', 'warlock');
      await page.locator('.td-chat__tabs [role=tab]').nth(1).tap();
      const input = page.locator('.td-chat__say input'), send = page.locator('.td-chat__say button');
      await expect(input).toBeVisible();
      await page.waitForTimeout(400);
      const m = await page.evaluate(sels => {
        const rect = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
        const shown = (el: Element) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
        const hit = (el: Element | null) => { if (!el) return false; const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === el || el.contains(h)); };
        const box = document.querySelector('.td-chat'), input = document.querySelector('.td-chat__say input'), send = document.querySelector('.td-chat__say button');
        const others = sels.flatMap(s => [...document.querySelectorAll(s)].filter(shown).map(el => ({ sel: s, ...rect(el)! })));
        return { box: rect(box), input: rect(input), send: rect(send), inputHit: hit(input), sendHit: hit(send), others, vw: innerWidth, vh: innerHeight };
      }, KEEP_CLEAR);
      const { box, input: i, send: s } = m;
      expect(box && i && s).toBeTruthy();
      // One row: Send right of the input, their middles level.
      expect(s!.l).toBeGreaterThanOrEqual(i!.r - .5);
      expect(Math.abs((s!.t + s!.b) / 2 - (i!.t + i!.b) / 2)).toBeLessThan(2);
      // Inside the box, inside the screen.
      for (const r of [i!, s!]) {
        expect(r.l).toBeGreaterThanOrEqual(box!.l - .5); expect(r.r).toBeLessThanOrEqual(box!.r + .5);
        expect(r.t).toBeGreaterThanOrEqual(box!.t - .5); expect(r.b).toBeLessThanOrEqual(box!.b + .5);
        expect(r.h).toBeGreaterThanOrEqual(44);
      }
      expect(box!.l).toBeGreaterThanOrEqual(0); expect(box!.r).toBeLessThanOrEqual(m.vw); expect(box!.b).toBeLessThanOrEqual(m.vh);
      expect(s!.w).toBeGreaterThanOrEqual(44);
      expect(m.inputHit, 'a tap on the input reaches it').toBe(true);
      expect(m.sendHit, 'a tap on Send reaches it').toBe(true);
      // The box (its 4px ring included) meets no control.
      const ring = { l: box!.l - 4, t: box!.t - 4, r: box!.r + 4, b: box!.b + 4 };
      for (const o of m.others) {
        const meets = ring.l < o.r - .5 && o.l < ring.r - .5 && ring.t < o.b - .5 && o.t < ring.b - .5;
        expect(meets, `the chat meets ${o.sel} (${Math.round(o.l)},${Math.round(o.t)}–${Math.round(o.r)},${Math.round(o.b)})`).toBe(false);
      }
      expect(m.others.some(o => o.sel === '.td-skills'), 'the spell bar is on screen').toBe(true);
      // Typing: the input takes focus and a line goes out from the row.
      await input.tap();
      await expect(input).toBeFocused();
      await input.fill('hello from a phone');
      await send.tap();
      await expect(page.locator('.td-chat__log')).toContainText('Aster: hello from a phone', { timeout: 10000 });
      if (size.width === 390) {
        await page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card { visibility: hidden !important; }' });
        await page.screenshot({ path: 'docs/handoff/cozy-ui/online-phone-chat-after.jpg', type: 'jpeg', quality: 78 });
      }
    });
  });
}

test.describe('the phone chat lifts over the on-screen keyboard', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
  test('--kb-inset follows the visual viewport', async ({ page }) => {
    test.setTimeout(60_000);
    await enterAs(page, hearth.port, 'Aster', 'warlock');
    const before = (await page.locator('.td-chat').boundingBox())!;
    // The keyboard (Android Chrome: the visual viewport shrinks, the layout does not): 300px of it.
    await page.evaluate(() => {
      const vv = window.visualViewport!;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => innerHeight - 300 });
      vv.dispatchEvent(new Event('resize'));
    });
    await expect.poll(async () => (await page.locator('.td-chat').boundingBox())!.y).toBeLessThan(before.y - 250);
    const after = (await page.locator('.td-chat').boundingBox())!;
    expect(after.y + after.height).toBeLessThanOrEqual(844 - 300 + 1);
  });
});
