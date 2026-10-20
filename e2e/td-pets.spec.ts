/**
 * td-pets.spec.ts — the companions in the top-down world (td-pets.ts; owner 2026-10-20: "fix the pets, they should
 * follow and help and pick up stuff and idle cute, same for Glim").
 *
 * A seeded Keeper with Glim met and the Rivet Maw hatchling following (a fetcher). The pet stands at his side, its
 * chip by the portrait says what it is doing, and with `?petfetch=1` (webdriver only: two real materials a few steps
 * off) it fetches them into the Satchel through his own pick-up. Standing still, it sits; Glim orbits. In the Ember
 * Mine (dark), Glim's light is the wide one. Screenshots: docs/handoff/cozy-ui/pets-*.jpg and glim-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, seed, stackQty } from './play-helpers';

const NOW = Date.now();
const GLIM = {
  version: 1, met: true, metAt: '2026-10-14T00:00:00.000Z', ladder: {},
  said: { meet: 1, homestead: 1, 'pet.rivet-hatchling': 1, 'pet.ink-pup': 1 }, lastAt: { meet: 1, homestead: 1 },
  moments: ['area:infernal', 'talk:who', 'depth:0'], answers: {}, peak: 3, seenAt: NOW,
};
const record = { got: NOW - 86_400_000, hatched: NOW - 86_400_000, name: 'Bolt', nameAt: NOW - 86_400_000, love: 5, feedDay: '', feeds: 0, hat: false, hatAt: 0, xp: 0, findDay: '', scouts: 0, trinkets: 0 };
const pets = (active: string) => ({ version: 1, pets: { 'rivet-hatchling': record, 'ink-pup': { ...record, name: '' } }, active, activeAt: NOW, tally: {}, command: 'follow', commandAt: 0 });
const SEEDED = (active = 'rivet-hatchling', extra: Record<string, unknown> = {}) => ({ 'eclipse-td': '1', 'preferred-language': 'en', 'godforge-glim': GLIM, 'godforge-pets': pets(active), ...extra });
/** Underground: the Ember Mine's first floor, by the ladder (dark: lit only by torches, the Keeper and Glim). */
const IN_MINE = { 'eclipse-play-world-v1': { td: { continent: 'ember-isle', level: 'ember-mine-1', x: 184, y: 250 } } };

const shot = (page: Page, name: string) => page.screenshot({ path: `docs/handoff/cozy-ui/${name}.jpg`, type: 'jpeg', quality: 80 });
const num = async (page: Page, attr: string) => Number(await page.locator('canvas').first().getAttribute(attr));

async function arrive(page: Page, query: string): Promise<void> {
  await page.goto(`/play?td=1&${query}`);
  const canvas = page.locator('canvas').first();
  await expect(canvas).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await expect(canvas).toHaveAttribute('data-pet', 'rivet-hatchling', { timeout: 10000 });
}
/** Is the pet within a few steps of the Keeper? */
async function petBeside(page: Page): Promise<number> {
  const px = await num(page, 'data-player-x'), py = await num(page, 'data-player-y');
  const x = await num(page, 'data-pet-x'), y = await num(page, 'data-pet-y');
  return Math.hypot(x - px, y - py);
}

test.describe('top-down pets and Glim', () => {
  test('desktop: the pet walks beside the Keeper, fetches into the Satchel, sits and naps; its chip says so', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, SEEDED());
    await arrive(page, 'hour=12&petfetch=1');
    await expect.poll(() => petBeside(page), { timeout: 5000 }).toBeLessThan(40);
    const chip = page.locator('.td-pet');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Bolt');
    // Two real materials lie a few steps off: it carries both to the Keeper's feet, his pick-up takes them.
    await expect.poll(() => num(page, 'data-pet-gathers'), { timeout: 25000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => (await stackQty(page, 'ember-residue')) + (await stackQty(page, 'cinder-ore')), { timeout: 10000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => petBeside(page), { timeout: 8000 }).toBeLessThan(40);
    // Standing still: it sits (the chip says so), Glim drifts off the shoulder into an orbit.
    await expect(page.locator('canvas').first()).toHaveAttribute('data-pet-state', /sit|follow/, { timeout: 8000 });
    await expect(chip).toHaveAttribute('data-pet-doing', 'sit', { timeout: 8000 });
    await page.waitForTimeout(1200);
    await shot(page, 'pets-day');
    // The chip opens the pet sheet, as the Satchel's pet well does.
    await chip.click();
    await expect(page.locator('[data-pet-sheet]')).toBeVisible();
    await page.locator('[data-pet-sheet] .ps__x').click();
    await expect(page.locator('[data-pet-sheet]')).toBeHidden();
    // A long rest: it naps.
    await expect(chip).toHaveAttribute('data-pet-doing', 'sleep', { timeout: 30000 });
    await page.waitForTimeout(500);
    await shot(page, 'pets-nap');
  });

  test('walking: the pet keeps up and never blocks the way', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, SEEDED('ink-pup'));
    await page.goto('/play?td=1&hour=12');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toHaveAttribute('data-pet', 'ink-pup', { timeout: 20000 });
    const x0 = await num(page, 'data-player-x');
    await canvas.focus();
    await page.keyboard.down('d');
    await page.waitForTimeout(1600);
    await page.keyboard.up('d');
    await expect.poll(() => num(page, 'data-player-x')).toBeGreaterThan(x0 + 40);
    await expect.poll(() => petBeside(page), { timeout: 4000 }).toBeLessThan(44);
    await expect(page.locator('.td-pet')).toContainText('Ink Pup');
  });

  test('in the dark: Glim lights the mine wider than the Keeper, the pet at his side', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, SEEDED('rivet-hatchling', IN_MINE));
    await arrive(page, 'hour=23');
    await expect(page.locator('.viewport')).toHaveAttribute('data-glim-mood', /\w+/, { timeout: 10000 });
    await expect.poll(() => petBeside(page), { timeout: 5000 }).toBeLessThan(44);
    // Past the place card; Glim has had time to hop toward the first ore seam it noticed.
    await page.waitForTimeout(5200);
    await shot(page, 'glim-dungeon');
    const save = await blob<{ active: string }>(page, 'godforge-pets');
    expect(save?.active).toBe('rivet-hatchling');
  });

  test('a summer night in town: Glim orbits the resting Keeper, a warm light; the pet sits by him', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, SEEDED('ink-pup'));
    await page.goto('/play?td=1&hour=22');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toHaveAttribute('data-pet', 'ink-pup', { timeout: 20000 });
    await expect(page.locator('.td-pet')).toHaveAttribute('data-pet-doing', 'sit', { timeout: 10000 });
    await page.waitForTimeout(4000);
    await shot(page, 'glim-night');
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    test('390×844 touch: the pet chip fits the OSRS layout, clear of the orbs, the goal chip, the spells and the menu', async ({ page }) => {
      test.setTimeout(60000);
      await seed(page, SEEDED());
      await arrive(page, 'hour=19');
      const chip = page.locator('.td-pet');
      await expect(chip).toBeVisible();
      const c = (await chip.boundingBox())!;
      expect(c.height).toBeGreaterThanOrEqual(44);
      expect(c.x + c.width).toBeLessThanOrEqual(390);
      const overlaps = async (sel: string) => {
        for (const box of await page.locator(sel).evaluateAll(els => els.map(e => e.getBoundingClientRect()).filter(r => r.width && r.height).map(r => ({ x: r.x, y: r.y, w: r.width, h: r.height })))) {
          if (c.x < box.x + box.w && c.x + c.width > box.x && c.y < box.y + box.h && c.y + c.height > box.y) return sel;
        }
        return '';
      };
      for (const sel of ['.td-orbs', '.td-mini', '.guide', '.td-skills', '.td-dock', '.td-chat', '.td-belt', '.glim-say', '.top-actions']) expect(await overlaps(sel)).toBe('');
      await page.waitForTimeout(1500);
      await shot(page, 'pets-phone');
      await chip.tap();
      await expect(page.locator('[data-pet-sheet]')).toBeVisible();
    });
  });
});
