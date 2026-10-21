/**
 * td-ashguard.spec.ts — the second vocation, played (design-bible §4.4): at the character list a new Keeper is made an
 * Ashguard at the Glass, enters the world in the Pyre Watch's kit, walks the four ways, swings his blade at a creature
 * until it falls, speaks his four starting spells, and opens the Spellbook on his three trees (Brand, Oath, Ash). A
 * level-20 Ashguard on a phone learns the deeper spells and lets them go.
 *
 * A creature is laid at the Keeper's side through the webdriver-only `__tdAsh` hook (td-engine), so the fight never
 * depends on where the town's spawns happen to be. Screenshots: docs/handoff/cozy-ui/ashguard-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, pickSkill, seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

const SHOTS = 'docs/handoff/cozy-ui';
const canvas = (page: Page) => page.locator('.viewport canvas');
type AshState = { vocation: string; range: number; hp: number; maxHp: number; mana: number; maxMana: number; defense: number; brand: boolean; block: boolean; vow: boolean };
const ash = {
  foe: (page: Page, type = 'ash-wolf', dx = 22) => page.evaluate(([t, d]) => (window as unknown as { __tdAsh: { foe(t: string, d: number): number } }).__tdAsh.foe(t as string, d as number), [type, dx] as const),
  foes: (page: Page) => page.evaluate(() => (window as unknown as { __tdAsh: { foes(): number } }).__tdAsh.foes()),
  swings: (page: Page) => page.evaluate(() => (window as unknown as { __tdAsh: { swings(): number } }).__tdAsh.swings()),
  state: (page: Page) => page.evaluate(() => (window as unknown as { __tdAsh: { state(): AshState } }).__tdAsh.state()),
};

/** A clip of the canvas round the Keeper (the camera keeps him in the middle). */
async function keeperClip(page: Page, half = 90): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  return { x: Math.max(0, cx - half), y: Math.max(0, cy - half - 20), width: half * 2, height: half * 2 };
}

async function walk(page: Page, key: string, ms = 350): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
}

test.describe('the Ashguard', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('make an Ashguard → enter → swing until a creature falls → the four spells → the three trees', async ({ page }) => {
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
    // The calling: two cards, the Warlock first and chosen; the Ashguard beside it.
    const warlock = glass.locator('.km__classcard[data-vocation="warlock"]'), guard = glass.locator('.km__classcard[data-vocation="ashguard"]');
    await expect(warlock).toHaveAttribute('aria-checked', 'true');
    await expect(guard).toContainText('Ashguard');
    await guard.click();
    await expect(guard).toHaveAttribute('aria-checked', 'true');
    await expect(warlock).toHaveAttribute('aria-checked', 'false');
    await glass.locator('.km__name input').fill('Wren');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/ashguard-pick.jpg`, type: 'jpeg', quality: 85 });
    await glass.locator('.km__keep').click();

    await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await expect.poll(async () => (await ash.state(page)).vocation, { timeout: 10000 }).toBe('ashguard');
    // The Vitality-led body: more life than a fresh Warlock's 100, less mana than his 60, Defense of his own.
    await expect.poll(async () => (await ash.state(page)).maxHp, { timeout: 5000 }).toBeGreaterThan(100);
    const st = await ash.state(page);
    expect(st.maxMana).toBeLessThan(60);
    expect(st.defense).toBeGreaterThan(0);
    expect(st.range).toBeLessThan(40);
    const id = await page.evaluate(() => localStorage.getItem('eclipse-active-character'));
    expect(await page.evaluate(k => localStorage.getItem(`godforge-keeper-look@${k}`), id)).toContain('"vocation":"ashguard"');

    // The four ways, in town, in the Pyre Watch's kit.
    for (const [key, dir] of [['s', 'down'], ['w', 'up'], ['a', 'left'], ['d', 'right']] as const) {
      await walk(page, key);
      await page.screenshot({ path: `${SHOTS}/ashguard-town-${dir}.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page) });
    }

    // A creature at his side: hold the attack key and the blade swings in its arc until it falls.
    expect(await ash.foe(page, 'ash-wolf', 22)).toBeGreaterThan(0);
    await expect.poll(() => ash.foes(page)).toBe(1);
    await canvas(page).focus();
    await page.keyboard.down('j');
    await expect.poll(() => ash.swings(page), { timeout: 8000 }).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/ashguard-swing.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 110) });
    await expect.poll(() => ash.foes(page), { timeout: 20000 }).toBe(0);
    await page.keyboard.up('j');
    expect(await ash.swings(page)).toBeGreaterThanOrEqual(2);

    // The four starting spells on keys 1–4: each speaks its words (data-cant) and leaves its picture.
    const casts: [string, string, string][] = [['2', 'brann vael sha', 'brand'], ['4', 'brann ka', 'oath'], ['1', 'brann mur', 'bash'], ['3', 'brann sha', 'stride']];
    for (const [key, words, shot] of casts) {
      await ash.foe(page, 'bone-walker', key === '3' ? 52 : 20);
      await page.waitForTimeout(150);
      await canvas(page).focus();
      await page.keyboard.press(key);
      await expect(canvas(page)).toHaveAttribute('data-cant', new RegExp(words), { timeout: 4000 });
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${SHOTS}/ashguard-skill-${shot}.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 110) });
      await page.waitForTimeout(600);
    }
    const after = await ash.state(page);
    expect(after.brand || after.block).toBe(true);

    // The Spellbook: the Ashguard's three trees, Brand open first.
    await canvas(page).focus();
    await page.keyboard.press('k');
    await expect(page.locator('.sbt')).toBeVisible();
    await expect(page.locator('#spellbook-title')).toContainText('Ashguard');
    await expect(page.locator('.sbt__tab')).toHaveCount(4);
    await expect(page.locator('.sbt__tab[data-tree="brand"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.sbt__tab[data-tree="ember"]')).toHaveCount(0);
    await expect(page.locator('.sbt__node[data-skill="watch-blade"] .sbt__badge')).toHaveText('1');
    await pickSkill(page, 'ember-brand');
    await expect(page.locator('.sbt__detail .sbt__cant q')).toHaveText('brann vael sha');
    await page.screenshot({ path: `${SHOTS}/ashguard-tree-brand.jpg`, type: 'jpeg', quality: 85 });
    for (const tree of ['oath', 'ash'] as const) {
      await page.locator(`.sbt__tab[data-tree="${tree}"]`).click();
      await expect(page.locator('.sbt__tree')).toHaveAttribute('data-tree', tree);
      await pickSkill(page, tree === 'oath' ? 'shield-oath' : 'last-watch');
      await page.screenshot({ path: `${SHOTS}/ashguard-tree-${tree}.jpg`, type: 'jpeg', quality: 85 });
    }
    await expect(page.locator('.sbt__node[data-skill="last-watch"] .sbt__need')).toHaveText('Lv 24');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('a level-20 Ashguard on a phone: learns the deeper spells and lets them go; the book fits', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, {
      'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), ...activity({ hunting: xpForLevel(20) }),
      'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 5, hair: 'cropped', updatedAt: 1 },
    });
    await page.goto('/play?td=1&hour=12');
    await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    await expect.poll(async () => (await ash.state(page)).vocation, { timeout: 10000 }).toBe('ashguard');
    await canvas(page).focus();
    await page.keyboard.press('k');
    await expect(page.locator('.sbt')).toBeVisible();
    // Cinder Cleave → key 1, the Whirl → key 2 (it needs the Cleave), the Watch Cry → key 3.
    for (const [skill, key, ranks] of [['cinder-cleave', 1, 2], ['whirl-of-cinders', 2, 1], ['watch-cry', 3, 1]] as const) {
      await pickSkill(page, skill);
      for (let i = 0; i < ranks; i++) await page.locator('.sbt__detail .sbt__learn').click();
      await page.locator('.sbt__detail .sb__keys button', { hasText: String(key) }).click();
    }
    const sheet = (await page.locator('.sbt').boundingBox())!;
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `${SHOTS}/ashguard-tree-phone.jpg`, type: 'jpeg', quality: 85 });
    await page.locator('.spellbook .win-x').click();

    for (const [key, words, shot] of [['3', 'brann orum', 'cry'], ['1', 'brann vael mur', 'cleave'], ['2', 'vael orum brann', 'whirl']] as const) {
      await ash.foe(page, 'bone-walker', 24);
      await ash.foe(page, 'ash-wolf', -26);
      await page.waitForTimeout(150);
      await canvas(page).focus();
      await page.keyboard.press(key);
      await expect(canvas(page)).toHaveAttribute('data-cant', new RegExp(words), { timeout: 4000 });
      await page.waitForTimeout(shot === 'whirl' ? 40 : 120);
      await page.screenshot({ path: `${SHOTS}/ashguard-skill-${shot}.jpg`, type: 'jpeg', quality: 88, clip: await keeperClip(page, 120) });
      await page.waitForTimeout(500);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
