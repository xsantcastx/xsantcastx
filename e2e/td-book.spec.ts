/**
 * td-book.spec.ts — the Spellbook page (play/spellbook, docs/design/skill-trees.md) as a player meets it: every control
 * in it is a 44px target on a desk and on a phone, on every tab of every vocation; a rank is learned by clicking — the
 * big Learn button, a second click (or tap) on the skill, its "+" — and from the keyboard (arrows walk, Enter learns).
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

async function open(page: Page, vocation = 'warlock'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, {
    'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': '55', ...activity({ hunting: xpForLevel(13) }),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Tomas', vocation, skin: 2, hair: 'cropped', updatedAt: 1 },
  });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.locator('canvas').first().focus();
  await page.keyboard.press('k');
  await expect(page.locator('.sbt')).toBeVisible();
}

const points = async (page: Page): Promise<number> => Number((await page.locator('.sbt__pts').textContent())!.replace(/\D/g, ''));
const badge = async (page: Page, id: string): Promise<number> => Number(await page.locator(`.sbt__node[data-skill="${id}"] .sbt__badge`).textContent());

/** Every visible button and fold in the window, on every tab: none under 44px either way. */
async function measureAll(page: Page): Promise<number> {
  let n = 0;
  const tabs = await page.locator('.sbt__tab').evaluateAll(els => els.map(e => e.getAttribute('data-tree')!));
  for (const tree of tabs) {
    await page.locator(`.sbt__tab[data-tree="${tree}"]`).click();
    const ids = await page.locator('.sbt__node').evaluateAll(els => els.map(e => e.getAttribute('data-skill')!));
    for (const id of ids.slice(0, 3)) {
      await page.locator(`.sbt__node[data-skill="${id}"]`).click();
      await page.waitForTimeout(450);   // past the double-click window: a pick, never a learn
      // Unfold Synergies and the Spellstone so their buttons are measured too.
      const closed = page.locator('.sbt__detail details:not([open]) > summary');
      for (let i = 0; i < 3 && await closed.count(); i++) await closed.first().click();
      const small = await page.locator('.spellbook').evaluate(root => [...root.querySelectorAll<HTMLElement>('button, summary')]
        .map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden')
        .map(({ el, r }) => ({ what: `${el.className || el.tagName} ${el.textContent?.trim().slice(0, 24)}`, w: Math.round(r.width), h: Math.round(r.height) })));
      for (const b of small) { n++; expect(Math.min(b.w, b.h), `${tree}/${id}: ${b.what} ${b.w}×${b.h}`).toBeGreaterThanOrEqual(44); }
    }
  }
  return n;
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const vocation of ['warlock', 'ashguard', 'lanternwright']) {
    test(`every control in the ${vocation}'s Spellbook is at least 44px`, async ({ page }) => {
      test.setTimeout(120000);
      await open(page, vocation);
      expect(await measureAll(page)).toBeGreaterThan(20);
    });
  }

  test('a rank is learned by clicking: the button, a second click, the "+", and Enter', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    const pts = await points(page);
    await expect(page.locator('.sbt__banner--has')).toBeVisible();
    // The tab shows its icon and the ranks it holds.
    await expect(page.locator('.sbt__tab[data-tree="ember"] .sbt__tab-icon svg')).toHaveCount(1);
    // Meteor is locked: a lock and the level it opens at.
    await expect(page.locator('.sbt__node[data-skill="meteor"]')).toHaveAttribute('data-state', 'locked');
    await expect(page.locator('.sbt__node[data-skill="meteor"] .sbt__lock')).toBeVisible();
    await expect(page.locator('.sbt__node[data-skill="meteor"] .sbt__need')).toHaveText('Lv 24');
    // Flame Wall needs Cinder Rain first: no "+", and the card says why with the button off.
    await page.locator('.sbt__node[data-skill="flame-wall"]').click();
    await expect(page.locator('.sbt__node[data-skill="flame-wall"] .sbt__plus')).toHaveCount(0);
    await expect(page.locator('.sbt__detail .sbt__learn')).toBeDisabled();
    await expect(page.locator('.sbt__detail .sbt__acts .sbt__why')).toHaveText('Needs a rank in Cinder Rain');
    await page.waitForTimeout(450);

    // 1. The big button.
    await page.locator('.sbt__node[data-skill="cinder-rain"]').click();
    await expect(page.locator('.sbt__node[data-skill="cinder-rain"]')).toHaveAttribute('data-state', 'learnable');
    await expect(page.locator('.sbt__detail .sbt__learn')).toHaveText('Learn · 1 point');
    const learn = (await page.locator('.sbt__detail .sbt__learn').boundingBox())!;
    expect(learn.height).toBeGreaterThanOrEqual(44);
    await page.locator('.sbt__detail .sbt__learn').click();
    await expect(page.locator('.sbt__detail .sbt__rank')).toHaveText('Rank 1/20');
    await expect(page.locator('.sbt__detail .sbt__learn')).toHaveText('Rank up · 1 point');
    await expect(page.locator('.sbt__node[data-skill="flame-wall"] .sbt__plus')).toHaveCount(1);   // its prerequisite now held
    // 2. A second click on the picked skill.
    await page.waitForTimeout(450);
    await page.locator('.sbt__node[data-skill="cinder-rain"]').dblclick();
    await expect.poll(() => badge(page, 'cinder-rain')).toBe(2);
    // 3. The "+" on another skill: picks it and learns at once.
    await page.waitForTimeout(450);
    await page.locator('.sbt__node[data-skill="flame-wall"] .sbt__plus').click();
    await expect(page.locator('.sbt__detail')).toHaveAttribute('data-skill', 'flame-wall');
    await expect.poll(() => badge(page, 'flame-wall')).toBe(1);
    // 4. The keyboard: the picked skill holds the tab stop; Up walks to Cinder Rain, Enter learns a rank there.
    await page.locator('.sbt__node[data-skill="flame-wall"]').focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.sbt__detail')).toHaveAttribute('data-skill', 'cinder-rain');
    await expect(page.locator('.sbt__node[data-skill="cinder-rain"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => badge(page, 'cinder-rain')).toBe(3);
    await expect(page.locator('.sbt__pts')).toHaveText(`Skill points: ${pts - 4}`);
    // Right and Left walk the tabs.
    await page.locator('.sbt__tab[data-tree="ember"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.sbt__tab[data-tree="bone"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.sbt__tab[data-tree="bone"]')).toBeFocused();
    // The card's folds: Synergies opens on a click.
    await page.locator('.sbt__node[data-skill="bone-spear"]').click();
    const syn = page.locator('.sbt__detail .sbt__syn');
    if (await syn.count()) { await syn.locator('summary').click(); await expect(syn).toHaveAttribute('open', ''); }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const vocation of ['warlock', 'ashguard', 'lanternwright']) {
    test(`every control in the ${vocation}'s Spellbook is at least 44px on a phone`, async ({ page }) => {
      test.setTimeout(120000);
      await open(page, vocation);
      expect(await measureAll(page)).toBeGreaterThan(20);
    });
  }

  test('on a phone: the board sits above the card, a double-tap learns, nothing spills off the screen', async ({ page }) => {
    await open(page);
    const board = (await page.locator('.sbt__board').boundingBox())!, card = (await page.locator('.sbt__detail').boundingBox())!;
    expect(board.y + board.height).toBeLessThanOrEqual(card.y + 1);
    const sheet = (await page.locator('.sbt').boundingBox())!;
    expect(sheet.x).toBeGreaterThanOrEqual(0);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(390);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(844);
    const pts = await points(page);
    const node = page.locator('.sbt__node[data-skill="cinder-rain"]');
    await node.tap();
    await expect(page.locator('.sbt__detail')).toHaveAttribute('data-skill', 'cinder-rain');
    await expect.poll(() => badge(page, 'cinder-rain')).toBe(0);   // one tap reads, never spends
    await node.tap();
    await expect.poll(() => badge(page, 'cinder-rain')).toBe(1);
    await expect(page.locator('.sbt__pts')).toHaveText(`Skill points: ${pts - 1}`);
    // The Learn button stays in reach at the card's foot.
    const btn = page.locator('.sbt__detail .sbt__learn');
    await expect(btn).toBeInViewport();
    await btn.tap();
    await expect.poll(() => badge(page, 'cinder-rain')).toBe(2);
  });
});

test.describe('phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test('sideways: board and card side by side, every control at least 44px', async ({ page }) => {
    test.setTimeout(120000);
    await open(page, 'lanternwright');
    const board = (await page.locator('.sbt__board').boundingBox())!, card = (await page.locator('.sbt__detail').boundingBox())!;
    expect(board.x + board.width).toBeLessThanOrEqual(card.x + 1);
    expect(await measureAll(page)).toBeGreaterThan(20);
  });
});
