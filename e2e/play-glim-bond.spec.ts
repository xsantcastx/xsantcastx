/**
 * play-glim-bond.spec.ts — the bond with Glim, played (docs/handoff/glim-bond.md).
 *
 * A seeded save one place short of "Mapmates" (Glim met, its first talk heard,
 * the Seamworks and the Root Hollows already shared). Walking into the
 * Homestead is a new place found together: the bond reaches Mapmates, Glim
 * says so with a Talk button, the talk about the Afterimage Moths opens over
 * the world and ends in Glim's question; the answer is remembered through the
 * save gateway, and after a reload the Story tab shows the stage, the answer
 * and the talk as heard — and Glim does not say the stage line again.
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, openPlay, seed } from './play-helpers';

interface Bond { moments: string[]; answers: Record<string, { a: string; at: number }>; peak: number }

const SEEDED = {
  'preferred-language': 'en',
  'godforge-glim': {
    version: 1, met: true, metAt: '2026-10-14T00:00:00.000Z', ladder: {},
    // The Prologue's Homestead line is already said, so the bond's line is the one that answers the walk in.
    said: { meet: 1, homestead: 1 }, lastAt: { meet: 1, homestead: 1 },
    // 3 + 3 + 5 = 11: one shared place short of Mapmates (12).
    moments: ['area:infernal', 'talk:who', 'depth:0'], answers: {}, peak: 1, seenAt: 0,
  },
};

const say = (page: Page) => page.locator('.glim-say');
const shot = (page: Page, name: string) => page.screenshot({ path: `output/glim-bond/${name}.png` });

async function openJournal(page: Page) {
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button[data-open="character"]').click();
  await page.locator('#ch-tab-story').click();
  const bond = page.locator('app-hub-glim-bond .gb');
  await expect(bond).toBeVisible({ timeout: 15000 });
  return bond;
}

for (const size of [{ tag: '1280x800', width: 1280, height: 800 }, { tag: '390x844', width: 390, height: 844 }]) {
  test(`${size.tag}: a place found together → Mapmates → Glim's talk and question → remembered after a reload`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await seed(page, SEEDED);
    await openPlay(page);
    await page.waitForTimeout(2000);
    // Nothing yet: the Seamworks was already shared.
    await expect(page.locator('.glim-say[data-glim-bond]')).toHaveCount(0);
    expect((await blob<Bond>(page, 'godforge-glim'))?.peak).toBe(1);

    // ── A new place, together: Show me walks the Keeper into the Homestead. ──
    await page.locator('.guide-go').click();
    await expect(page.locator('.viewport canvas')).toHaveAttribute('data-area', 'Your Homestead', { timeout: 30000 });
    await expect(say(page)).toHaveAttribute('data-glim-bond', 'stage.2', { timeout: 10000 });
    await expect(say(page)).toContainText('Mapmates, I think');
    const talk = page.locator('.glim-say__talk');
    const box = await talk.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await shot(page, `${size.tag}-1-mapmates-line`);
    const grown = await blob<Bond>(page, 'godforge-glim');
    expect(grown?.moments).toContain('area:homestead');
    expect(grown?.peak).toBe(2);

    // ── The talk: a new conversation over the world, ending in Glim's question. ──
    await talk.click();
    const card = page.locator('.glim-talk-card');
    await expect(card.locator('[data-glim-talk="moths"]')).toBeVisible();
    await expect(card).toContainText('I used to be an Afterimage Moth');
    await expect(card).toContainText('what do you like finding most?');
    const choice = card.locator('[data-choice="carvings"]');
    expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const cardBox = await card.boundingBox();
    expect(cardBox!.x).toBeGreaterThanOrEqual(0);
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(size.width + 1);
    await shot(page, `${size.tag}-2-talk`);
    await choice.click();
    await expect(card.locator('[data-glim-reply]')).toContainText('A carving is a letter with no envelope');
    await shot(page, `${size.tag}-3-reply`);
    await card.locator('.gt__done').click();
    await expect(card).toHaveCount(0);
    const answered = await blob<Bond>(page, 'godforge-glim');
    expect(answered?.answers['like']?.a).toBe('carvings');
    expect(answered?.moments).toContain('talk:moths');

    // ── A reload keeps it all; the stage line is not said twice. ──
    await openPlay(page);
    await page.waitForTimeout(2500);
    await expect(page.locator('.glim-say[data-glim-bond="stage.2"]')).toHaveCount(0);
    const bond = await openJournal(page);
    await expect(bond).toHaveAttribute('data-glim-bond', '2');
    await expect(bond.locator('[data-glim-stage-name]')).toHaveText('Mapmates');
    await expect(bond.locator('[data-answer="like:carvings"]')).toContainText('carvings');
    await expect(bond.locator('[data-talk="moths"]')).toContainText('Heard');
    await expect(bond.locator('[data-glim-quest] [data-quest-step="1"]')).toBeVisible();
    await bond.scrollIntoViewIfNeeded();
    await shot(page, `${size.tag}-4-story-tab`);
    // A talk replays from the Story tab.
    await bond.locator('[data-talk="who"]').click();
    await expect(bond.locator('[data-glim-talk="who"]')).toContainText('I keep the maps');
  });
}
