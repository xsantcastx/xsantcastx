/**
 * td-thorn.spec.ts — the fourth vocation, played (design-bible §4.5): at the character list a new Keeper is made a
 * Thornstrider at the Glass, enters the world with the bow and the quiver (and, with no pet, a spirit beast at his
 * side), walks the four ways, shoots a creature until it falls, sends the beast at another (Command), bleeds it, snares
 * it, looses a volley, and opens the Spellbook on the three trees (Thorn, Wild, Briar). A level-24 Thornstrider at dusk
 * with a pet of his own learns the deep spells and lets them go — the Stampede last.
 *
 * Creatures are laid at the Keeper's side through the webdriver-only `__tdThorn` hook (td-engine), so the fight never
 * depends on where the town's spawns happen to be. Screenshots: docs/handoff/cozy-ui/thorn-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, pickSkill, seed, learnRanks, putOnKey } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

const SHOTS = 'docs/handoff/cozy-ui';
const canvas = (page: Page) => page.locator('.viewport canvas');
type ThornState = {
  vocation: string; range: number; hp: number; maxHp: number; mana: number; maxMana: number; speed: number; loosed: number; arrows: number; phase: string;
  pet: { id: string; spirit: boolean; doing: string; hits: number; x: number; y: number } | null;
  commanded: boolean; commands: number; bonded: boolean; called: number; stampede: number; snares: number; traps: number;
  rooted: number; bleeding: number; rootwalk: boolean; foeHp: number[];
};
type W = { __tdThorn: { foe(t: string, dx: number, dy: number): number; foes(): number; calm(): void; tough(hp: number): void; target(): boolean; clearing(): boolean; state(): ThornState } };
const thorn = {
  foe: (page: Page, type = 'ash-wolf', dx = 70, dy = 0) => page.evaluate(([t, x, y]) => (window as unknown as W).__tdThorn.foe(t as string, x as number, y as number), [type, dx, dy] as const),
  foes: (page: Page) => page.evaluate(() => (window as unknown as W).__tdThorn.foes()),
  calm: (page: Page) => page.evaluate(() => (window as unknown as W).__tdThorn.calm()),
  tough: (page: Page, hp = 4000) => page.evaluate(n => (window as unknown as W).__tdThorn.tough(n), hp),
  target: (page: Page) => page.evaluate(() => (window as unknown as W).__tdThorn.target()),
  clearing: (page: Page) => page.evaluate(() => (window as unknown as W).__tdThorn.clearing()),
  state: (page: Page) => page.evaluate(() => (window as unknown as W).__tdThorn.state()),
};

/** A clip of the canvas round the Keeper (the camera keeps him in the middle). */
async function keeperClip(page: Page, half = 90, up = 20): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  return { x: Math.max(0, cx - half), y: Math.max(0, cy - half - up), width: half * 2, height: half * 2 };
}

async function walk(page: Page, key: string, ms = 350): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
}

/** Press a bar key and wait for its words over the Keeper's head. */
async function cast(page: Page, key: string, words: string): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press(key);
  await expect(canvas(page)).toHaveAttribute('data-cant', new RegExp(`^${words}$|${words}`), { timeout: 4000 });
}

/** A foe at the Keeper's side that stands still, does no harm and lasts, his target. */
async function standingFoe(page: Page, dx = 64, dy = 0, type = 'ash-wolf'): Promise<void> {
  await thorn.foe(page, type, dx, dy);
  await thorn.calm(page);
  await thorn.tough(page);
  await thorn.target(page);
}

test.describe('the Thornstrider', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('make a Thornstrider → enter → shoot until a creature falls → command the beast → barb, snare, volley → the three trees', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // A browser that already plays a Warlock (an old save, character #1): he stays a Warlock.
    const act = emptyActivityLedger();
    act.progress.xpByDiscipline = { hunting: keeperXpForLevel(4) + 3 } as typeof act.progress.xpByDiscipline;
    await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
    await seed(page, {
      'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'godforge-activity': act,
      'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Aster', hair: 'braid', updatedAt: 1 },
    });
    await page.evaluate(() => { localStorage.removeItem('eclipse-lobby'); localStorage.setItem('eclipse-lobby-guest', '1'); });
    await page.goto('/play?td=1&hour=12');

    const list = page.locator('.lobby[data-lobby="select"]');
    await expect(list).toBeVisible({ timeout: 20000 });
    await expect(list.locator('[data-character="c1"] .char__line').first()).toContainText('Warlock');
    await list.locator('[data-lobby-new]').click();
    const glass = page.locator('.lobby[data-lobby="create"]');
    await expect(glass).toBeVisible({ timeout: 20000 });
    // The calling: four cards, the Warlock first and chosen; the Thornstrider fourth.
    await expect(glass.locator('.km__classcard')).toHaveCount(4);
    const warlock = glass.locator('.km__classcard[data-vocation="warlock"]'), ts = glass.locator('.km__classcard[data-vocation="thornstrider"]');
    await expect(glass.locator('.km__classcard').nth(3)).toHaveAttribute('data-vocation', 'thornstrider');
    await expect(warlock).toHaveAttribute('aria-checked', 'true');
    await expect(ts).toContainText('Thornstrider');
    await expect(ts).toContainText('bow');
    await ts.click();
    await expect(ts).toHaveAttribute('aria-checked', 'true');
    await expect(warlock).toHaveAttribute('aria-checked', 'false');
    await glass.locator('.km__name input').fill('Ilsa');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/thorn-pick.jpg`, type: 'jpeg', quality: 85 });
    await glass.locator('.km__keep').click();

    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await expect.poll(async () => (await thorn.state(page)).vocation, { timeout: 10000 }).toBe('thornstrider');
    const st = await thorn.state(page);
    // The bow reaches further than the Lanternwright's flare (4 tiles), short of the Warlock's bolt (7).
    expect(st.range).toBeGreaterThan(4 * 16);
    expect(st.range).toBeLessThan(7 * 16);
    const id = await page.evaluate(() => localStorage.getItem('eclipse-active-character'));
    expect(await page.evaluate(k => localStorage.getItem(`godforge-keeper-look@${k}`), id)).toContain('"vocation":"thornstrider"');
    // No pet follows this new Keeper: a spirit beast stands in at his side.
    await expect.poll(async () => (await thorn.state(page)).pet?.id, { timeout: 8000 }).toBe('spirit-beast');
    expect((await thorn.state(page)).pet?.spirit).toBe(true);
    await expect(canvas(page)).toHaveAttribute('data-pet', 'spirit-beast');

    // The four ways, in town, with the bow and the quiver.
    for (const [key, dir] of [['s', 'down'], ['w', 'up'], ['a', 'left'], ['d', 'right']] as const) {
      await walk(page, key);
      await page.screenshot({ path: `${SHOTS}/thorn-town-${dir}.jpg`, type: 'jpeg', quality: 90, clip: await keeperClip(page, 70, 10) });
    }

    // Out of the busy square to an open meadow nearby (the hunting is clearer there).
    expect(await thorn.clearing(page)).toBe(true);
    await page.waitForTimeout(3200);
    // A wolf at range: hold the attack key and the bow looses until it falls.
    expect(await thorn.foe(page, 'ash-wolf', 56)).toBeGreaterThan(0);
    await expect.poll(() => thorn.foes(page)).toBe(1);
    await thorn.calm(page);
    await canvas(page).focus();
    await page.keyboard.down('j');
    // Caught in flight: the arrow, a green tip and a bark shaft, on its way.
    await expect.poll(async () => (await thorn.state(page)).arrows, { timeout: 8000, intervals: [16] }).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/thorn-shot.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 220) });
    await expect.poll(() => thorn.foes(page), { timeout: 25000 }).toBe(0);
    await page.keyboard.up('j');
    expect((await thorn.state(page)).loosed).toBeGreaterThan(0);

    // Command (key 1): the beast is sent at a foe and bites it.
    await standingFoe(page, 52);
    const before = (await thorn.state(page)).pet?.hits ?? 0;
    await cast(page, '1', 'thar sha teth');
    await expect.poll(async () => (await thorn.state(page)).commanded).toBe(true);
    await expect.poll(async () => (await thorn.state(page)).pet?.hits ?? 0, { timeout: 8000 }).toBeGreaterThan(before);
    await page.screenshot({ path: `${SHOTS}/thorn-skill-command.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 220) });

    // Barbed Shot (2): the foe bleeds. The Thornroot Snare (3): it is rooted. Volley (4): a fan of arrows.
    await cast(page, '2', 'thar un sha');
    await expect.poll(async () => (await thorn.state(page)).bleeding, { timeout: 4000 }).toBeGreaterThan(0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/thorn-skill-barbed.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 220) });
    await cast(page, '3', 'thar mur');
    await expect.poll(async () => (await thorn.state(page)).snares).toBe(1);
    await expect.poll(async () => (await thorn.state(page)).rooted, { timeout: 4000 }).toBeGreaterThan(0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/thorn-skill-snare.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 220) });
    const loosed = (await thorn.state(page)).loosed;
    await cast(page, '4', 'thar orum sha');
    expect((await thorn.state(page)).loosed - loosed).toBeGreaterThanOrEqual(5);
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${SHOTS}/thorn-skill-volley.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 220) });

    // The Spellbook: the Thornstrider's three trees, Thorn open first (from the level-up banner, if the kill raised one).
    const fromBanner = page.locator('[data-level-book]');
    if (await fromBanner.isVisible()) await fromBanner.click();
    else { await canvas(page).focus(); await page.keyboard.press('k'); }
    await expect(page.locator('.sbt')).toBeVisible();
    await expect(page.locator('#spellbook-title')).toContainText('Thornstrider');
    await expect(page.locator('.book__tab:not(.book__tab--keys)')).toHaveCount(4);
    await expect(page.locator('[data-book-tab="thorn"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-book-tab="ember"]')).toHaveCount(0);
    await expect(page.locator('.brow[data-row="thorn-shot"] .brow__rank b')).toHaveText('r 1/20');
    // Heartwood is the Thorn Shot's first mark now (skill-book.md §6).
    await expect(page.locator('[data-mark="thorn-shot.a1"]')).toHaveAttribute('aria-label', /^Heartwood/);
    await pickSkill(page, 'thorn-shot');
    await page.locator('[data-book-tab="wild"]').click();
    await expect(page.locator('.book__spread')).toHaveAttribute('data-tree', 'wild');
    await pickSkill(page, 'stampede');
    await expect(page.locator('.bcard .bcard__words')).toHaveText('thar ul teth');
    await page.locator('[data-book-tab="briar"]').click();
    await expect(page.locator('.book__spread')).toHaveAttribute('data-tree', 'briar');
    await pickSkill(page, 'bramble-trap');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('a level-24 Thornstrider at dusk with a pet: the pet is commanded, a beast is called, a trap laid, the Stampede let go', async ({ page }) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const NOW = Date.now();
    const record = { got: NOW - 86_400_000, hatched: NOW - 86_400_000, name: 'Bolt', nameAt: NOW - 86_400_000, love: 5, feedDay: '', feeds: 0, hat: false, hatAt: 0, xp: 0, findDay: '', scouts: 0, trinkets: 0 };
    await seed(page, {
      'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), ...activity({ hunting: xpForLevel(24) }),
      'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Ilsa', vocation: 'thornstrider', skin: 1, hair: 'braid', updatedAt: 1 },
      'godforge-pets': { version: 1, pets: { 'ink-pup': record }, active: 'ink-pup', activeAt: NOW, tally: {}, command: 'follow', commandAt: 0 },
    });
    await page.goto('/play?td=1&hour=19');
    await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    await expect.poll(async () => (await thorn.state(page)).vocation, { timeout: 10000 }).toBe('thornstrider');
    expect((await thorn.state(page)).phase).toBe('dusk');
    // His own pet walks with him: no spirit beast.
    await expect.poll(async () => (await thorn.state(page)).pet?.id, { timeout: 10000 }).toBe('ink-pup');
    expect((await thorn.state(page)).pet?.spirit).toBe(false);
    await canvas(page).focus();
    await page.keyboard.press('k');
    await expect(page.locator('.sbt')).toBeVisible();
    // The Call → key 2, the Bramble Trap → key 3, the Stampede (it needs the Call) → key 4; Command stays on 1.
    for (const [skill, key] of [['call-of-the-wilds', 2], ['bramble-trap', 3], ['stampede', 4]] as const) {
      await learnRanks(page, skill);
      await putOnKey(page, skill, key);
    }
    // The Wild page at dusk: the beast's numbers show the hour.
    await page.locator('[data-book-tab="wild"]').click();
    await pickSkill(page, 'command');
    await page.locator('.spellbook .win-x').click();
    // Out of the square onto the open grass.
    expect(await thorn.clearing(page)).toBe(true);
    // The place's name banner fades before the first picture.
    await page.waitForTimeout(3200);

    for (const [key, words, shot, cost] of [['1', 'thar sha teth', 'command-pet', 8], ['2', 'thar teth', 'call', 22], ['3', 'thar un', 'trap', 16], ['4', 'thar ul teth', 'stampede', 45]] as const) {
      await expect.poll(async () => (await thorn.state(page)).mana, { timeout: 30000 }).toBeGreaterThanOrEqual(cost);
      if (shot === 'command-pet' || shot === 'stampede') await standingFoe(page, 52);
      await page.waitForTimeout(150);
      const hits = (await thorn.state(page)).pet?.hits ?? 0;
      await cast(page, key, words);
      if (shot === 'command-pet') {
        await expect.poll(async () => (await thorn.state(page)).pet?.hits ?? 0, { timeout: 8000 }).toBeGreaterThan(hits);
        expect((await thorn.state(page)).pet?.id).toBe('ink-pup');
      }
      if (shot === 'call') expect((await thorn.state(page)).called).toBe(1);
      if (shot === 'trap') expect((await thorn.state(page)).traps).toBe(1);
      if (shot === 'stampede') expect((await thorn.state(page)).stampede).toBeGreaterThanOrEqual(5);
      await page.waitForTimeout(shot === 'stampede' ? 260 : 450);
      await page.screenshot({ path: `${SHOTS}/thorn-skill-${shot}.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, shot === 'stampede' ? 260 : 220) });
    }
    // The stampede ran through: the foe was struck.
    await expect.poll(async () => (await thorn.state(page)).stampede, { timeout: 5000 }).toBe(0);
    const end = await thorn.state(page);
    expect(Math.min(...end.foeHp)).toBeLessThan(4000);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
