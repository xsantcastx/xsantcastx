/**
 * play-story-act1.spec.ts — the Prologue and Act I, played (docs/handoff/story-act1.md).
 *
 * World and cast slice S2 (docs/world/world-and-cast.md §2):
 *   - a fresh save is in the Prologue: the goal line carries the chapter
 *     ("Prologue · The Fresh Mark") over the same four first goals, and the
 *     Story tab (Character) shows the Prologue, one lead and nothing else;
 *   - deep in the Magma Halls the Keeper reads the fresh tally mark. Reading a
 *     first carving ends the Prologue (the Act I card, skippable), and Glim
 *     says what the mark is: the notch the Keeper's own pick leaves. It is theirs;
 *   - the Story tab shows the beat, and a reload keeps it (godforge-story,
 *     through the save gateway) without showing the card again;
 *   - on a 390×844 phone the card fits the screen, Continue takes its own tap,
 *     and Glim's line stays clear of the middle of the world.
 *
 * The Keeper reaches the deep rows the way the Delve specs do: a camp beside
 * the carving (play-delve-fixtures), the shaft's "Descend to your camp".
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { blob, canvas, focusWorld, openPlay, seed, settleBetween, walkTo, SHAFT_X } from './play-helpers';
import { DelveFixture, colX } from './play-delve-fixtures';

/** The fresh mark's camp: the Keeper's body reaches the carving at (102, 50). */
const FRESH_CAMP: [number, number] = [103, 50];
const say = (page: Page) => page.locator('.glim-say');
const card = (page: Page) => page.locator('.story-card');

interface Story { chapter: string; beats: string[]; cards: string[] }
const story = (page: Page) => blob<Story>(page, 'godforge-story');
const lore = async (page: Page) => (await blob<{ inscriptions?: string[] }>(page, 'godforge-delve-lore'))?.inscriptions ?? [];

/** Character → Story, from the world's menu (it works the same on a phone). */
async function openJournal(page: Page): Promise<Locator> {
  await page.locator('.places-toggle').first().click();
  await page.locator('#places-list button[data-open="character"]').click();
  await page.locator('#ch-tab-story').click();
  const journal = page.locator('app-hub-story .hs');
  await expect(journal).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#ch-tab-story')).toHaveAttribute('aria-selected', 'true');
  await page.waitForTimeout(400); // the panel's fade-in, for the screenshots
  return journal;
}
async function closeJournal(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('section.place')).toBeHidden();
}

/** From town to the camp beside the fresh mark (the warden long felled in this save). */
async function descendToFreshMark(page: Page, keep: Record<string, unknown>): Promise<void> {
  const f = new DelveFixture().camp(FRESH_CAMP[0], FRESH_CAMP[1]);
  f.claimed = ['warden-defeated'];
  await seed(page, { ...f.blobs(), ...keep });
  await openPlay(page);
  await walkTo(page, SHAFT_X, 30);
  await page.getByRole('button', { name: /Descend to your camp/ }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
  await page.waitForTimeout(1800);
  await settleBetween(page, colX(FRESH_CAMP[0]) - 14, colX(FRESH_CAMP[0]) + 14);
  await expect(page.locator('.prompt')).toContainText('Read the inscription');
}

/** Read the carving the Keeper stands at; the record lands in the lore blob. */
async function readCarving(page: Page, id: string): Promise<void> {
  await expect(async () => {
    await focusWorld(page);
    await page.keyboard.press('e');
    await expect.poll(() => lore(page), { timeout: 1500 }).toContain(id);
  }).toPass({ timeout: 15000 });
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `output/story/${name}.png` });
}

test.describe('The story: Prologue and Act I', () => {
  test.describe.configure({ timeout: 180000 });

  for (const size of [{ width: 1280, height: 800, tag: 'desktop' }, { width: 390, height: 844, tag: 'phone' }]) {
    test(`${size.tag}: Prologue framing → the fresh mark in the Delve → the Story tab → a reload keeps it`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });

      // ── A fresh save: the Prologue wraps the four first goals. ──
      await seed(page);
      await openPlay(page);
      const guide = page.locator('.guide');
      await expect(guide).toHaveAttribute('data-goal', 'buy');
      await expect(guide).toHaveAttribute('data-chapter', 'Prologue · The Fresh Mark');
      await expect(guide).toContainText('Goal 1 of 4');
      await expect(say(page)).toHaveAttribute('data-glim-line', 'meet', { timeout: 5000 });
      await shot(page, `${size.tag}-1-prologue`);

      let journal = await openJournal(page);
      await expect(journal).toHaveAttribute('data-story-chapter', 'prologue');
      await expect(journal.locator('[data-story-lead]')).toContainText('Buy your first building');
      await expect(journal.locator('[data-beat="p.arrival"]')).toBeVisible();
      // Nothing from Act I is there, not even its name.
      await expect(journal.locator('[data-chapter="act1"]')).toHaveCount(0);
      await expect(journal).not.toContainText('Old Seam');
      await expect(journal).not.toContainText('yours');
      await shot(page, `${size.tag}-2-journal-prologue`);
      await closeJournal(page);

      // ── Deep in the Magma Halls: a single tally mark, and a fresh one beside it. ──
      const kept = { 'godforge-story': await story(page), 'godforge-glim': await blob(page, 'godforge-glim') };
      await descendToFreshMark(page, kept);
      await shot(page, `${size.tag}-3-the-fresh-mark`);
      await readCarving(page, 'magma-unsigned');

      // A first carving read ends the Prologue: the Act I card, Kael's words, one Continue.
      await expect(card(page)).toBeVisible({ timeout: 5000 });
      await expect(card(page)).toHaveAttribute('data-story-card', 'act1');
      await expect(card(page)).toContainText('Act I · The Old Seam');
      await expect(card(page)).toContainText('Most people step over it');
      await page.waitForTimeout(700); // the card settles in (scale .98 → 1)
      const box = (await card(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      const go = page.locator('.story-card__go');
      await expect(go).toBeFocused();
      const goBox = (await go.boundingBox())!;
      expect(goBox.height).toBeGreaterThanOrEqual(44);
      await shot(page, `${size.tag}-4-act1-card`);
      await go.click();
      await expect(card(page)).toHaveCount(0);

      // Glim holds the light closer: the notch is the one the Keeper's own pick leaves.
      await expect(say(page)).toHaveAttribute('data-story-beat', 'a1.fresh', { timeout: 5000 });
      await expect(say(page)).toContainText('Your pick leaves that notch');
      await shot(page, `${size.tag}-5-glim-notch`);
      if (size.tag === 'phone') {
        const bubble = (await say(page).boundingBox())!;
        const world = (await canvas(page).boundingBox())!;
        const mid = { top: world.y + world.height * .25, bottom: world.y + world.height * .75 };
        expect(bubble.y + bubble.height <= mid.top || bubble.y >= mid.bottom, 'Glim\'s line clear of the middle of the world').toBe(true);
      }
      await page.locator('.glim-say__close').click();
      await expect(say(page)).toContainText('That mark is yours', { timeout: 5000 });
      await shot(page, `${size.tag}-6-glim-yours`);

      const saved = await story(page);
      expect(saved?.chapter).toBe('act1');
      expect(saved?.beats).toEqual(expect.arrayContaining(['p.arrival', 'p.words', 'a1.fresh']));
      expect(saved?.cards).toEqual(['act1']);

      // ── The Story tab: Act I now, the fresh mark found. ──
      await page.locator('.glim-say__close').click();
      journal = await openJournal(page);
      await expect(journal).toHaveAttribute('data-story-chapter', 'act1');
      await expect(journal.locator('[data-beat="a1.fresh"]')).toContainText('The fresh mark');
      await expect(journal.locator('[data-chapter="prologue"] [data-beat="p.words"]')).toBeVisible();
      // The warden was felled before this save was loaded: filed quietly on the way in.
      await expect(journal.locator('[data-beat="a1.eater"]')).toBeVisible();
      // Beats not found leave no trace but the count.
      await expect(journal.locator('[data-beat="a1.break"], [data-beat="a1.tally"], [data-beat="a1.dated"]')).toHaveCount(0);
      await expect(journal.locator('[data-chapter="act1"] h4')).toContainText('2 of 8 found');
      await shot(page, `${size.tag}-7-journal-act1`);
      await closeJournal(page);

      // ── A reload keeps it, and the card does not come back. ──
      await openPlay(page);
      await page.waitForTimeout(2500);
      await expect(card(page)).toHaveCount(0);
      const after = await story(page);
      expect(after?.beats).toContain('a1.fresh');
      journal = await openJournal(page);
      await expect(journal.locator('[data-beat="a1.fresh"]')).toBeVisible();
    });
  }
});
