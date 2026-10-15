/**
 * play-missions.spec.ts — the Delve missions, turned in on the Quest Board that
 * stands in the Verdant town, reached through the Waystone.
 *
 * The deliveries are seeded into the satchel from /robots.txt (digging three
 * shadow-root cuttings is the Delve spec's job); the turn-in, the reward and
 * the recipe it opens are played.
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, canvas, focusWorld, openPlay, placePanel, seed, stackQty, walkTo, travelToTown } from './play-helpers';

const NULLTHORN_LOCK = 'A Delve mission teaches this pattern';

async function savedGold(page: Page): Promise<number> {
  return page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold ?? 0));
}
/** Delving is stored under the `exploration` discipline (skill.model.ts). */
async function delvingXp(page: Page): Promise<number> {
  return page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-activity') || '{}')?.progress?.xpByDiscipline?.exploration ?? 0));
}

async function openQuestBoard(page: Page): Promise<void> {
  await openPlay(page, '?at=waystone');
  await travelToTown(page, 'Verdant');
  await expect(canvas(page)).toHaveAttribute('data-area', 'Rootglass Canopy', { timeout: 10000 });
  await expect(placePanel(page)).toBeHidden();
  await focusWorld(page);
  await walkTo(page, 1030, 40);
  await page.keyboard.press('e');
  await expect(page.locator('#place-title')).toHaveText('Quest Board');
  await expect(page.locator('section.place app-station-shell.qb')).toBeVisible({ timeout: 15000 });
  await page.locator('section.place app-station-tabs').getByRole('button', { name: /^Delve/ }).click();
}

async function claimMission(page: Page, title: string): Promise<void> {
  await page.locator('section.place app-journal-list .jl__row', { hasText: title }).first().click();
  await expect(page.locator('section.place .qb-detail app-detail-head')).toContainText(title);
  const claim = page.locator('section.place .qb-detail .ab__btn');
  await expect(claim).not.toHaveAttribute('aria-disabled', 'true');
  await claim.click();
  await expect(page.locator('section.place app-reward-pop .rp')).toBeVisible();
}

/** The Nullthorn Staff's line on the Crafting Bench: the reason it cannot be made, or ''. */
async function nullthornWhy(page: Page): Promise<string> {
  await openPlay(page, '?at=crafting');
  await expect(page.locator('section.place .cb-hero')).toBeVisible({ timeout: 15000 });
  await page.locator('section.place').getByText('Details', { exact: true }).click();
  await page.locator('section.place').getByPlaceholder('Search recipes and materials').fill('Nullthorn');
  await page.locator('section.place .cb-card').first().click();
  await expect(page.locator('section.place .cb-hero .dh__name')).toHaveText('Nullthorn Staff');
  const why = page.locator('section.place .cb-hero .ab__why');
  return (await why.count()) ? (await why.textContent()) ?? '' : '';
}

test.describe('Delve missions, played', () => {
  test.describe.configure({ timeout: 150000 });

  test("Verrin's Shadow Beneath: deliver 3 cuttings, claim, Gold + Delving XP, Nullthorn recipe opens", async ({ page }) => {
    await seed(page, bag({ 'shadow-root-cutting': 3 }));
    expect(await nullthornWhy(page)).toContain(NULLTHORN_LOCK);
    await page.waitForTimeout(6000); // let the economy ledger settle before reading it
    const goldBefore = await savedGold(page);
    await openQuestBoard(page);
    await claimMission(page, 'The Shadow Beneath');
    await expect.poll(() => stackQty(page, 'shadow-root-cutting')).toBe(0);
    await expect.poll(() => savedGold(page), { timeout: 10000 }).toBeGreaterThanOrEqual(goldBefore + 1);
    await expect.poll(() => delvingXp(page), { timeout: 10000 }).toBeGreaterThanOrEqual(150);
    const npc = await blob<{ claimed?: unknown }>(page, 'eclipse-npc');
    expect(JSON.stringify(npc)).toContain('delve-verrin-shadow');
    // The pattern is learned: the bench no longer says a mission teaches it.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    expect(await nullthornWhy(page)).not.toContain(NULLTHORN_LOCK);
  });

  test('Verrin will not take a delivery that is short', async ({ page }) => {
    await seed(page, bag({ 'shadow-root-cutting': 2 }));
    await openQuestBoard(page);
    await page.locator('section.place app-journal-list .jl__row', { hasText: 'The Shadow Beneath' }).first().click();
    await expect(page.locator('section.place .qb-detail .ab__btn')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('section.place .qb-detail')).toContainText('2/3');
  });

  // Was P-6 (playtest-findings.md): The Fracture's 600 Delving XP went as one action over the
  // gateway's 500 ceiling and was refused silently. Mission XP is now split into grants under
  // the ceiling (missionXpGrants), and a refused grant is logged.
  test('the whole Delve chain: Verrin, Kael, a Glowcap order, then The Fracture pays its 600 Delving XP', async ({ page }) => {
    await seed(page, bag({
      'shadow-root-cutting': 3, 'slag-fragment': 10, 'kaels-hammer': 1, glowcap: 5, 'godforge-fragment': 1,
    }));
    await openQuestBoard(page);
    for (const title of ['The Shadow Beneath', 'The Old Seam', 'Glowcap Orders']) await claimMission(page, title);
    await expect.poll(() => delvingXp(page), { timeout: 10000 }).toBeGreaterThanOrEqual(350);
    const before = await delvingXp(page);
    await claimMission(page, 'The Fracture');
    await expect.poll(() => stackQty(page, 'godforge-fragment')).toBe(0);
    await expect.poll(() => delvingXp(page), { timeout: 10000 }).toBeGreaterThanOrEqual(before + 600);
  });

  test("the Archivist's first inscription milestone pays once three are copied", async ({ page }) => {
    await seed(page, {
      'godforge-delve-lore': { version: 1, inscriptions: ['basalt-kaels-mark', 'roots-inverse-tree', 'roots-keepers-tally'] },
    });
    await openQuestBoard(page);
    const xpBefore = await delvingXp(page);
    await claimMission(page, 'Words in the Stone');
    await expect.poll(() => delvingXp(page), { timeout: 10000 }).toBeGreaterThan(xpBefore);
    // The second milestone now shows, and wants six.
    await page.locator('section.place app-journal-list .jl__row', { hasText: 'Words in the Stone II' }).first().click();
    await expect(page.locator('section.place .qb-detail')).toContainText('3/6');
  });
});
