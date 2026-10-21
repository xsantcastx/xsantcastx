/**
 * td-lantern.spec.ts — the third vocation, played (design-bible §4.3): at the character list a new Keeper is made a
 * Lanternwright at the Glass, enters the world with the lamp-staff lit, walks the four ways, throws the lantern's flare
 * at a creature until it falls, mends a wound with Hearthlight, flashes, calls a wisp, shutters the lantern, and opens
 * the Spellbook on the three trees (Lamp, Hearth, Moth). A level-24 Lanternwright at midnight learns the deep spells
 * and lets them go — Dawn at Noon last, a disc of daylight in the dark.
 *
 * A creature is laid at the Keeper's side through the webdriver-only `__tdLamp` hook (td-engine), so the fight never
 * depends on where the town's spawns happen to be. Screenshots: docs/handoff/cozy-ui/lantern-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, pickSkill, seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

const SHOTS = 'docs/handoff/cozy-ui';
const canvas = (page: Page) => page.locator('.viewport canvas');
type LampState = {
  vocation: string; range: number; hp: number; maxHp: number; mana: number; maxMana: number; light: number; shuttered: boolean;
  flares: number; wisps: number; beacons: number; ward: number; dawns: number; hearth: number; phase: string;
};
type W = { __tdLamp: { foe(t: string, d: number): number; foes(): number; calm(): void; wound(n: number): number; state(): LampState } };
const lamp = {
  foe: (page: Page, type = 'bone-walker', dx = 40) => page.evaluate(([t, d]) => (window as unknown as W).__tdLamp.foe(t as string, d as number), [type, dx] as const),
  foes: (page: Page) => page.evaluate(() => (window as unknown as W).__tdLamp.foes()),
  calm: (page: Page) => page.evaluate(() => (window as unknown as W).__tdLamp.calm()),
  wound: (page: Page, n: number) => page.evaluate(k => (window as unknown as W).__tdLamp.wound(k), n),
  state: (page: Page) => page.evaluate(() => (window as unknown as W).__tdLamp.state()),
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

test.describe('the Lanternwright', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('make a Lanternwright → enter → flare until a creature falls → mend → flash, wisp, shutter → the three trees', async ({ page }) => {
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
    // The calling: four cards, the Warlock first and chosen; the Lanternwright third.
    await expect(glass.locator('.km__classcard')).toHaveCount(4);
    const warlock = glass.locator('.km__classcard[data-vocation="warlock"]'), lw = glass.locator('.km__classcard[data-vocation="lanternwright"]');
    await expect(warlock).toHaveAttribute('aria-checked', 'true');
    await expect(lw).toContainText('Lanternwright');
    await lw.click();
    await expect(lw).toHaveAttribute('aria-checked', 'true');
    await expect(warlock).toHaveAttribute('aria-checked', 'false');
    await glass.locator('.km__name input').fill('Tomas');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/lantern-pick.jpg`, type: 'jpeg', quality: 85 });
    await glass.locator('.km__keep').click();

    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await expect.poll(async () => (await lamp.state(page)).vocation, { timeout: 10000 }).toBe('lanternwright');
    // A support's body: a deep well of mana (more than a fresh Warlock's 60), a lantern that lights further, a short flare.
    await expect.poll(async () => (await lamp.state(page)).maxMana, { timeout: 5000 }).toBeGreaterThan(60);
    const st = await lamp.state(page);
    expect(st.light).toBeGreaterThanOrEqual(2);
    expect(st.range).toBeLessThan(7 * 16);
    const id = await page.evaluate(() => localStorage.getItem('eclipse-active-character'));
    expect(await page.evaluate(k => localStorage.getItem(`godforge-keeper-look@${k}`), id)).toContain('"vocation":"lanternwright"');

    // The four ways, in town, with the lamp-staff.
    for (const [key, dir] of [['s', 'down'], ['w', 'up'], ['a', 'left'], ['d', 'right']] as const) {
      await walk(page, key);
      await page.screenshot({ path: `${SHOTS}/lantern-town-${dir}.jpg`, type: 'jpeg', quality: 90, clip: await keeperClip(page, 70, 10) });
    }

    // One of the dead at his side: hold the attack key and the lantern throws its flares until it falls.
    expect(await lamp.foe(page, 'bone-walker', 58)).toBeGreaterThan(0);
    await expect.poll(() => lamp.foes(page)).toBe(1);
    await lamp.calm(page);
    await canvas(page).focus();
    await page.keyboard.down('j');
    // Caught in flight: the flare is a cream mote with a brass tail on its way to the foe.
    await expect.poll(async () => (await lamp.state(page)).flares, { timeout: 8000, intervals: [16] }).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/lantern-attack.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 190) });
    await expect.poll(() => lamp.foes(page), { timeout: 25000 }).toBe(0);
    await page.keyboard.up('j');

    // Hearthlight (key 1) mends a wound over three seconds.
    const hurt = await lamp.wound(page, 40);
    await cast(page, '1', 'hesk ka');
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/lantern-skill-hearthlight.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 110) });
    await expect.poll(async () => (await lamp.state(page)).hp, { timeout: 6000 }).toBeGreaterThan(hurt + 20);

    // The Blinding Flash (2) and the Lamp-Wisp (3), with the dead near.
    for (const [key, words, shot] of [['2', 'lum orum', 'flash'], ['3', 'lum teth', 'wisp']] as const) {
      await lamp.foe(page, 'bone-walker', 30);
      await lamp.calm(page);
      await page.waitForTimeout(150);
      await cast(page, key, words);
      await page.waitForTimeout(shot === 'flash' ? 80 : 400);
      await page.screenshot({ path: `${SHOTS}/lantern-skill-${shot}.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 110) });
      await page.waitForTimeout(500);
    }
    expect((await lamp.state(page)).wisps).toBeGreaterThan(0);

    // Shutter the Lantern (4): the carried light goes; again, it comes back.
    const lit = (await lamp.state(page)).light;
    await cast(page, '4', 'lum un ka');
    await expect.poll(async () => (await lamp.state(page)).shuttered).toBe(true);
    expect((await lamp.state(page)).light).toBeLessThan(lit);
    await page.waitForTimeout(1200);
    await canvas(page).focus();
    await page.keyboard.press('4');
    await expect.poll(async () => (await lamp.state(page)).shuttered).toBe(false);

    // The Spellbook: the Lanternwright's three trees, Lamp open first (from the level-up banner, if the kill raised one).
    const fromBanner = page.locator('[data-level-book]');
    if (await fromBanner.isVisible()) await fromBanner.click();
    else { await canvas(page).focus(); await page.keyboard.press('k'); }
    await expect(page.locator('.sbt')).toBeVisible();
    await expect(page.locator('#spellbook-title')).toContainText('Lanternwright');
    await expect(page.locator('.sbt__tab')).toHaveCount(4);
    await expect(page.locator('.sbt__tab[data-tree="lamp"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.sbt__tab[data-tree="ember"]')).toHaveCount(0);
    await expect(page.locator('.sbt__node[data-skill="kindle"] .sbt__badge')).toHaveText('1');
    await pickSkill(page, 'dawn-at-noon');
    await expect(page.locator('.sbt__detail .sbt__cant q')).toHaveText('lum ul orum');
    await expect(page.locator('.sbt__node[data-skill="dawn-at-noon"] .sbt__need')).toHaveText('Lv 24');
    await page.screenshot({ path: `${SHOTS}/lantern-tree-lamp.jpg`, type: 'jpeg', quality: 85 });
    for (const tree of ['hearth', 'moth'] as const) {
      await page.locator(`.sbt__tab[data-tree="${tree}"]`).click();
      await expect(page.locator('.sbt__tree')).toHaveAttribute('data-tree', tree);
      await pickSkill(page, tree === 'hearth' ? 'hearth-circle' : 'beacon');
      await page.screenshot({ path: `${SHOTS}/lantern-tree-${tree}.jpg`, type: 'jpeg', quality: 85 });
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('a level-24 Lanternwright at midnight: learns the deep spells and lets them go, Dawn at Noon last', async ({ page }) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, {
      'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), ...activity({ hunting: xpForLevel(24) }),
      'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Tomas', vocation: 'lanternwright', skin: 2, hair: 'cropped', updatedAt: 1 },
    });
    await page.goto('/play?td=1&hour=0');
    await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    await expect.poll(async () => (await lamp.state(page)).vocation, { timeout: 10000 }).toBe('lanternwright');
    expect((await lamp.state(page)).phase).toBe('night');
    await canvas(page).focus();
    await page.keyboard.press('k');
    await expect(page.locator('.sbt')).toBeVisible();
    // Banish → key 1, Hearth Circle → key 2, the Beacon → key 3, Dawn at Noon (it needs Banish) → key 4.
    for (const [skill, key] of [['banish', 1], ['hearth-circle', 2], ['beacon', 3], ['dawn-at-noon', 4]] as const) {
      await pickSkill(page, skill);
      await page.locator('.sbt__detail .sbt__learn').click();
      await page.locator('.sbt__detail .sb__keys button', { hasText: String(key) }).click();
    }
    await page.locator('.spellbook .win-x').click();
    // Out of the square onto the open grass, where the night is dark.
    await walk(page, 'a', 1400);
    await walk(page, 's', 300);
    await page.waitForTimeout(1500);

    for (const [key, words, shot, cost] of [['2', 'hesk orum', 'circle', 24], ['3', 'lum dra', 'beacon', 26], ['1', 'lum un', 'banish', 22], ['4', 'lum ul orum', 'dawn', 40]] as const) {
      // The well refills between spells (a fresh Keeper's mana starts below a level-24 well).
      await expect.poll(async () => (await lamp.state(page)).mana, { timeout: 30000 }).toBeGreaterThanOrEqual(cost);
      await lamp.foe(page, 'bone-walker', 34);
      await lamp.foe(page, 'ash-ghoul', -36);
      await lamp.calm(page);
      await page.waitForTimeout(150);
      await cast(page, key, words);
      if (shot === 'circle') expect((await lamp.state(page)).hearth).toBe(1);
      if (shot === 'beacon') expect((await lamp.state(page)).beacons).toBe(1);
      await page.waitForTimeout(shot === 'banish' ? 90 : 500);
      // Wide enough to show the night round the Keeper's (large) light.
      await page.screenshot({ path: `${SHOTS}/lantern-skill-${shot}-night.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 240) });
      if (shot === 'dawn') await page.screenshot({ path: `${SHOTS}/lantern-dawn-night-full.jpg`, type: 'jpeg', quality: 85 });
      await page.waitForTimeout(400);
    }
    const end = await lamp.state(page);
    expect(end.dawns).toBe(1);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
