/**
 * td-book-shots.spec.ts — the Spellbook (K) photographed for the handoff (docs/handoff/cozy-ui/book-*.jpg): every
 * vocation's four tabs on a desktop, and the first tab on a phone held upright (390×844) and sideways (844×390).
 * A level-13 Keeper, so each page shows learned, learnable and locked skills at once. BOOK_SHOTS sets the file prefix
 * (`book` by default; `book-before` photographed the old page). Asserts only what both pages share.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

const PREFIX = `docs/handoff/cozy-ui/${process.env['BOOK_SHOTS'] ?? 'book'}`;
const VOCATIONS = ['warlock', 'ashguard', 'lanternwright'] as const;

async function open(page: Page, vocation: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, {
    'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': '55', ...activity({ hunting: xpForLevel(13) }),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Tomas', vocation, skin: 2, hair: 'cropped', updatedAt: 1 },
  });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForTimeout(3500);   // the place's title card fades
  await page.locator('canvas').first().focus();
  await page.keyboard.press('k');
  await expect(page.locator('.sbt')).toBeVisible();
}

/** Pick the tab's second skill, so the card shows something past the starting kit. */
async function pickSecond(page: Page): Promise<void> {
  const nodes = page.locator('.sbt__node');
  await nodes.nth(Math.min(1, (await nodes.count()) - 1)).click();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(250);
}

for (const vocation of VOCATIONS) {
  test(`the Spellbook, desktop: every tab of the ${vocation}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, vocation);
    const tabs = await page.locator('.sbt__tab').evaluateAll(els => els.map(e => e.getAttribute('data-tree')!));
    for (const tree of tabs) {
      await page.locator(`.sbt__tab[data-tree="${tree}"]`).click();
      await pickSecond(page);
      await page.screenshot({ path: `${PREFIX}-${vocation}-${tree}.jpg`, type: 'jpeg', quality: 82 });
    }
  });

  for (const [name, size] of [['phone', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]] as const) {
    test.describe(`${name}`, () => {
      test.use({ viewport: size, isMobile: true, hasTouch: true });
      test(`the Spellbook, ${name}: the ${vocation}'s first tab`, async ({ page }) => {
        test.setTimeout(90000);
        await open(page, vocation);
        await pickSecond(page);
        await page.screenshot({ path: `${PREFIX}-${vocation}-${name}.jpg`, type: 'jpeg', quality: 82 });
      });
    });
  }
}
