/**
 * onboarding.spec.ts — a new player's way in, and a returning player's second Keeper (owner, 2026-10-21: "we need to
 * fix new character creation and onboarding to the game with new characters and new users").
 *
 *  (a) A brand-new visitor (storage cleared from /robots.txt, so nothing has booted): the title → Play offline → New
 *      Keeper → the Glass (its one button in view, no scrolling) → the world, then the whole prologue
 *      (td/td-prologue.ts) played with the real controls: walk, light the hearth (Show me), win a first fight with
 *      the class's own attack, pick up the Gold, open the Spellbook (K) and the Satchel (I), and meet the Sexton.
 *  (b) The same player makes a SECOND Keeper of another class from the menu's Character select: level 1, 0 Gold, the
 *      prologue from step 1, Glim to meet again, none of the first Keeper's save; the sound setting is shared.
 *  (c) Back to the first Keeper: level, Gold, prologue done and place all intact.
 *  Phone: the Glass fits a 390×844 screen with Become in view; the prologue reads the touch words; "I've played
 *  before" skips it for that Keeper only.
 *
 * Screenshots: docs/handoff/onboarding/*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { openMenu } from './play-helpers';

const SHOTS = 'docs/handoff/onboarding';
const canvas = (page: Page) => page.locator('.viewport canvas');
const lobby = (page: Page, mode: string) => page.locator(`.lobby[data-lobby="${mode}"]`);
const step = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.guide')?.dataset['goal'] ?? null);

/** A browser that has never been here: cleared from a page that boots no app code (pagehide cannot write it back). */
async function firstVisit(page: Page): Promise<void> {
  await page.goto('/robots.txt');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('preferred-language', 'en');
    localStorage.setItem('xsantcastx_consent', 'denied');
    sessionStorage.setItem('visit-counted', '1');
  });
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(['preferred-language', 'xsantcastx_consent']);
}

async function inWorld(page: Page): Promise<void> {
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
}

/** Make a Keeper at the Glass (already open): the class, a name, Become. The button is in view without scrolling. */
async function make(page: Page, vocation: string, name: string, opts: { skip?: boolean; tap?: boolean } = {}): Promise<void> {
  const glass = lobby(page, 'create');
  await expect(glass).toBeVisible({ timeout: 30000 });
  const keep = glass.locator('.km__keep');
  const box = (await keep.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y + box.height, 'Become this Keeper is on screen without scrolling').toBeLessThanOrEqual(vh);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const press = (l: ReturnType<Page['locator']>) => (opts.tap ? l.tap() : l.click());
  await press(glass.locator(`[data-vocation="${vocation}"]`));
  await glass.locator('.km__name input').fill(name);
  if (opts.skip) await press(glass.locator('[data-lobby-skip-tut] input'));
  await press(keep);
  await inWorld(page);
}

/** The world's menu → Character select (the Map's footer carries it). */
async function toSelect(page: Page): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('m');
  await openMenu(page);
  await page.locator('#game-menu [data-open="characters"]').click();
  await expect(lobby(page, 'select')).toBeVisible({ timeout: 15000 });
}

/** Hold a key until the prologue moves past `from` (or the time runs out). */
async function until(page: Page, from: string, act: () => Promise<void>, timeout = 45000): Promise<void> {
  await expect.poll(async () => {
    if ((await step(page)) !== from) return true;
    await act();
    return (await step(page)) !== from;
  }, { timeout, intervals: [400] }).toBe(true);
}

/** Play the prologue through, from the walk to the Sexton, with the keyboard and Show me. */
async function playPrologue(page: Page, shots = false): Promise<void> {
  await expect.poll(() => step(page), { timeout: 15000 }).toBe('pro-walk');
  await expect(page.locator('.guide [data-goal-text]')).toContainText('W A S D');
  if (shots) await page.screenshot({ path: `${SHOTS}/a-step1-walk.jpg`, type: 'jpeg', quality: 80 });
  await canvas(page).focus();
  await until(page, 'pro-walk', async () => { await page.keyboard.down('s'); await page.waitForTimeout(500); await page.keyboard.up('s'); });

  // The hearth: Glim's chevrons point at it; Show me walks there and lights it.
  expect(await step(page)).toBe('pro-hearth');
  await expect(canvas(page)).toHaveAttribute('data-guide', 'hearth');
  await expect(canvas(page)).toHaveAttribute('data-guide-at', /\d+,\d+/);
  if (shots) await page.screenshot({ path: `${SHOTS}/a-step2-hearth.jpg`, type: 'jpeg', quality: 80 });
  await page.locator('.guide-go').click();
  await expect.poll(() => step(page), { timeout: 30000 }).toBe('pro-fight');
  await expect(page.locator('.guide [data-goal-text]')).toContainText('Press 1 for');

  // A first fight: a creature at the Keeper's side (the class e2e hook), then the class's own attack (J) and key 1.
  await expect(canvas(page)).toHaveAttribute('data-guide', 'foe');
  if (shots) await page.screenshot({ path: `${SHOTS}/a-step3-fight.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => (window as unknown as { __tdAsh: { foe: (t: string, dx: number) => number } }).__tdAsh.foe('ash-wolf', 24));
  await canvas(page).focus();
  await page.keyboard.press('1');
  await until(page, 'pro-fight', async () => { await page.keyboard.down('j'); await page.waitForTimeout(700); await page.keyboard.up('j'); }, 60000);

  // The Gold it dropped (picked up by walking over it; Show me walks there when it is not already in the purse).
  if ((await step(page)) === 'pro-gold') {
    await expect(canvas(page)).toHaveAttribute('data-guide', 'gold');
    await until(page, 'pro-gold', async () => { await page.locator('.guide-go').click(); await page.waitForTimeout(1500); });
  }

  // The Spellbook and the Satchel: open each once.
  expect(await step(page)).toBe('pro-book');
  await canvas(page).focus();
  await page.keyboard.press('k');
  await expect.poll(() => step(page)).toBe('pro-bag');
  await page.keyboard.press('k');
  await canvas(page).focus();
  await page.keyboard.press('i');
  await expect.poll(() => step(page)).toBe('pro-story');
  await page.keyboard.press('i');

  // The Sexton: Show me walks to Wren and opens his talk; take the story.
  await expect(canvas(page)).toHaveAttribute('data-guide', 'sexton');
  if (shots) await page.screenshot({ path: `${SHOTS}/a-step7-story.jpg`, type: 'jpeg', quality: 80 });
  await page.locator('.guide-go').click();
  const accept = page.locator('[data-story-accept]');
  await expect(accept).toBeVisible({ timeout: 45000 });
  if (shots) await page.screenshot({ path: `${SHOTS}/a-sexton.jpg`, type: 'jpeg', quality: 80 });
  await accept.click();
  await expect.poll(async () => /^pro-/.test((await step(page)) ?? ''), { timeout: 10000 }).toBe(false);
  await expect(page.locator('[data-story-row]')).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-guide', '');
}

test.describe('onboarding at 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('(a) a brand-new visitor makes an Ashguard and plays the prologue; (b) a second Keeper starts fresh; (c) the first is intact', async ({ page }) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    await firstVisit(page);

    // ── (a) ──
    await page.goto('/play?hour=12');
    await expect(lobby(page, 'title')).toBeVisible({ timeout: 30000 });
    await lobby(page, 'title').locator('[data-lobby-guest]').click();
    await expect(lobby(page, 'select').locator('[data-select-empty]')).toBeVisible();
    await lobby(page, 'select').locator('[data-lobby-new]').click();
    await expect(lobby(page, 'create')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: `${SHOTS}/a-glass.jpg`, type: 'jpeg', quality: 80 });
    await make(page, 'ashguard', 'Bryn');
    await expect(page.locator('[data-keeper-level]')).toHaveText('1');
    // The prologue's scroll: seven steps, the first one now, Glim to meet.
    await expect(page.locator('.guide-list li')).toHaveCount(7);
    await expect(page.locator('.guide[data-chapter]')).toBeVisible();
    await playPrologue(page, true);
    await page.screenshot({ path: `${SHOTS}/a-done.jpg`, type: 'jpeg', quality: 80 });
    const firstGold = await page.evaluate(() => JSON.parse(localStorage.getItem('godforge-economy') || '{}').totalGoldEarned ?? 0);
    expect(firstGold).toBeGreaterThan(0);
    // A setting changed on Keeper #1 (sound is account-wide).
    await page.evaluate(() => localStorage.setItem('godforge-sound', JSON.stringify({ music: 0.2, sfx: 0.4 })));

    // ── (b) ──
    await toSelect(page);
    await expect(lobby(page, 'select').locator('[data-character]')).toHaveCount(1);
    await lobby(page, 'select').locator('[data-lobby-new]').click();
    await make(page, 'lanternwright', 'Ivy');
    const second = await page.evaluate(() => localStorage.getItem('eclipse-active-character'));
    expect(second).toMatch(/^k[a-z0-9]{7}$/);
    await expect(page.locator('[data-keeper-level]')).toHaveText('1');
    await expect.poll(() => step(page), { timeout: 15000 }).toBe('pro-walk');
    await page.screenshot({ path: `${SHOTS}/b-second-keeper.jpg`, type: 'jpeg', quality: 80 });
    const fresh = await page.evaluate(id => {
      const read = (k: string) => { const raw = localStorage.getItem(`${k}@${id}`); return raw ? JSON.parse(raw) : null; };
      return {
        gold: read('godforge-economy')?.gold ?? 0,
        earned: read('godforge-economy')?.totalGoldEarned ?? 0,
        story: read('godforge-story'),
        hearth: read('godforge-hearth'),
        town: read('godforge-town-tasks'),
        look: read('godforge-keeper-look'),
        sound: localStorage.getItem('godforge-sound'),
      };
    }, second);
    expect(fresh.gold).toBe(0);
    expect(fresh.earned).toBe(0);
    expect(fresh.story?.tut ?? []).toEqual([]);
    expect(fresh.story?.skip).toBeUndefined();
    expect(fresh.hearth?.lit ?? []).toEqual([]);
    expect(JSON.stringify(fresh.town?.chains ?? {})).toBe('{}');
    expect(fresh.look.vocation).toBe('lanternwright');
    expect(fresh.sound).toContain('0.2');
    // Class-aware words: the Lanternwright's own key-1 line.
    await canvas(page).focus();
    await until(page, 'pro-walk', async () => { await page.keyboard.down('s'); await page.waitForTimeout(500); await page.keyboard.up('s'); });
    await page.locator('.guide-go').click();
    await expect.poll(() => step(page), { timeout: 30000 }).toBe('pro-fight');
    await expect(page.locator('.guide [data-goal-text]')).toContainText('your lantern burns it');
    await expect(page.locator('.guide [data-goal-text]')).toContainText('Press 1 to cast');
    // Skip, for this Keeper only.
    await page.locator('[data-prologue-skip]').click();
    await expect.poll(() => step(page)).toBeNull();
    expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`godforge-story@${id}`) || '{}').skip, second)).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('godforge-story') || '{}').skip)).toBeUndefined();

    // ── (c) ──
    await toSelect(page);
    await expect(lobby(page, 'select').locator('[data-character]')).toHaveCount(2);
    await lobby(page, 'select').locator('[data-character="c1"]').click();
    await lobby(page, 'select').locator('[data-lobby-enter]').click();
    await inWorld(page);
    expect(await page.evaluate(() => localStorage.getItem('eclipse-active-character'))).toBe('c1');
    await expect(page.locator('[data-keeper-level]')).toHaveText('1');
    await page.waitForTimeout(2000);
    expect(/^pro-/.test((await step(page)) ?? ''), 'the first Keeper finished the prologue').toBe(false);
    const back = await page.evaluate(() => ({
      earned: JSON.parse(localStorage.getItem('godforge-economy') || '{}').totalGoldEarned ?? 0,
      look: JSON.parse(localStorage.getItem('godforge-keeper-look') || '{}'),
      tut: JSON.parse(localStorage.getItem('godforge-story') || '{}').tut,
    }));
    expect(back.earned).toBe(firstGold);
    expect(back.look.name).toBe('Bryn');
    expect(back.look.vocation).toBe('ashguard');
    expect(back.tut).toEqual(['walk', 'book', 'bag']);
    expect(errors).toEqual([]);
  });
});

test.describe('onboarding on a 390×844 phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the Glass fits with Become in view; the prologue speaks touch; "played before" skips it for that Keeper', async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await firstVisit(page);
    await page.goto('/play?hour=12');
    await lobby(page, 'title').locator('[data-lobby-guest]').tap();
    await lobby(page, 'select').locator('[data-lobby-new]').tap();
    await expect(lobby(page, 'create')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: `${SHOTS}/phone-glass.jpg`, type: 'jpeg', quality: 80 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await make(page, 'warlock', 'Wren', { tap: true });
    await expect.poll(() => step(page), { timeout: 15000 }).toBe('pro-walk');
    await expect(page.locator('.guide [data-goal-text]')).toContainText('Drag on the ground');
    // The card's buttons are real targets on a phone.
    for (const sel of ['[data-prologue-skip]']) {
      const box = (await page.locator(sel).boundingBox())!;
      expect(box.height, sel).toBeGreaterThanOrEqual(44);
    }
    // A tap on open ground walks (the walk step counts it).
    const c = (await canvas(page).boundingBox())!;
    await expect.poll(async () => {
      for (const [fx, fy] of [[0.5, 0.3], [0.7, 0.4], [0.3, 0.45], [0.6, 0.55], [0.4, 0.6]]) {
        if ((await step(page)) !== 'pro-walk') break;
        // A tap that landed on a stall opened its panel (and paused the world): close it before the next one.
        const open = page.locator('.place .win-x:visible');
        if (await open.count()) await open.first().tap();
        await page.touchscreen.tap(c.x + c.width * fx, c.y + c.height * fy);
        await page.waitForTimeout(1500);
      }
      return step(page);
    }, { timeout: 30000 }).toBe('pro-hearth');
    // Whatever the tap walked into (a stall, the shrine) closes again.
    const close = page.locator('.place .win-x:visible');
    if (await close.count()) await close.first().tap();
    await page.waitForTimeout(400);
    await expect(page.locator('.guide [data-goal-text]')).toContainText('tap the fire');
    const go = (await page.locator('.guide-go').boundingBox())!;
    expect(go.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${SHOTS}/phone-step2.jpg`, type: 'jpeg', quality: 80 });

    // A second Keeper made by someone who has played before: no prologue for them, still there for the first.
    // A returning offline player opens /play on the character list.
    await page.waitForTimeout(2500);
    await page.goto('/play?hour=12');
    await expect(lobby(page, 'select')).toBeVisible({ timeout: 30000 });
    await lobby(page, 'select').locator('[data-lobby-new]').tap();
    await make(page, 'ashguard', 'Cole', { skip: true, tap: true });
    await page.waitForTimeout(2500);
    expect(await step(page)).toBeNull();
    await page.screenshot({ path: `${SHOTS}/phone-skipped.jpg`, type: 'jpeg', quality: 80 });
    // The first Keeper still has its prologue, at the step it reached.
    await page.goto('/play?hour=12');
    await lobby(page, 'select').locator('[data-character="c1"]').tap();
    await lobby(page, 'select').locator('[data-lobby-enter]').tap();
    await inWorld(page);
    await expect.poll(() => step(page), { timeout: 15000 }).toBe('pro-hearth');
  });
});
