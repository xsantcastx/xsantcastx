/**
 * td-book.spec.ts — the Skill Book (K, play/spellbook/skill-book; docs/design/skill-book.md) as a player meets it: one
 * skill a row, six marks beneath each row, ranks and marks staged until Accept, Cancel undoing them, the one-time note
 * after the rebinding, every control a 44px target — and, on a 360×640 phone with touch, a book that scrolls inside its
 * own window and whose Accept (the last control a player needs) can be reached and pressed.
 *
 * Screenshots of the book land in docs/handoff/book/ (1280×800 and 390×844).
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

type Tree = { spent: Record<string, number>; free: string[]; nodes?: Record<string, number>; book?: number; rebound?: number; at: number };

async function open(page: Page, o: { level?: number; vocation?: string; tree?: Tree; key?: boolean } = {}): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, {
    'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': '55', ...activity({ hunting: xpForLevel(o.level ?? 13) }),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Tomas', vocation: o.vocation ?? 'warlock', skin: 2, hair: 'cropped', updatedAt: 1, ...(o.tree ? { tree: o.tree } : {}) },
  });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.addStyleTag({ content: '.lvl-banner, .glim-say { visibility: hidden !important; }' });
  if (o.key === false) return;
  await page.locator('canvas').first().focus();
  await page.keyboard.press('k');
  await expect(page.locator('.sbook .book')).toBeVisible();
}
const unused = async (page: Page) => Number(await page.locator('[data-book-unused]').textContent());
const saved = async (page: Page): Promise<Tree> => (await blob<{ tree?: Tree }>(page, 'godforge-keeper-look'))?.tree ?? { spent: {}, free: [], at: 0 };

test('the book on a desk: rows and marks, staged until Accept, Cancel undoes, a star is one of two', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  // Level 16: 16 points, enough for Hellfire Nova to rank 10 and five of its marks.
  await open(page, { level: 16 });
  // The Warlock's three pages and the Common page, Ember open; one row a skill, in the order they open.
  await expect(page.locator('.book__tab:not(.book__tab--keys)')).toHaveCount(4);
  await expect(page.locator('[data-book-tab="ember"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.brow')).toHaveCount(6);
  await expect(page.locator('.brow').first()).toHaveAttribute('data-row', 'ember-bolt');
  await expect(page.locator('.brow[data-row="ember-bolt"] .brow__rank b')).toHaveText('r 1/20');
  await expect(page.locator('.brow[data-row="meteor"] .brow__name small')).toHaveText('Opens at level 24');
  await expect(page.locator('.brow[data-row="meteor"] .bmark')).toHaveCount(0);
  // Six marks a row, in two branches; the folded passive sits where it was folded.
  await expect(page.locator('.brow[data-row="ember-bolt"] .bmark')).toHaveCount(6);
  await expect(page.locator('[data-mark="ember-bolt.a3"]')).toHaveAttribute('aria-label', /^Ember Mastery/);
  const pts = await unused(page);
  expect(pts).toBeGreaterThan(5);
  await expect(page.locator('[data-book-accept]')).toBeDisabled();

  // Stage: a rank in Hellfire Nova and its first mark. Nothing is saved until Accept.
  await page.locator('[data-plus="hellfire-nova"]').click();
  await expect(page.locator('.brow[data-row="hellfire-nova"] .brow__rank b')).toHaveText('r 2/20');
  await page.locator('[data-mark="hellfire-nova.a1"]').click();
  await expect(page.locator('[data-mark="hellfire-nova.a1"]')).toHaveClass(/bmark--pending/);
  expect(await unused(page)).toBe(pts - 2);
  await expect(page.locator('.book__pending')).toHaveText('2 pending');
  expect((await saved(page)).spent['hellfire-nova'] ?? 0).toBe(0);
  // A mark's card says what it does and what it needs (a hover on a desk).
  await page.locator('[data-mark="hellfire-nova.a2"]').hover();
  await expect(page.locator('.bcard[data-card="hellfire-nova.a2"]')).toContainText('Scorched Earth');
  await expect(page.locator('.bcard[data-card="hellfire-nova.a2"]')).toContainText('Needs rank 5');
  // Cancel: back to the saved book.
  await page.locator('[data-book-cancel]').click();
  await expect(page.locator('.brow[data-row="hellfire-nova"] .brow__rank b')).toHaveText('r 1/20');
  expect(await unused(page)).toBe(pts);

  // Ranks to 10 and the Edge branch to its star: then the other star is closed.
  for (let i = 0; i < 9; i++) await page.locator('[data-plus="hellfire-nova"]').click();
  for (const s of ['a1', 'a2', 'a3']) await page.locator(`[data-mark="hellfire-nova.${s}"]`).click();
  await page.locator('[data-mark="hellfire-nova.b1"]').click();
  await page.locator('[data-mark="hellfire-nova.b2"]').click();
  await expect(page.locator('[data-mark="hellfire-nova.b3"]')).toHaveClass(/bmark--blocked/);
  await page.locator('[data-book-accept]').click();
  await expect(page.locator('[data-book-accept]')).toBeDisabled();
  await expect.poll(async () => (await saved(page)).nodes?.['hellfire-nova']).toBe(1 | 2 | 4 | 8 | 16);
  expect((await saved(page)).spent['hellfire-nova']).toBe(9);
  expect((await saved(page)).book).toBe(2);
  // The other star asks to swap: the point moves.
  await page.locator('[data-mark="hellfire-nova.b3"]').click();
  await expect(page.locator('.bask')).toContainText('Swap Twin Nova for Cinder Ward?');
  await page.locator('.bask__yes').click();
  await expect(page.locator('[data-mark="hellfire-nova.b3"]')).toHaveClass(/bmark--pending/);
  await expect(page.locator('[data-mark="hellfire-nova.a3"]')).toHaveClass(/bmark--blocked/);
  await page.locator('[data-book-accept]').click();
  await expect.poll(async () => (await saved(page)).nodes?.['hellfire-nova']).toBe(1 | 2 | 8 | 16 | 32);

  // Every control in the book is a 44px target.
  const small = await page.locator('.sbook button:visible').evaluateAll(els => els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && (r.width < 43.5 || r.height < 43.5)).length);
  expect(small).toBe(0);
  await page.mouse.move(2, 2);
  await page.locator('.brow[data-row="hellfire-nova"] .brow__icon').click();
  await page.screenshot({ path: 'docs/handoff/book/book-desktop.png' });
  // The Keys tab: all eight keys of the bar (it showed 1–4 while the bar has 8), and the belt's three keys.
  await page.locator('[data-book-tab="keys"]').click();
  await expect(page.locator('[data-key-row="hellfire-nova"] .bkey__key')).toHaveCount(8);
  await expect(page.locator('[data-belt-key]')).toHaveCount(3);
  // A skill put on 7 stays on 7 (the bar used to compact it to the first free key).
  await page.locator('[data-key-row="hellfire-nova"] .bkey__key[data-slot="7"]').click();
  await expect(page.locator('[data-key-row="hellfire-nova"] .bkey__key[data-slot="7"]')).toHaveAttribute('aria-pressed', 'true');
  // With nothing pending the X closes at once; with something pending it asks first.
  await page.locator('[data-book-tab="ember"]').click();
  await page.locator('[data-plus="ember-bolt"]').click();
  await page.locator('.spellbook .win-x').click();
  await expect(page.locator('.bask')).toContainText('Close and drop your changes?');
  await page.locator('.bask__yes').click();
  await expect(page.locator('.sbook')).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('an old book is rebound: the folded passives\' points come back, the note is read once', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // A tree-board save: points in Ember Mastery and Soul Harvest (now marks), and in two rows.
  await open(page, { level: 20, tree: { spent: { 'ember-mastery': 4, 'soul-harvest': 2, 'hellfire-nova': 3, 'bone-spear': 2 }, free: [], at: 5 } });
  await expect(page.locator('.bnote')).toContainText('Your book has been rebound');
  // No rank lost: the rows keep theirs.
  await expect(page.locator('.brow[data-row="hellfire-nova"] .brow__rank b')).toHaveText('r 4/20');
  const pts = await unused(page);
  await expect(page.locator('.bnote')).toContainText(`${pts} unused`);
  await page.locator('[data-book-note]').click();
  await expect(page.locator('.bnote')).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).book).toBe(2);
  const tree = await saved(page);
  expect(tree.rebound).toBeUndefined();
  expect(tree.spent).toEqual({ 'hellfire-nova': 3, 'bone-spear': 2 });
  // Read once: a reopened book shows no note.
  await page.locator('.spellbook .win-x').click();
  await page.locator('canvas').first().focus();
  await page.keyboard.press('k');
  await expect(page.locator('.sbook .book')).toBeVisible();
  await expect(page.locator('.bnote')).toHaveCount(0);
});

test.describe('the book on a phone', () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    test(`${size.width}×${size.height}: the book scrolls in its window; the last row's marks and Accept are reached and pressed`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(size);
      await open(page, { level: 30, key: false });
      await page.locator('[data-hb="spellbook"]:visible, .td-dock button[title*="(K)"]:visible').first().tap();
      await expect(page.locator('.sbook .book')).toBeVisible();
      const scroll = page.locator('.sbook .book__scroll');
      // The page is longer than the window: it scrolls inside it (not the whole screen).
      expect(await scroll.evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
      // The last row on the page: a rank, then its first mark (a tap picks it and shows its card; the card's Take takes it).
      const last = page.locator('.brow').last();
      const id = await last.getAttribute('data-row');
      await last.scrollIntoViewIfNeeded();
      await last.locator('.brow__plus').tap();
      const mark = last.locator('.bmark').first();
      await mark.scrollIntoViewIfNeeded();
      await mark.tap();
      await expect(page.locator(`.bcard[data-card="${id}.a1"]`)).toBeVisible();
      await page.locator('.bcard__act').tap();
      await expect(mark).toHaveClass(/bmark--pending/);
      // Scrolled to its very end, the book's foot is on screen: Accept is what a tap there hits.
      await scroll.evaluate(e => { e.scrollTop = e.scrollHeight; });
      const accept = page.locator('[data-book-accept]');
      const box = (await accept.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-book-accept]'), { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
      // Nothing spills sideways.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (size.width === 390) await page.screenshot({ path: 'docs/handoff/book/book-phone.png' });
      await accept.tap();
      await expect.poll(async () => (await saved(page)).nodes?.[id!]).toBe(1);
    });
  }
});
