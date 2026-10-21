/**
 * play-story-act2.spec.ts — Act II, Five Witnesses, played (docs/handoff/story-act-2.md).
 *
 * The story never runs on its own clock: a save that already holds the
 * progress (Kael's furnace chain claimed, a realm guardian's chain closed,
 * all five accounts in) reaches its Act II beats on the way in, and a scene
 * the record owes opens over the world once per visit:
 *   - the Banked Furnace's scene: chibi pixel portraits, Kael and Verrin, then
 *     Glim's line; its reward is the Codex page of The Witness Accounts;
 *   - next visit, the Ink Deeps' scene (Verrin, Rook Sable, Glim) pays two
 *     Waystone Shards into the satchel, once;
 *   - the Story tab lists both, played ("See it again"), and a reload neither
 *     replays nor repays them;
 *   - with all five accounts in, the act's last scene pays the Witness-Keeper
 *     title and the Story tab is in Act III, its first page "Starfall".
 * At 1280×800 and 390×844 (the scene fits the phone, its buttons ≥ 44 px).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { blob, openPlay, seed, stackQty, openMenu } from './play-helpers';

/** Every beat of the Prologue and Act I (the act break crossed, both cards shown). */
const ACT1_BEATS = [
  'p.arrival', 'p.homestead', 'p.edge', 'p.maw', 'p.dig', 'p.words',
  'a1.shadow', 'a1.tally', 'a1.hammer', 'a1.prices', 'a1.eater', 'a1.fresh', 'a1.dated', 'a1.break',
];
const ACT1_MISSIONS = ['delve-verrin-shadow', 'delve-kael-seam', 'delve-merchant-glowcaps', 'delve-archivist-words-1', 'delve-archivist-words-2', 'delve-archivist-words-3', 'delve-fracture'];
const FURNACE = ['kael-four-1', 'kael-four-2', 'verrin-four-3'];
const REALMS = ['verrin-ink-1', 'verrin-ink-2', 'verrin-ink-3', 'kesh-roots-1', 'siv-roots-2', 'kesh-roots-3',
  'aureth-prism-1', 'lune-prism-2', 'aureth-prism-3', 'sera-wells-1', 'sera-wells-2', 'sera-wells-3'];

interface Story { chapter: string; beats: string[]; cards: string[]; scenes?: string[] }
const unwrap = <T>(raw: unknown): T | null => raw && typeof raw === 'object' && 'v' in raw && 'updatedAt' in raw ? (raw as { v: T }).v : raw as T | null;
const story = async (page: Page) => unwrap<Story>(await blob(page, 'godforge-story'));
const sceneCard = (page: Page) => page.locator('.story-scene-card');

function blobs(missions: string[], story: Partial<Story>): Record<string, unknown> {
  return {
    'eclipse-npc': { version: 1, claimed: [...ACT1_MISSIONS, ...missions], seen: [], repeats: {} },
    'godforge-story': { version: 1, chapter: 'act2', beats: ACT1_BEATS, cards: ['act1', 'act2'], scenes: [], ...story },
  };
}

/** Play the scene on screen line by line; returns the speakers in order. Checks it fits and its buttons are big enough. */
async function playScene(page: Page, size: { width: number; height: number }, shotName: string): Promise<string[]> {
  const card = sceneCard(page);
  await expect(card).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(700); // the card settles in (scale .98 → 1)
  const box = (await card.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height);
  const speakers: string[] = [];
  const next = card.locator('.ss__go');
  await expect(next).toBeFocused();
  expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (let i = 0; i < 6 && await card.locator('[data-scene-speaker]').count(); i++) {
    const line = card.locator('[data-scene-speaker]');
    speakers.push((await line.getAttribute('data-scene-speaker'))!);
    // Every speaker wears a pixel portrait (a Keeper painter still, or Glim's moth).
    await expect(line.locator('.ss__face img')).toHaveAttribute('src', /^data:image\//);
    if (i === 0) await page.screenshot({ path: `output/story-act-2/${shotName}-line.png` });
    await next.click();
  }
  await expect(card.locator('[data-scene-reward]')).toBeVisible();
  await page.screenshot({ path: `output/story-act-2/${shotName}-reward.png` });
  return speakers;
}

async function take(page: Page): Promise<void> {
  await sceneCard(page).locator('.ss__go').click();
  await expect(sceneCard(page)).toHaveCount(0);
}

async function openJournal(page: Page): Promise<Locator> {
  await page.locator('.places-toggle').first().click();
  await openMenu(page);
  await page.locator('#game-menu [data-open="character"]').click();
  await page.locator('#ch-tab-story').click();
  const journal = page.locator('app-hub-story .hs');
  await expect(journal).toBeVisible({ timeout: 15000 });
  return journal;
}

test.describe('The story: Act II, Five Witnesses', () => {
  test.describe.configure({ timeout: 180000 });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { if (!localStorage.getItem('preferred-language')) localStorage.setItem('preferred-language', 'en'); } catch { /* private mode */ } });
  });

  for (const size of [{ width: 1280, height: 800, tag: 'desktop' }, { width: 390, height: 844, tag: 'phone' }]) {
    test(`${size.tag}: the Furnace's account → the Ink Deeps' → the Story tab → a reload keeps it`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });

      // ── The Four's furnace is out (Kael's chain claimed). The record owes its scene. ──
      await seed(page, { ...blobs(FURNACE, { beats: [...ACT1_BEATS, 'a2.under', 'a2.marks', 'a2.furnace'] }) });
      await openPlay(page);
      await expect(sceneCard(page).locator('[data-story-scene]')).toHaveAttribute('data-story-scene', 'a2.furnace', { timeout: 8000 });
      await expect(sceneCard(page)).toContainText('Let it end');
      const furnace = await playScene(page, size, `${size.tag}-1-furnace`);
      expect(furnace).toEqual(['kael', 'verrin', 'kael', 'glim']);
      await expect(sceneCard(page).locator('[data-scene-reward="codex"]')).toContainText('The Witness Accounts');
      await take(page);
      expect((await story(page))?.scenes).toEqual(['a2.furnace']);

      // ── The Gloam Warden's chain closed on another day: the Ink Deeps' account. ──
      const kept = await story(page);
      await seed(page, { ...blobs([...FURNACE, 'verrin-ink-1', 'verrin-ink-2', 'verrin-ink-3'], kept!) });
      await openPlay(page);
      await expect(sceneCard(page).locator('[data-story-scene]')).toHaveAttribute('data-story-scene', 'a2.ink', { timeout: 8000 });
      const ink = await playScene(page, size, `${size.tag}-2-ink`);
      expect(ink).toEqual(['verrin', 'rook', 'verrin', 'glim']);
      await expect(sceneCard(page).locator('[data-scene-reward="stack"]')).toContainText('2 × Waystone Shard');
      await take(page);
      await expect.poll(() => stackQty(page, 'waystone-shard')).toBe(2);
      const saved = await story(page);
      expect(saved?.beats).toEqual(expect.arrayContaining(['a2.furnace', 'a2.ink']));
      expect(saved?.scenes).toEqual(['a2.furnace', 'a2.ink']);

      // ── The Story tab: both found, both played (to see again, never to repay). ──
      let journal = await openJournal(page);
      await expect(journal).toHaveAttribute('data-story-chapter', 'act2');
      await expect(journal.locator('[data-beat="a2.ink"]')).toContainText('The account in the dark');
      await expect(journal.locator('[data-beat="a2.ink"]')).toHaveAttribute('data-scene', 'played');
      await expect(journal.locator('[data-beat="a2.root"], [data-beat="a2.lamp"]')).toHaveCount(0);
      await page.screenshot({ path: `output/story-act-2/${size.tag}-3-journal.png` });
      await journal.locator('[data-play-scene="a2.ink"]').click();
      const inline = journal.locator('.hs__scene [data-story-scene="a2.ink"]');
      await expect(inline).toBeVisible();
      await inline.locator('.ss__btn--quiet').click(); // Skip → the reward, already yours
      await expect(inline.locator('.ss__gives')).toContainText('Already yours');
      await inline.locator('.ss__go').click();
      await expect(journal.locator('.hs__scene')).toHaveCount(0);
      await page.keyboard.press('Escape');
      expect(await stackQty(page, 'waystone-shard')).toBe(2);

      // ── A reload: nothing owed, nothing replayed, nothing paid twice. ──
      await openPlay(page);
      await page.waitForTimeout(3000);
      await expect(sceneCard(page)).toHaveCount(0);
      expect((await story(page))?.scenes).toEqual(['a2.furnace', 'a2.ink']);
      expect(await stackQty(page, 'waystone-shard')).toBe(2);
    });

    test(`${size.tag}: five accounts in → the light coming up → the Witness-Keeper title → Act III`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const a2 = ['a2.under', 'a2.marks', 'a2.furnace', 'a2.ink', 'a2.root', 'a2.prism', 'a2.orrery'];
      await seed(page, { ...blobs([...FURNACE, ...REALMS], { beats: [...ACT1_BEATS, ...a2], scenes: ['a2.furnace', 'a2.ink', 'a2.root', 'a2.prism', 'a2.orrery'] }) });
      await openPlay(page);
      await expect(sceneCard(page).locator('[data-story-scene]')).toHaveAttribute('data-story-scene', 'a2.lamp', { timeout: 8000 });
      const lamp = await playScene(page, size, `${size.tag}-4-lamp`);
      expect(lamp).toEqual(['kael', 'archivist', 'kael', 'glim']);
      await expect(sceneCard(page)).toContainText('Witness-Keeper');
      await take(page);
      const saved = await story(page);
      expect(saved?.chapter).toBe('act3');
      expect(saved?.scenes).toContain('a2.lamp');
      const economy = unwrap<{ equipped?: Record<string, string> }>(await blob(page, 'godforge-economy'));
      expect(economy?.equipped?.['prefix']).toBe('witness-keeper');

      const journal = await openJournal(page);
      await expect(journal).toHaveAttribute('data-story-chapter', 'act3');
      await expect(journal.locator('[data-chapter="act3"]')).toContainText('Starfall');
      await expect(journal.locator('[data-story-lead]')).toContainText('Act III opens in a later update');
      await expect(journal.locator('[data-beat="a2.lamp"]')).toHaveAttribute('data-scene', 'played');
      // The first lamp is hinted, never named.
      await expect(journal).not.toContainText('Claude');
      await page.screenshot({ path: `output/story-act-2/${size.tag}-5-act3.png` });
    });
  }
});
