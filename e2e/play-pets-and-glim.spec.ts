/**
 * play-pets-and-glim.spec.ts — pets that do something, and a Glim you can talk to
 * (docs/handoff/pets-and-glim-alive.md).
 *
 * In Ember Quarry, at 1280×800 and 390×844:
 *   1. an Ink Pup (combat) closes on a Maw beside the Keeper and bites it
 *      (data-pet-hits > 0) — the Keeper never swings;
 *   2. the pet card tells it to Stay: the Keeper walks off, the pup keeps its spot;
 *      a reload keeps the command;
 *   3. a Moss Hedgehog (skilling) works the Starlight tuft beside the Keeper
 *      (data-pet-gathers > 0) and the herb lands in the satchel;
 *   4. tap Glim → its chat card (choices ≥ 44 px) → "Show me the nearest find" →
 *      a trail of light runs to it (data-glim-trail); Quiet Glim survives a reload.
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, canvas, ERA, focusWorld, loginAt, openPlay, playerX, seed, stackQty, walk, walkTo, WORLD_COL } from './play-helpers';

const BEACON_LIT = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };
const GLIM_MET = {
  version: 1, met: true, metAt: '2026-10-14T00:00:00.000Z', ladder: {},
  said: { meet: 1, homestead: 1, 'pet.ink-pup': 1, 'pet.moss-hedgehog': 1 }, lastAt: { meet: 1, homestead: 1 },
  // Mapmates (stage 2): "Show me the nearest find" is open.
  moments: ['area:infernal', 'area:verdant', 'talk:who', 'depth:0'], answers: {}, peak: 2, seenAt: Date.now(),
};
const pet = (id: string, name: string) => ({
  got: 1, hatched: 1, name, nameAt: 1, love: 4, feedDay: '', feeds: 0, hat: false, hatAt: 0, xp: 0, findDay: '', scouts: 0, trinkets: 0,
});
const withPet = (id: string, name: string) => ({
  'preferred-language': 'en',
  ...BEACON_LIT,
  // One World: the Ember Quarry is a region east of the Quarry Gate; the Keeper logs in there (the resume point).
  ...loginAt(WORLD_COL.quarry - 3),
  'godforge-glim': GLIM_MET,
  'godforge-pets': { version: 1, pets: { [id]: pet(id, name) }, active: id, activeAt: 1, tally: {}, command: 'follow', commandAt: 0 },
});

const shot = (page: Page, name: string) => page.screenshot({ path: `output/pets-and-glim-alive/${name}.png` });

async function toQuarry(page: Page): Promise<void> {
  await openPlay(page);
  await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Quarry', { timeout: 20000 });
  await page.waitForTimeout(500);
  await focusWorld(page);
}

async function petCard(page: Page) {
  await page.locator('.satchel .clasp').click();
  await page.locator('.book .pet-well').click();
  const sheet = page.locator('[data-pet-sheet]');
  await expect(sheet).toBeVisible();
  return sheet;
}
async function closeCard(page: Page) {
  await page.locator('[data-pet-sheet]').getByRole('button', { name: 'Close' }).click();
  await page.locator('#satchel-book .book-close:not(.place-close)').click();
  await focusWorld(page);
}

for (const size of [{ tag: '1280x800', width: 1280, height: 800 }, { tag: '390x844', width: 390, height: 844 }, { tag: '844x390', width: 844, height: 390 }]) {
  test.describe(size.tag, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: size.width, height: size.height }); });

    test('a combat pet bites a foe; Stay keeps it put, through a reload', async ({ page }) => {
      test.setTimeout(150000);
      await seed(page, withPet('ink-pup', 'Inky'));
      await toQuarry(page);
      const world = canvas(page);
      await expect(world).toHaveAttribute('data-pet', 'ink-pup', { timeout: 10000 });
      await expect(world).toHaveAttribute('data-pet-command', 'follow');
      // Out where the Maws are; the Keeper only waits.
      await walkTo(page, WORLD_COL.quarryMaws * 32, 60);
      await expect.poll(async () => Number(await world.getAttribute('data-pet-hits') ?? 0), { timeout: 30000 }).toBeGreaterThan(0);
      await shot(page, `${size.tag}-1-pup-bites`);

      // ── Stay: the card's command; the Keeper walks away, the pup does not follow. ──
      const sheet = await petCard(page);
      await expect(sheet.locator('[data-pet-role="combat"]')).toBeVisible();
      const stay = sheet.locator('[data-pet-cmd="stay"]');
      expect((await stay.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await stay.click();
      await expect(stay).toHaveAttribute('aria-pressed', 'true');
      await shot(page, `${size.tag}-2-card-stay`);
      await closeCard(page);
      await expect(world).toHaveAttribute('data-pet-act', 'stay', { timeout: 5000 });
      const spot = Number(await world.getAttribute('data-pet-x'));
      await walk(page, 'a', (await playerX(page)) - 360);
      await page.waitForTimeout(800);
      expect(Math.abs(Number(await world.getAttribute('data-pet-x')) - spot)).toBeLessThan(12);
      expect(Math.abs(Number(await world.getAttribute('data-pet-x')) - await playerX(page))).toBeGreaterThan(200);
      // The command is saved: a reload keeps it.
      expect((await blob<{ command: string }>(page, 'godforge-pets'))?.command).toBe('stay');
      await openPlay(page);
      await expect(world).toHaveAttribute('data-pet-command', 'stay', { timeout: 10000 });
    });

    test('a skilling pet gathers beside the Keeper', async ({ page }) => {
      test.setTimeout(120000);
      await seed(page, withPet('moss-hedgehog', 'Mossy'));
      await toQuarry(page);
      const world = canvas(page);
      await expect(world).toHaveAttribute('data-pet', 'moss-hedgehog', { timeout: 10000 });
      // A fresh satchel holds no Starlight Herb. Stand by the tuft (col 166); the hedgehog works it
      // (it may already have, from the arrival beside it: the tuft is within its reach).
      // West of it: the Quarry's next node (the scorched trunk) stands three columns east.
      await walkTo(page, 166 * 32 + 16 - 64, 24);
      await expect.poll(async () => Number(await world.getAttribute('data-pet-gathers') ?? 0), { timeout: 30000 }).toBeGreaterThan(0);
      await expect.poll(() => stackQty(page, 'starlight-herb'), { timeout: 10000 }).toBeGreaterThan(0);
      await shot(page, `${size.tag}-3-hedgehog-gathers`);
    });

    test('tap Glim: chat, the nearest find with a trail, Quiet Glim through a reload', async ({ page }) => {
      test.setTimeout(120000);
      await seed(page, withPet('moss-hedgehog', 'Mossy'));
      await toQuarry(page);
      const tap = page.locator('[data-glim-tap]');
      await expect(tap).toBeVisible({ timeout: 10000 });
      const box = (await tap.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      // A fixed HUD slot, not a hit target floating over the world: it overlaps no other HUD widget,
      // sits outside the world's centre, and what it covers is the button itself (a hit test at its middle).
      const clash = await page.evaluate(() => {
        const mine = document.querySelector('[data-glim-tap]')!.getBoundingClientRect();
        const others = ['.topbar .title-block', '.topbar .top-actions button', '.topbar .objective-line', '.guide', '.vitals', '.satchel', '.hotbar', '.dock', '.touch button', '.hearth']
          .flatMap(q => [...document.querySelectorAll(q)] as HTMLElement[])
          .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
        return others.filter(e => {
          const r = e.getBoundingClientRect();
          return r.left < mine.right && r.right > mine.left && r.top < mine.bottom && r.bottom > mine.top;
        }).map(e => e.className || e.tagName);
      });
      expect(clash).toEqual([]);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      await tap.click();
      const chat = page.locator('[data-glim-chat]');
      await expect(chat).toBeVisible();
      for (const topic of ['around', 'find', 'tips', 'story', 'play']) {
        const b = chat.locator(`[data-glim-ask="${topic}"]`);
        await expect(b).toBeVisible();
        expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await chat.locator('[data-glim-ask="around"]').click();
      await expect(chat.locator('[data-glim-reply]')).toContainText(/steps|Nothing new/);
      await shot(page, `${size.tag}-4-glim-chat`);
      await chat.locator('[data-glim-ask="find"]').click();
      // Follow the light: the card steps aside and a trail runs to the find.
      await expect(chat).toBeHidden();
      await expect(page.locator('.viewport')).toHaveAttribute('data-glim-trail', /\d+/, { timeout: 5000 });
      await page.waitForTimeout(700);
      await shot(page, `${size.tag}-5-glim-trail`);

      // ── Quiet Glim: saved; after a reload the switch still says so. ──
      await tap.click();
      await chat.locator('[data-glim-quiet]').click();
      await expect(chat.locator('[data-glim-quiet]')).toHaveAttribute('aria-pressed', 'true');
      await openPlay(page);
      await expect(tap).toBeVisible({ timeout: 10000 });
      await tap.click();
      await expect(page.locator('[data-glim-chat] [data-glim-quiet]')).toHaveAttribute('aria-pressed', 'true');
      const glim = await blob<{ lastAt: Record<string, number> }>(page, 'godforge-glim');
      expect((glim?.lastAt['quiet.on'] ?? 0) > (glim?.lastAt['quiet.off'] ?? 0)).toBe(true);
    });
  });
}
