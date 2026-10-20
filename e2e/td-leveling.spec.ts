/**
 * td-leveling.spec.ts — the Keeper's level-up moment (docs/design/leveling.md §4). A Keeper seeded a few Hunting XP
 * short of level 10 hands in Mara Voss's ore (a town task that pays 40 Hunting XP): the "Level 10!" banner lists the
 * life, mana, points and the milestone (the copper frame, the Cowl, the bonus skill point), the badge reads 10, the
 * receipt is saved; "Spend points" opens the sheet, whose Milestones tab shows reached / next / later and the title
 * pick. Desktop and phone. Screenshots: docs/handoff/cozy-ui/levelup-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

const canvas = (page: Page) => page.locator('canvas').first();
const savedLevel = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-keeper-level') || 'null');
  return (raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw) as { claimed: number[]; title: string } | null;
});

async function open(page: Page): Promise<void> {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(10) - 25 } as typeof act.progress.xpByDiscipline;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'godforge-inventory': ledger({ 'cinder-ore': 10 }), 'godforge-activity': act });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}
/** Mara Voss takes the ore and pays (the td-quests path): 40 Hunting XP crosses level 10. */
async function handInOre(page: Page, phone: boolean): Promise<void> {
  if (phone) await page.locator('.td-dock button').last().click();
  else { await canvas(page).focus(); await page.keyboard.press('m'); }
  await page.locator('#places-list.td-map .td-map__key button[data-kind="npc"]', { hasText: /mara voss/i }).click();
  const talk = page.locator('.td-talk');
  await expect(talk).toHaveAttribute('data-talk', 'bench-smith');
  await talk.locator('[data-talk-accept]').click();
  await talk.locator('[data-talk-handin]').click();
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'thanks');
  await page.keyboard.press('Escape');
}

for (const size of [{ name: 'desktop', width: 1280, height: 800, phone: false }, { name: 'phone', width: 390, height: 844, phone: true }]) {
  test(`level 10 on ${size.name}: the banner says what the level and its milestone gave; the sheet shows the milestones`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await open(page);
    if (!size.phone) await expect(page.locator('[data-keeper-level]')).toHaveText('9');
    await handInOre(page, size.phone);

    const banner = page.locator('[data-level-banner]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toHaveAttribute('data-level', '10');
    await expect(banner).toContainText('Level 10!');
    await expect(banner).toContainText('+8 life');
    await expect(banner).toContainText('+5 attribute points');
    await expect(banner).toContainText('+2 skill points');
    await expect(banner).toContainText(/Milestone 10:.*Copper portrait frame.*Keeper/);
    await expect.poll(async () => (await savedLevel(page))?.claimed ?? []).toEqual([5, 10]);
    if (!size.phone) await expect(page.locator('[data-keeper-level]')).toHaveText('10');
    for (const b of await banner.locator('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const box = (await banner.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    await page.screenshot({ path: `docs/handoff/cozy-ui/levelup-${size.name}.jpg`, type: 'jpeg', quality: 80 });

    // Spend points → the sheet: XP to 11, the next milestone (15) and what it gives, then the Milestones tab.
    await banner.locator('[data-level-spend]').click();
    await expect(banner).toHaveCount(0);
    const sheet = page.locator('.ksheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-sheet-xp]')).toContainText(/XP to level 11/);
    await expect(sheet.locator('[data-sheet-next]')).toContainText(/level 15.*Ash-Walker/);
    await sheet.locator('[data-sheet-milestones]').click();
    await expect(sheet.locator('[data-milestone="10"]')).toHaveAttribute('data-state', 'claimed');
    await expect(sheet.locator('[data-milestone="15"]')).toHaveAttribute('data-state', 'next');
    await expect(sheet.locator('[data-milestone="20"]')).toHaveAttribute('data-state', 'later');
    // The title earned at 5 can be worn; it shows under the name.
    await sheet.locator('[data-title-next]').click();
    await expect(sheet.locator('[data-sheet-title]')).toHaveText('the Kindled');
    await expect(page.locator('[data-keeper-title]')).toHaveText('the Kindled');
    await expect.poll(async () => (await savedLevel(page))?.title).toBe('kindled');
    const sb = (await sheet.boundingBox())!;
    expect(sb.y + sb.height).toBeLessThanOrEqual(size.height + 1);
    await page.screenshot({ path: `docs/handoff/cozy-ui/levelup-sheet-${size.name}.jpg`, type: 'jpeg', quality: 80 });
  });
}
