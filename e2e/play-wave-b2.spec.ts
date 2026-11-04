/**
 * play-wave-b2.spec.ts — UI pass 3, Wave B part 2 (docs/design/ui-pass-3.md "## Waves" → Wave B; docs/handoff/uiwb2.md).
 *
 * Accept when, on an Android phone emulated (touch, mobile viewport):
 *   1. Sideways (844×390, 932×430) the satchel is one window: the doll's panel on the left (≥ 300 px, about 40%), the
 *      grid on the right in 5-column pages at 44–52 px cells; a tapped piece's card docks inside the left panel and
 *      never covers the grid.
 *   2. Sideways the Vault and the satchel stand side by side at 44 px, the Vault's tab chips over the Vault; the foot
 *      keeps Deposit all and Take all, Sort waits behind the ?.
 *   3. Portrait (360×640) the Vault's switch stays under the title row (sticky), the grid is centred, the foot is in
 *      view at scrollTop 0 with no Sort on it.
 *   4. The Skill Book's Keys tab is a picture of the real layout — the arc round the disc on a portrait phone (1–4 and
 *      5–8 by its page chip), the bar's eight keys sideways and on a desktop — with the belt beside it; tap a skill
 *      then a key puts it there ("on N" on the skill), and on a desktop a mouse drag does the same. The tab row never
 *      truncates Keys at 360, and "Unused points" keeps its words.
 *   5. The Chat sheet on a phone (portrait and sideways) is anchored to the foot, about 60% of the screen tall
 *      (portrait), its tabs, × and Send at least 44 px, the input 16 px.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed, SKILLS_LEARNED } from './play-helpers';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const canvas = (page: Page) => page.locator('.viewport canvas');
const SIDEWAYS = [{ width: 844, height: 390 }, { width: 932, height: 430 }];

async function boot(page: Page, query = '', blobs: Record<string, unknown> = {}): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { ...SKILLS_LEARNED, 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'preferred-language': 'en', ...blobs });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.addStyleTag({ content: '.lvl-banner, .glim-say { visibility: hidden !important; }' });
  await page.waitForTimeout(600);
}
const rect = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
const focusWorld = (page: Page) => canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));

for (const size of SIDEWAYS) {
  test.describe(`sideways ${size.width}x${size.height}`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });

    test('1. the satchel: doll panel left, the grid right at 44–52 px, the card docks in the left panel', async ({ page }) => {
      test.setTimeout(90_000);
      await boot(page);
      await focusWorld(page);
      await page.keyboard.press('i');
      const book = page.locator('#satchel-book');
      await expect(book).toHaveClass(/book--paged/);
      const doll = await rect(page, '#satchel-book .book-doll'), grid = await rect(page, '#satchel-book .satchel-grid'), win = await rect(page, '#satchel-book');
      expect(win.w, 'one window across the screen').toBeGreaterThan(size.width - 40);
      expect(doll.w, 'the left panel is at least 300 wide').toBeGreaterThanOrEqual(299);
      expect(grid.l, 'the grid is right of the doll').toBeGreaterThanOrEqual(doll.r);
      const cells = await book.locator('.satchel-grid .ig-cell, .satchel-grid .ig-piece').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
      expect(cells.length).toBeGreaterThan(0);
      for (const w of cells) { expect(w).toBeGreaterThanOrEqual(44); expect(w).toBeLessThanOrEqual(52); }
      // Every pocket answers a tap at ≥ 44.
      const pieces = book.locator('.satchel-grid .ig-piece');
      expect(await pieces.count()).toBeGreaterThan(0);
      await pieces.first().tap();
      const card = page.locator('.d2tip--pinned');
      await expect(card).toBeVisible();
      const c = await rect(page, '.d2tip--pinned');
      expect(c.r, 'the card sits in the left panel').toBeLessThanOrEqual(grid.l + 1);
      expect(c.t).toBeGreaterThanOrEqual(win.t);
      expect(c.b).toBeLessThanOrEqual(size.height);
      // The piece it describes stays in view and uncovered.
      const hit = await pieces.first().evaluate(el => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && el.contains(h); });
      expect(hit, 'the tapped piece is not under its card').toBe(true);
    });

    test('2. the Vault: side by side at 44 px, tab chips over the Vault, Deposit all and Take all on the foot', async ({ page }) => {
      test.setTimeout(90_000);
      await boot(page, '&at=vault');
      await expect(page.locator('[data-vault-stash]')).toBeVisible({ timeout: 20000 });
      const grids = page.locator('.place [data-vault-stash] app-item-grid');
      await expect(grids).toHaveCount(2);
      const [v, s] = [await grids.nth(0).boundingBox(), await grids.nth(1).boundingBox()];
      expect(v!.x + v!.width, 'the Vault left of the satchel').toBeLessThanOrEqual(s!.x);
      expect(Math.abs(v!.y - s!.y), 'the two grids start level').toBeLessThanOrEqual(2);
      const cell = await page.locator('.place [data-vault-stash] .ig-cell').first().evaluate(e => Math.round(e.getBoundingClientRect().width));
      expect(cell).toBe(44);
      const chips = await rect(page, '.place [data-vault-tabs]');
      expect(chips.r, 'the tab chips head the Vault column').toBeLessThanOrEqual(s!.x);
      for (const sel of ['[data-vault-deposit]', '[data-vault-takeall]']) {
        const b = await rect(page, `.place ${sel}`);
        expect(b.b, `${sel} in view`).toBeLessThanOrEqual(size.height);
        expect(Math.min(b.w, b.h)).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator('.place [data-vault-actions] [data-vault-sort], .place [data-vault-actions] [data-vault-sort-bag]')).toHaveCount(0);
      await page.locator('.place:not([hidden]) .ss__help').tap();
      await expect(page.locator('.place [data-vault-sorts] [data-vault-sort-bag]')).toBeVisible();
    });
  });
}

test.describe('portrait 360x640', () => {
  test.use({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });

  test('3. the Vault: a sticky switch, the grid centred, the foot in view with no Sort', async ({ page }) => {
    test.setTimeout(90_000);
    await boot(page, '&at=vault');
    await expect(page.locator('[data-vault-switch]')).toBeVisible({ timeout: 20000 });
    expect(await page.locator('[data-vault-switch]').evaluate(el => getComputedStyle(el).position)).toBe('sticky');
    const side = await rect(page, '.place .vs-side:not([hidden])'), grid = await rect(page, '.place .vs-side:not([hidden]) app-item-grid .ig');
    expect(Math.abs((grid.l - side.l) - (side.r - grid.r)), 'the grid is centred').toBeLessThanOrEqual(2);
    for (const sel of ['[data-vault-deposit]', '[data-vault-takeall]']) {
      const b = await rect(page, `.place ${sel}`);
      expect(b.b, `${sel} in view at scrollTop 0`).toBeLessThanOrEqual(640);
      const hit = await page.locator(`.place ${sel}`).evaluate(el => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && el.contains(h); });
      expect(hit, `${sel} answers a tap`).toBe(true);
    }
    await expect(page.locator('.place [data-vault-actions] [data-vault-sort-bag]')).toHaveCount(0);
  });
});

for (const size of [{ width: 360, height: 640, arc: true }, { width: 390, height: 844, arc: true }, { width: 844, height: 390, arc: false }]) {
  test.describe(`4. the Keys tab at ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
    test('a picture of the real layout; tap a skill, then a key', async ({ page }) => {
      test.setTimeout(90_000);
      await boot(page);
      await focusWorld(page);
      await page.keyboard.press('k');
      const keysTab = page.locator('[data-book-tab="keys"]');
      await expect(keysTab).toBeVisible();
      // The Keys chip is whole (never "Ke…") and inside the screen; "Unused points" keeps its words.
      const k = await keysTab.evaluate(el => { const r = el.getBoundingClientRect(), w = el.querySelector('.book__tab-word') as HTMLElement; return { r: r.right, w: r.width, clipped: w.scrollWidth > w.clientWidth + 1, word: getComputedStyle(w).display }; });
      expect(k.r).toBeLessThanOrEqual(size.width);
      expect(k.clipped).toBe(false);
      expect(k.word).not.toBe('none');
      await expect(page.locator('.book__unused small')).toBeVisible();
      await keysTab.tap();
      await expect(page.locator(size.arc ? '[data-keys-arc]' : '[data-keys-bar]')).toBeVisible();
      await expect(page.locator('[data-belt-key]')).toHaveCount(3);
      await expect(page.locator('[data-keys-pic] [data-key-slot]')).toHaveCount(size.arc ? 4 : 8);
      for (const b of await page.locator('[data-keys-pic] button, [data-key-skill]').evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => Math.min(r.width, r.height)))) expect(b).toBeGreaterThanOrEqual(44);
      // Tap Bone Spear, then key 2 (and on the arc, key 6 on its second page).
      await page.locator('[data-key-skill="bone-spear"]').tap();
      await expect(page.locator('[data-keys-hint]')).toContainText(/tap a key/i);
      await page.locator('[data-key-slot="2"]').tap();
      await expect(page.locator('[data-key-slot="2"]')).toHaveClass(/is-held/);
      await expect(page.locator('[data-key-skill="bone-spear"] [data-key-on]')).toHaveText('on 2');
      if (size.arc) {
        await page.locator('[data-keys-page]').tap();
        await expect(page.locator('[data-keys-arc] [data-key-slot="6"]')).toBeVisible();
        // A key first, then the skill.
        await page.locator('[data-key-slot="6"]').tap();
        await page.locator('[data-key-skill="bone-spear"]').tap();
        await expect(page.locator('[data-key-slot="6"]')).toHaveClass(/is-held/);
      }
    });
  });
}

test.describe('4b. the Keys tab on a desktop: drag a skill onto a key', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('a mouse drag puts the skill on the key it lands on', async ({ page }) => {
    test.setTimeout(90_000);
    await boot(page);
    await focusWorld(page);
    await page.keyboard.press('k');
    await page.locator('[data-book-tab="keys"]').click();
    await expect(page.locator('[data-keys-bar] [data-key-slot]')).toHaveCount(8);
    const from = (await page.locator('[data-key-skill="bone-spear"]').boundingBox())!, to = (await page.locator('[data-key-slot="5"]').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + 10, { steps: 4 });
    await expect(page.locator('.bkeys__ghost')).toBeVisible();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-key-slot="5"]')).toHaveClass(/is-held/);
    await expect(page.locator('[data-key-skill="bone-spear"] [data-key-on]')).toHaveText('on 5');
    await expect(page.locator('.bkeys__ghost')).toHaveCount(0);
  });
});

for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test.describe(`5. the Chat sheet at ${size.width}x${size.height}`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true, userAgent: ANDROID_UA });
    test('anchored to the foot, 44 px tabs, a 16 px input with Send', async ({ page }) => {
      test.setTimeout(90_000);
      await boot(page);
      await page.locator('[data-th="more"]').tap();
      await page.locator('[data-tile="chat"]').tap();
      const chat = page.locator('.td-chat');
      await expect(chat).toBeVisible();
      const c = await rect(page, '.td-chat');
      expect(Math.round(size.height - c.b), 'anchored to the foot').toBeLessThanOrEqual(10);
      if (size.height > size.width) expect(c.h / size.height).toBeGreaterThan(.55);
      for (const h of await chat.locator('.td-chat__tabs button').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
      // The Chat tab: the room's line (or the Join button) at 44.
      await chat.locator('.td-chat__tabs [role="tab"]').nth(1).tap();
      const last = chat.locator('.td-chat__say input, .td-chat__join').first();
      if (await last.count()) {
        const b = (await last.boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.y + b.height).toBeLessThanOrEqual(size.height);
        if (await chat.locator('.td-chat__say input').count()) expect(await chat.locator('.td-chat__say input').evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
      }
      await chat.locator('.td-chat__x').tap();
      await expect(chat).toBeHidden();
    });
  });
}
