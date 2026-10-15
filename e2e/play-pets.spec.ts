/**
 * play-pets.spec.ts — a pet, played (docs/handoff/pets.md).
 *
 * A seeded save on its third day of the Board Herald's bounties (Glim met,
 * three Starlight Herbs in the satchel). Opening the world files the Star
 * Owlet's egg (the Herald's gift); the Satchel's pet well opens the pets; the
 * egg hatches, gets a name and a meal; the owlet follows the Keeper in town,
 * keeps up when the Keeper walks, and in the Delve does its job (ore within a
 * few cells marked for the map). A reload keeps it all.
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, canvas, openPlay, playerX, seed, walk, bag } from './play-helpers';

interface Pets { pets: Record<string, { hatched: number; name: string; love: number }>; active: string }

const SEEDED = {
  'preferred-language': 'en',
  'godforge-glim': {
    version: 1, met: true, metAt: '2026-10-14T00:00:00.000Z', ladder: {},
    said: { meet: 1, homestead: 1 }, lastAt: { meet: 1, homestead: 1 },
    moments: ['area:infernal', 'talk:who', 'depth:0'], answers: {}, peak: 1, seenAt: Date.now(),
  },
  // Three days of bounties claimed: the Herald hands over the owlet's egg (pets.model.ts).
  'godforge-bounties': { version: 1, board: null, progress: {}, claimed: [], kit: ['compass'], days: 3, lastDay: '', claimDays: 3, lastClaimDay: '', total: 3, deepest: 0 },
  ...bag({ 'starlight-herb': 3 }),
};

const shot = (page: Page, name: string) => page.screenshot({ path: `output/pets/${name}.png` });

async function openWell(page: Page) {
  await page.locator('.satchel .clasp').click();
  const well = page.locator('.book .pet-well');
  await expect(well).toBeVisible();
  const box = await well.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await well.click();
  const sheet = page.locator('[data-pet-sheet]');
  await expect(sheet).toBeVisible();
  return sheet;
}

for (const size of [{ tag: '1280x800', width: 1280, height: 800 }, { tag: '390x844', width: 390, height: 844 }]) {
  test(`${size.tag}: the Herald's egg → hatch → name → feed → it follows → in the Delve it scents ore → survives a reload`, async ({ page }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await seed(page, SEEDED);
    await openPlay(page);

    // ── The egg is found (the Herald's third day) and waits in the pet well. ──
    await expect.poll(async () => (await blob<Pets>(page, 'godforge-pets'))?.pets?.['star-owlet']?.hatched, { timeout: 10000 }).toBe(0);
    const sheet = await openWell(page);
    const egg = sheet.locator('[data-pet="star-owlet"][data-egg]');
    await expect(egg).toBeVisible();
    await expect(sheet.locator('[data-pet-card="star-owlet"]')).toContainText('Star Owlet egg');
    await shot(page, `${size.tag}-1-egg`);

    // ── Hatch, then name it (one primary action each, 44 px). ──
    const hatch = sheet.locator('[data-pet-hatch]');
    expect((await hatch.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await hatch.click();
    const input = sheet.locator('[data-pet-name-input]');
    await expect(input).toBeVisible();
    await input.fill('Hoot');
    await sheet.locator('[data-pet-name-save]').click();
    await expect(sheet.locator('[data-pet-name]')).toContainText('Hoot');

    // ── A meal of its favourite: the meter fills (+2), a herb is spent. ──
    await sheet.locator('[data-pet-feed]').click();
    await expect(sheet.locator('[data-pet-love]')).toHaveAttribute('data-pet-love', '2');
    await expect(sheet.locator('[data-pet-status]')).toContainText('Its favourite!');
    await sheet.evaluate(el => el.scrollTop = 0);
    await shot(page, `${size.tag}-2-named-fed`);
    const saved = await blob<Pets>(page, 'godforge-pets');
    expect(saved?.pets['star-owlet']).toEqual(expect.objectContaining({ name: 'Hoot', love: 2 }));
    expect(saved?.active).toBe('star-owlet');
    await sheet.getByRole('button', { name: 'Close' }).click();
    await page.locator('#satchel-book .book-close:not(.place-close)').click();

    // ── It follows: in the world, behind the Keeper, and keeps up on a walk. ──
    const world = canvas(page);
    await expect(world).toHaveAttribute('data-pet', 'star-owlet', { timeout: 5000 });
    const start = await playerX(page);
    await walk(page, 'd', start + 420);
    await expect.poll(async () => Math.abs(Number(await world.getAttribute('data-pet-x')) - await playerX(page)), { timeout: 6000 }).toBeLessThan(160);
    // Glim says something about the owlet, once.
    await expect(page.locator('.glim-say[data-glim-bond="pet.star-owlet"]')).toBeVisible({ timeout: 30000 });
    await shot(page, `${size.tag}-3-follows`);

    // ── A reload keeps it; in the Delve the owlet hoots at ore (the map marks it). ──
    await openPlay(page, '?at=delve');
    await page.keyboard.press('e');
    await expect(world).toHaveAttribute('data-area', 'Ember Delve', { timeout: 10000 });
    await expect(world).toHaveAttribute('data-pet', 'star-owlet', { timeout: 10000 });
    await expect.poll(async () => Number(await world.getAttribute('data-pet-scent') ?? 0), { timeout: 15000 }).toBeGreaterThan(0);
    await shot(page, `${size.tag}-4-delve-scent`);
    const again = await openWell(page);
    await expect(again.locator('[data-pet-name]')).toContainText('Hoot');
    await expect(again.locator('[data-pet-love]')).toHaveAttribute('data-pet-love', '2');
    // Glim's first word is never said twice.
    const glim = await blob<{ said: Record<string, number> }>(page, 'godforge-glim');
    expect(glim?.said['pet.star-owlet']).toBe(1);
  });
}

