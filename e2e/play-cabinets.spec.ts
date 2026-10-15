/**
 * play-cabinets.spec.ts — the Lost Cabinets, played (docs/handoff/lost-cabinets.md).
 *
 * A Keeper carrying a Mirror Slate (tier I) in the Basalt Seamworks: open the
 * Slate, its Scan face, hold the glass up (the Slate folds away); walk east and
 * it cools, back west it warms band by band (warm → hot → burning) until the
 * Lost Cabinet shows itself up in the Material Vendor's loft (One World: the
 * Seamworks' street; climb the shop's ladder); E opens it once (a curio, Gold, the receipt saved); the
 * Codex's Cabinet of Curios lists it; a reload keeps it open and empty, and
 * nothing is paid twice. At 1280×800 and 390×844 (44 px targets).
 */
import { expect, test, type Page } from '@playwright/test';
import { bag, blob, canvas, focusWorld, messageLine, openPlay, placePanel, seed, settleBetween, stackQty, walk, walkTo, travelToTown } from './play-helpers';

/** One World: the Seamworks cabinet stands in the Material Vendor's loft (col 23, its floor 4 rows over the street). */
const LADDER_X = 29 * 32 + 16;
const HIGH = { x: 760, y: 610 - 4 * 32 };
const SEEDED = {
  'preferred-language': 'en',
  ...bag({ 'mirror-slate': 1 }),
};

const shot = (page: Page, name: string) => page.screenshot({ path: `output/lost-cabinets/${name}.png` });

async function gold(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('godforge-economy') || '{}');
    return Number((raw && 'v' in raw ? raw.v : raw)?.gold ?? 0);
  });
}
async function opened(page: Page): Promise<string[]> {
  const raw = await blob<{ v?: { opened?: string[] }; opened?: string[] }>(page, 'godforge-cabinets');
  return raw?.v?.opened ?? raw?.opened ?? [];
}
async function atLeast44(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, selector).not.toBeNull();
  expect(box!.width, `${selector} width`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(44);
}
async function playerY(page: Page): Promise<number> {
  return Number(await canvas(page).getAttribute('data-player-y'));
}
/** Up the Material Vendor's ladder (Up holds the climb to its top) and west across the loft's floorboards to the cabinet. */
async function climbToLedge(page: Page): Promise<void> {
  if (await playerY(page) === HIGH.y) { await walkTo(page, HIGH.x, 30); return; }
  await walkTo(page, LADDER_X, 10);
  await settleBetween(page, LADDER_X - 12, LADDER_X + 12);
  await focusWorld(page);
  await page.keyboard.down('KeyW');
  try { await expect.poll(() => playerY(page), { timeout: 6000, intervals: [50] }).toBeLessThan(HIGH.y); }
  finally { await page.keyboard.up('KeyW'); }
  await walk(page, 'a', HIGH.x + 10);
  await page.waitForTimeout(300);
  await walkTo(page, HIGH.x, 12);
  await expect.poll(() => playerY(page), { timeout: 4000 }).toBe(HIGH.y);
}
async function interact(page: Page, phone: boolean): Promise<void> {
  const button = page.locator('.prompt.armed > button').first();
  await expect(button).toBeEnabled();
  if (phone) await button.click(); else { await focusWorld(page); await page.keyboard.press('KeyE'); }
}

for (const size of [{ tag: '1280x800', width: 1280, height: 800, phone: false }, { tag: '390x844', width: 390, height: 844, phone: true }]) {
  test(`${size.tag}: the Slate's Scan → follow the warmth → open a Lost Cabinet → the Codex lists it → a reload keeps it`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await seed(page, SEEDED);
    await openPlay(page);
    const world = canvas(page);

    // ── The Slate's Scan face, one tap from its home face. ──
    const slate = page.locator('.slate-btn');
    await expect(slate).toBeVisible();
    // Phones: every target 44 px (desktop keeps its slimmer top bar).
    if (size.phone) await atLeast44(page, '.slate-btn');
    await slate.click();
    const tile = page.locator('.sl-tile[data-face="scan"]');
    await expect(tile).toBeVisible();
    await atLeast44(page, '.sl-tile[data-face="scan"]');
    // The phone face's app icon is just "Scan"; the count lives on the Scan face (docs/handoff/world-clock.md).
    await expect(tile).toContainText('Scan');
    await tile.click();
    await expect(page.locator('.sl-scan')).toBeVisible();
    await expect(page.locator('.sl-scan')).toContainText('0 of 16');
    await shot(page, `${size.tag}-1-scan-face`);
    await atLeast44(page, '[data-scan-hold]');
    await page.locator('[data-scan-hold]').click();

    // ── Holding the glass up folds the Slate; the HUD button is the reading now. ──
    await expect(placePanel(page)).toBeHidden({ timeout: 5000 });
    await expect(slate).toHaveClass(/slate-btn--scan/);
    await expect(world).toHaveAttribute('data-scan', 'warm', { timeout: 5000 });
    await expect(page.locator('.objective')).toContainText('glass');

    // ── Hot and cold: east it cools, back west it heats; up in the Vendor's loft the cabinet shows. ──
    await walk(page, 'd', 2000);
    await expect(world).toHaveAttribute('data-scan', 'cool', { timeout: 5000 });
    await walk(page, 'a', 1150);
    await expect(world).toHaveAttribute('data-scan', 'hot', { timeout: 5000 });
    await shot(page, `${size.tag}-2-hot`);
    await climbToLedge(page);
    await expect(world).toHaveAttribute('data-scan', 'burning', { timeout: 5000 });
    await expect(world).toHaveAttribute('data-cabinet', 'cab-seamworks:shut', { timeout: 5000 });
    await expect(page.locator('.prompt.armed strong')).toContainText('Open the Lost Cabinet');
    await shot(page, `${size.tag}-3-shown`);

    // ── Open it: the curio, Gold, the receipt. ──
    const before = await gold(page);
    await interact(page, size.phone);
    await expect(world).toHaveAttribute('data-cabinet', 'cab-seamworks:open', { timeout: 5000 });
    await expect(messageLine(page)).toContainText('The Unstruck Bell', { timeout: 5000 });
    await expect.poll(() => stackQty(page, 'curio-unstruck-bell'), { timeout: 5000 }).toBe(1);
    await expect.poll(() => opened(page), { timeout: 5000 }).toEqual(['cab-seamworks']);
    await expect.poll(() => gold(page), { timeout: 5000 }).toBeGreaterThan(before);
    // One World: the glass turns to the next cabinet it can hear in the Ember world (the forge-mines, deep under the street).
    await expect(world).toHaveAttribute('data-scan', /cold|cool/, { timeout: 5000 });
    await shot(page, `${size.tag}-4-opened`);

    // ── The Codex's Cabinet of Curios lists it, with its lore and where. ──
    // The Codex stands in the world (game-only shell): open it there, on its Collection tab.
    await openPlay(page, '?at=codex');
    await expect(placePanel(page)).toBeVisible({ timeout: 15000 });
    await placePanel(page).getByRole('button', { name: 'Collection', exact: true }).click();
    const block = page.locator('[data-codex="cabinets"]');
    // The block is deferred on viewport, under the long Collection Log: walk the deferred blocks into view, one by one.
    await page.locator('[data-codex="glim"]').scrollIntoViewIfNeeded({ timeout: 20000 });
    for (let i = 0; i < 80 && !(await block.count()); i++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(250);
    }
    await block.scrollIntoViewIfNeeded({ timeout: 20000 });
    const row = block.locator('[data-codex-cabinet="cab-seamworks"]');
    await expect(row).toHaveAttribute('data-open', 'true');
    await expect(row).toContainText('The Unstruck Bell');
    await expect(row).toContainText('the Basalt Seamworks');
    await expect(block).toContainText('1 of 16 open');
    await expect(block.locator('[data-codex-cabinet="cab-ink-deeps"]')).toContainText('open the cabinet that holds its clue first');
    await row.scrollIntoViewIfNeeded();
    await shot(page, `${size.tag}-5-codex`);

    // ── A reload keeps it: open and empty, nothing paid twice. ──
    const paid = await gold(page);
    // Reading the Codex took the Keeper to its station in Meridian Orrery: the Waystone road home.
    await openPlay(page, '?at=waystone');
    await travelToTown(page, 'Infernal');
    await expect(canvas(page)).toHaveAttribute('data-area', 'Basalt Seamworks', { timeout: 10000 });
    await expect(placePanel(page)).toBeHidden();
    await openPlay(page);
    await climbToLedge(page);
    await expect(world).toHaveAttribute('data-cabinet', 'cab-seamworks:open', { timeout: 5000 });
    await interact(page, size.phone);
    await expect(messageLine(page)).toContainText('open and empty');
    expect(await stackQty(page, 'curio-unstruck-bell')).toBe(1);
    expect(await opened(page)).toEqual(['cab-seamworks']);
    expect(await gold(page)).toBeLessThanOrEqual(paid + 50);
  });
}
