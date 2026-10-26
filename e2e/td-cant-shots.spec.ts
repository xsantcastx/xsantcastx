/**
 * td-cant-shots.spec.ts — the Seam-Cant and the synergies (docs/design/design-bible.md §4.0, §4.1, roadmap §10 items
 * 1–2): a cast speaks its words over the Keeper, and the Spellbook card shows the words and a Synergies block with
 * live numbers. Screenshots land in docs/handoff/cozy-ui/cant-*.jpg, desktop and a 390×844 phone. Nothing here asserts
 * on a fight's outcome.
 */
import { expect, test, type Page } from '@playwright/test';
import { pickSkill, seed, learnRanks } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

const canvas = (page: Page) => page.locator('canvas').first();
const SIZES = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } } as const;

async function open(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': '55', ...activity({ hunting: xpForLevel(13) }) });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}

/** A box round the Keeper (the camera holds him near the canvas's middle). */
async function around(page: Page, w: number, h: number): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const width = Math.min(w, box.width), height = Math.min(h, box.height);
  return { x: Math.round(Math.max(box.x, cx - width / 2)), y: Math.round(Math.max(box.y, cy - height / 2 - 20)), width, height };
}

for (const [name, size] of Object.entries(SIZES)) {
  test(`the Seam-Cant over the Keeper and the Spellbook card (${name})`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, size);
    await page.waitForTimeout(3500);   // the place's title card fades

    // The book: three points in Aura of Embers feed Hellfire Nova (+5% damage a rank).
    await canvas(page).focus();
    await page.keyboard.press('k');
    await expect(page.locator('.sbt')).toBeVisible();
    await learnRanks(page, 'aura-embers', 3);
    await expect(page.locator('.brow[data-row="aura-embers"] .brow__rank b')).toHaveText('r 4/20');
    await pickSkill(page, 'aura-embers');
    const card = page.locator('.bcard');
    await expect(card.locator('.bcard__words')).toHaveText('vael ka');
    await pickSkill(page, 'hellfire-nova');
    await expect(card.locator('.bcard__words')).toHaveText('vael orum');
    const syn = card.locator('.bcard__syn[data-syn="aura-embers"]');
    await expect(syn).toContainText('Aura of Embers');
    await expect(syn).toContainText('+15%');
    await expect(syn).toHaveClass(/bcard__syn--live/);
    // Rank 1 Nova is 20–30; +15% makes it 23–35 on the card (the fight reads the same numbers).
    await expect(card.locator('.bcard__line')).toContainText('23–35');

    // Cast Nova (key 3 on the default bar): the words hang over the Keeper. A few steps out onto the open square
    // first, so the line reads against the ground rather than a shop sign, and the place's title card has gone.
    await page.locator('.spellbook .win-x').click();
    await expect(page.locator('.sbt')).toHaveCount(0);
    await canvas(page).focus();
    await page.keyboard.down('a'); await page.waitForTimeout(700); await page.keyboard.up('a');
    await page.waitForTimeout(2500);
    await page.keyboard.press('3');
    await page.waitForFunction(() => document.querySelector('canvas')?.getAttribute('data-cant') === 'vael orum', undefined, { polling: 'raf', timeout: 3000 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `docs/handoff/cozy-ui/cant-words-${name}.jpg`, type: 'jpeg', quality: 90, clip: await around(page, 520, 360) });
    // ~1.2 s later the line is gone.
    await expect(canvas(page)).toHaveAttribute('data-cant', '', { timeout: 3000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
