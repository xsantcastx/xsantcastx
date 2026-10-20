/**
 * td-spelltree.spec.ts — the Warlock's skill trees in the Spellbook (K) (docs/design/skill-trees.md): a Keeper at
 * level 13 spends a point, sees the rank and the card change, puts a skill from the Bone tree on key 3 and casts it,
 * then takes every point back. Screenshots of each tree and of a phone land in docs/handoff/cozy-ui/spelltree-*.jpg.
 * Nothing here asserts on a fight's outcome.
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, pickSkill, seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

const LEVEL = 13;

async function open(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  // The realm-era stamp keeps the seeded ledger (without it the game wipes a ledger it cannot date).
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': '55', ...activity({ hunting: xpForLevel(LEVEL) }) });
  await page.goto('/play?td=1&hour=12');
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.locator('canvas').first().focus();
  await page.keyboard.press('k');
  await expect(page.locator('.sbt')).toBeVisible();
}

test('the trees: spend a point, the rank and the card follow, a Bone skill goes on key 3 and is cast', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page, { width: 1280, height: 800 });
  // The points earned are the Keeper curve's level − 1 plus the milestones' bonus (skill-points.ts): read, not assumed.
  await expect(page.locator('.sbt__pts')).toHaveText(/^Skill points: \d+$/);
  const PTS = Number((await page.locator('.sbt__pts').textContent())!.replace(/\D/g, ''));
  await expect(page.locator('.sbt__tab[data-tree="ember"]')).toHaveAttribute('aria-selected', 'true');
  // Ember: the starting kit holds rank 1; Meteor (level 24) is locked and says so.
  await expect(page.locator('.sbt__node[data-skill="hellfire-nova"] .sbt__badge')).toHaveText('1');
  await expect(page.locator('.sbt__node[data-skill="meteor"]')).toHaveClass(/sbt__node--locked/);
  await expect(page.locator('.sbt__node[data-skill="meteor"] .sbt__need')).toHaveText('Lv 24');
  await page.screenshot({ path: 'docs/handoff/cozy-ui/spelltree-ember.jpg', type: 'jpeg', quality: 85 });

  // Bone: learn Bone Spear, then a second rank; the card shows this rank's numbers and the next rank's change.
  await pickSkill(page, 'bone-spear');
  const card = page.locator('.sbt__detail');
  await expect(card.locator('.sbt__rank')).toHaveText('Rank 0/20');
  await card.locator('.sbt__learn').click();
  await expect(card.locator('.sbt__rank')).toHaveText('Rank 1/20');
  await expect(page.locator('.sbt__node[data-skill="bone-spear"] .sbt__badge')).toHaveText('1');
  await card.locator('.sbt__learn').click();
  await expect(card.locator('.sbt__rank')).toHaveText('Rank 2/20');
  await expect(card.locator('.sbt__now')).toContainText('26–38 damage');
  await expect(card.locator('.sbt__next')).toContainText('Rank 2 → 3');
  await expect(card.locator('.sbt__next')).toContainText('Damage: 26–38 → 30–44');
  await expect(page.locator('.sbt__pts')).toHaveText(`Skill points: ${PTS - 2}`);
  // Its prerequisite held, Corpse Burst opens: one point in it.
  await pickSkill(page, 'corpse-burst');
  await card.locator('.sbt__learn').click();
  await expect(card.locator('.sbt__rank')).toHaveText('Rank 1/20');
  await page.screenshot({ path: 'docs/handoff/cozy-ui/spelltree-bone.jpg', type: 'jpeg', quality: 85 });

  // Put Corpse Burst on key 3: the bar follows; cast it (whatever answers — a corpse or "No fresh corpse").
  await card.locator('.sb__keys button', { hasText: '3' }).click();
  await expect(page.locator('.td-skill').nth(2)).toHaveAttribute('aria-label', /Corpse Burst/);
  const saved = await blob<{ tree: { spent: Record<string, number> } }>(page, 'godforge-keeper-look');
  expect(saved?.tree.spent).toEqual({ 'bone-spear': 2, 'corpse-burst': 1 });

  await pickSkill(page, 'weaken');
  await page.screenshot({ path: 'docs/handoff/cozy-ui/spelltree-shadow.jpg', type: 'jpeg', quality: 85 });

  await page.locator('.spellbook .win-x').click();
  await expect(page.locator('.sbt')).toHaveCount(0);
  await page.locator('canvas').first().focus();
  await page.keyboard.press('3');
  await page.waitForTimeout(300);

  // The free respec, asked once: every point back, the kit's ranks stay.
  await page.keyboard.press('k');
  await page.locator('.sbt__reset').click();
  await page.locator('.sbt__yes').click();
  await expect(page.locator('.sbt__pts')).toHaveText(`Skill points: ${PTS}`);
  await pickSkill(page, 'drain-life');
  await expect(page.locator('.sbt__detail .sbt__rank')).toHaveText('Rank 1/20');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the trees on a phone: tabs, the tree and the card fit at 390×844 with 44px targets', async ({ page }) => {
  await open(page, { width: 390, height: 844 });
  await pickSkill(page, 'raise-skeleton');
  await page.locator('.sbt__detail .sbt__learn').click();
  await expect(page.locator('.sbt__detail .sbt__rank')).toHaveText('Rank 1/20');
  const sheet = (await page.locator('.sbt').boundingBox())!;
  expect(sheet.x).toBeGreaterThanOrEqual(0);
  expect(sheet.x + sheet.width).toBeLessThanOrEqual(390);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(844);
  for (const sel of ['.sbt__tab', '.sbt__node', '.sbt__learn', '.sbt__detail .sb__keys button', '.sbt__reset']) {
    for (const box of await page.locator(sel).evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ w: r.width, h: r.height })))) {
      expect(Math.min(box.w, box.h), sel).toBeGreaterThanOrEqual(44);
    }
  }
  await page.screenshot({ path: 'docs/handoff/cozy-ui/spelltree-phone.jpg', type: 'jpeg', quality: 85 });
});
