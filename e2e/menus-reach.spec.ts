/**
 * menus-reach.spec.ts — every full-screen menu the lobby and the game open can be scrolled to its end on a phone, and
 * its last control can be pressed (owner, 2026-10-21, from an Android phone: "Cant scroll down we need to make sure
 * all menus we create are accesable" — the Glass's Become was below the fold and out of reach).
 *
 * Android Chrome is emulated (touch, mobile viewport, an Android user agent) at 390×844, 360×640 (a small Android)
 * and 844×390 (sideways). For each menu: a real touch swipe (CDP's synthesized scroll gesture, which honours
 * touch-action and overscroll like a finger) must move a scroll container that has more to show; then every scroll
 * container inside it is taken to its end, and the menu's LAST interactive control must be inside the screen and be
 * what a tap there would hit (document.elementFromPoint at its centre).
 *
 * Menus: the title, the character list (the campfire), the Glass (New Keeper), the delete confirm; in the world the Spellbook, the
 * Satchel, the character sheet, the Bestiary, the Map, the Hearth Shrine, Sexton Wren's talk window, the settings
 * (sound) sheet, the Sexton's journal and a Harbourmaster's Sailing Board.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, openMenu, seed } from './play-helpers';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
  { name: '844x390', width: 844, height: 390 },
];
const canvas = (page: Page) => page.locator('.viewport canvas');
const lobby = (page: Page, mode: string) => page.locator(`.lobby[data-lobby="${mode}"]`);

interface Reach { ok: boolean; why: string; last: string; scrollers: number }

/** A real touch swipe up over `sel` (content moves up, i.e. scrolling down), as a finger would. */
async function swipe(page: Page, sel: string): Promise<void> {
  // Over the first part of the menu that scrolls (a finger on the footer would move nothing, rightly).
  const box = await page.evaluate(s => {
    const root = document.querySelector(s);
    if (!root) return null;
    const el = [root, ...root.querySelectorAll('*')].find(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2) ?? root;
    const r = el.getBoundingClientRect();
    const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    return { x: r.left, y: top, width: r.width, height: Math.max(0, bottom - top) };
  }, sel);
  if (!box || box.height < 20) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizeScrollGesture', {
    x: Math.round(box.x + box.width / 2), y: Math.round(box.y + Math.min(box.height - 10, box.height * 0.7)),
    yDistance: -Math.round(Math.min(400, box.height * 0.6)), gestureSourceType: 'touch', speed: 1200,
  });
  await cdp.detach();
}

/** Scroll positions of every scroll container in `sel` that has more to show. */
const scrollTops = (page: Page, sel: string) => page.evaluate(s => {
  const root = document.querySelector(s);
  if (!root) return [] as number[];
  return [root, ...root.querySelectorAll('*')].filter(el => {
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
  }).map(el => el.scrollTop);
}, sel);

/** Take every scroller to its end, then hit-test the menu's last control. */
const reach = (page: Page, sel: string): Promise<Reach> => page.evaluate(async s => {
  const root = document.querySelector(s);
  if (!root) return { ok: false, why: 'menu not found', last: '', scrollers: 0 };
  const scrollers = [root, ...root.querySelectorAll('*')].filter(el => {
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
  });
  for (const el of scrollers) el.scrollTop = el.scrollHeight;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden], [inert]');
  };
  const ctrls = [...root.querySelectorAll('button, input:not([type="hidden"]), select, textarea, a[href], [role="button"]')].filter(shown);
  const last = ctrls[ctrls.length - 1];
  if (!last) return { ok: false, why: 'no control', last: '', scrollers: scrollers.length };
  const r = last.getBoundingClientRect();
  const label = (last.getAttribute('aria-label') || (last as HTMLElement).innerText || last.tagName).trim().slice(0, 40);
  if (r.top < 0 || r.left < 0 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5) {
    return { ok: false, why: `off screen ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} in ${innerWidth}x${innerHeight}`, last: label, scrollers: scrollers.length };
  }
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const ok = !!hit && (hit === last || last.contains(hit));
  return { ok, why: ok ? '' : `covered by ${hit?.tagName}.${(hit as HTMLElement | null)?.className ?? ''}`, last: label, scrollers: scrollers.length };
}, sel);

/** The whole check for one open menu: a finger swipe moves it if it scrolls, and its last control can be pressed. */
async function check(page: Page, name: string, sel: string): Promise<void> {
  await expect(page.locator(sel).first(), name).toBeVisible({ timeout: 15000 });
  // Let an opening window finish arriving (some slide up) before the finger goes down.
  await page.waitForTimeout(700);
  // From the top (a window may open scrolled to its focused button).
  await page.evaluate(s => {
    const root = document.querySelector(s);
    if (root) for (const el of [root, ...root.querySelectorAll('*')]) if (el.scrollTop) el.scrollTop = 0;
  }, sel);
  await page.waitForTimeout(100);
  const before = await scrollTops(page, sel);
  if (before.length) {
    await swipe(page, sel);
    await page.waitForTimeout(300);
    const after = await scrollTops(page, sel);
    expect(after.some((t, i) => t > (before[i] ?? 0)), `${name}: a touch swipe scrolls it`).toBe(true);
  }
  const r = await reach(page, sel);
  expect(r.ok, `${name}: last control "${r.last}" reachable (${r.why})`).toBe(true);
}

/** Close whatever is open (Escape), and make sure the world is back. */
async function closeAll(page: Page): Promise<void> {
  // Escape also opens the Game Menu when nothing is up: fold that too, so the world is what is left.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    if (await page.locator('#game-menu').isVisible()) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  }
}

for (const size of SIZES) {
  test.describe(`menus reach their end at ${size.name} (Android)`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });

    test('the lobby: title, character list, the Glass, the delete confirm', async ({ page }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await seed(page, {
        'eclipse-td': '1', 'godforge-realm-era': String(ERA),
        'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Aster', vocation: 'warlock', updatedAt: 1 },
      });
      await page.evaluate(() => {
        localStorage.removeItem('eclipse-lobby');
        const now = Date.now();
        // Four Keepers on the list, so it has something to scroll.
        const chars: Record<string, unknown> = { c1: { id: 'c1', name: 'Aster', vocation: 'warlock', level: 7, area: '', look: null, createdAt: 1, updatedAt: now } };
        for (const [i, n] of ['Bryn', 'Cole', 'Dara'].entries()) {
          const id = `k2${n.toLowerCase()}00`;
          localStorage.setItem(`godforge-keeper-look@${id}`, JSON.stringify({ version: 1, made: true, prompted: true, name: n, updatedAt: 1 }));
          localStorage.setItem(`godforge-inventory@${id}`, JSON.stringify({ v: 1 }));
          chars[id] = { id, name: n, vocation: 'ashguard', level: 2 + i, area: '', look: null, createdAt: 2 + i, updatedAt: now };
        }
        localStorage.setItem('eclipse-characters', JSON.stringify({ v: 1, chars }));
      });
      await page.goto('/play?td=1&hour=12');
      await check(page, 'title', '.lobby[data-lobby="title"]');
      await lobby(page, 'title').locator('[data-lobby-feedback]').tap();
      await check(page, 'feedback form (title)', '.fbhost');
      await page.keyboard.press('Escape');
      await page.locator('.fbhost [data-feedback-close]').tap();
      await lobby(page, 'title').locator('[data-lobby-guest]').tap();
      await check(page, 'character list (the campfire)', '.lobby[data-lobby="select"] [data-character-select]');
      await lobby(page, 'select').locator('[data-character="k2dara00"]').tap();
      await lobby(page, 'select').locator('[data-lobby-delete]').tap();
      await check(page, 'delete confirm', '[data-delete-confirm]');
      await page.locator('[data-delete-confirm] .btn').first().tap();
      await lobby(page, 'select').locator('[data-lobby-new]').tap();
      await expect(lobby(page, 'create')).toBeVisible({ timeout: 30000 });
      await check(page, 'the Glass', '.lobby[data-lobby="create"] .win');
      // Become itself, scrolled to, is reachable too (the one button that matters there).
      const keep = page.locator('.km__keep');
      await keep.scrollIntoViewIfNeeded();
      const k = (await keep.boundingBox())!;
      expect(k.y + k.height).toBeLessThanOrEqual(size.height);
      expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.km__keep'), { x: k.x + k.width / 2, y: k.y + k.height / 2 })).toBe(true);
    });

    test('the world: Spellbook, Satchel, sheet, Bestiary, Map, settings, friends, Shrine, Wren, journal', async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
      await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA) });
      await page.goto('/play?td=1&hour=12&fxfall=1&fxsexton=1&fxparty=1');
      await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
      await page.waitForFunction(() => !!(window as unknown as { __tdHearth?: unknown; __tdSexton?: unknown }).__tdHearth && !!(window as unknown as { __tdSexton?: unknown }).__tdSexton);
      await page.addStyleTag({ content: '.lvl-banner, .glim-say { visibility: hidden !important; }' });
      const key = async (k: string) => { await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true })); await page.keyboard.press(k); };

      await key('k');
      await check(page, 'Spellbook', '.spellbook.sbt');
      await closeAll(page);
      await key('i');
      await check(page, 'Satchel', '#satchel-book');
      await closeAll(page);
      await key('c');
      await check(page, 'character sheet', '.ksheet');
      await closeAll(page);
      await key('m');
      await check(page, 'Map', '#places-list');
      await openMenu(page);
      await check(page, 'Game Menu', '#game-menu');
      await page.locator('#game-menu [data-open="bestiary"]').tap();
      await check(page, 'Bestiary', '.td-best');
      await closeAll(page);
      await openMenu(page);
      await page.locator('#game-menu [data-open="sound"]').tap();
      await check(page, 'settings sheet', '.sound-host');
      await closeAll(page);
      await openMenu(page);
      await page.locator('#game-menu [data-open="friends"]').tap();
      await check(page, 'friends sheet', '.friends-host');
      await closeAll(page);
      await openMenu(page);
      await page.locator('#game-menu [data-open="feedback"]').tap();
      await check(page, 'feedback form', '.feedback-host');
      await page.locator('.feedback-host [data-feedback-message]').fill('A long enough note about the menus, written on a phone.');
      await check(page, 'feedback form, typed in', '.feedback-host');
      await closeAll(page);

      // A corpse opened in the world (E): its window reaches its last control too.
      await page.evaluate(() => { const h = (window as unknown as { __tdParty: { smite: (t: string, dx: number) => unknown; stock: () => unknown } }).__tdParty; h.smite('ash-wolf', 24); h.stock(); });
      await page.waitForTimeout(900);
      await key('e');
      await check(page, 'corpse window', '[data-corpse-window]');
      await closeAll(page);

      // The Hearth Shrine, stood at.
      await page.evaluate(() => (window as unknown as { __tdHearth: { at: (w: string) => unknown } }).__tdHearth.at('shrine'));
      // Let the HUD's prompt catch up with the jump (it names the place in reach) before E.
      await expect(page.locator('.prompt.armed')).toContainText(/shrine/i, { timeout: 5000 });
      await key('e');
      await expect(page.locator('.place:not([hidden]) h2')).toContainText(/Shrine/i);
      await check(page, 'Hearth Shrine', '.place:not([hidden])');
      await closeAll(page);

      // Sexton Wren's talk window (from the Map's key), then his journal once the Count is taken.
      await page.evaluate(() => (window as unknown as { __tdSexton: { to: (w: string) => unknown } }).__tdSexton.to('square'));
      await key('m');
      await page.locator('#places-list [data-map-find]').fill('aldous wren');
      await page.locator('#places-list .td-map__key button[data-kind="npc"]', { hasText: /aldous wren/i }).tap();
      await check(page, "Wren's talk", '.td-talk');
      await page.locator('.td-talk [data-story-accept]').tap();
      await closeAll(page);
      await key('m');
      await page.locator('#places-list [data-map-find]').fill('aldous wren');
      await page.locator('#places-list .td-map__key button[data-kind="npc"]', { hasText: /aldous wren/i }).tap();
      await page.locator('.td-talk [data-story-journal]').first().tap();
      await check(page, 'journal', '.place:not([hidden])');
      await closeAll(page);

      // A Harbourmaster's Sailing Board (play/harbour), from the Map's anchor pin; Esc folds it.
      await key('m');
      await page.locator('#places-list .mw__pin[data-cat="harbour"]').first().tap();
      await check(page, 'Sailing Board', '.td-harbour');
      await page.keyboard.press('Escape');
      await expect(page.locator('.td-harbour')).toHaveCount(0);
    });
  });
}

// A sideways phone: the ☰ Menu and every touch control take their own tap (nothing stacked over another — the Menu was
// once covered by the touch attack button at 844×390, which left the Menu unreachable).
for (const size of [{ width: 844, height: 390 }, { width: 915, height: 412 }]) {
  test.describe(`the HUD's touch controls at ${size.width}x${size.height} (Android, sideways)`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
    test('the Menu button and every touch control take their own tap', async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
      await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA) });
      await page.goto('/play?td=1&hour=12');
      await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
      await page.waitForTimeout(600);
      const bad = await page.evaluate(() => {
        const sels = ['.places-toggle', '.td-dock button', '.touch-act button', '.touch-move button', '.td-skills button', '.td-belt button', '.td-chat-tab'];
        const out: string[] = [];
        for (const s of sels) for (const el of document.querySelectorAll(s)) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === 'hidden') continue;
          // Every corner-in point and the centre: whatever sits on top must be the control itself.
          for (const [fx, fy] of [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]]) {
            const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
            if (!hit || !(hit === el || el.contains(hit) || hit.contains(el) && hit.tagName !== 'SECTION' && !hit.matches('.stage, .viewport, .touch-act, .touch-move, .td-dock, .top-actions'))) { out.push(`${s} (${Math.round(r.left)},${Math.round(r.top)}) under ${hit?.tagName}.${String((hit as HTMLElement | null)?.className ?? '').slice(0, 30)}`); break; }
          }
        }
        return out;
      });
      expect(bad, bad.join('; ')).toEqual([]);
      // And the Menu really opens from a tap.
      await page.locator('.places-toggle').tap();
      await expect(page.locator('#game-menu')).toBeVisible();
    });
  });
}
