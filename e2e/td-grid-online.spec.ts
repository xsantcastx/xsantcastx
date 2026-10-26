/**
 * td-grid-online.spec.ts — the satchel grid online (docs/design/inventory-grid.md §3): a satchel piece dragged onto the
 * world lies on the ground for everyone in the room, and one dragged onto the trade window is offered. A private
 * Hearth room with SOCIAL_FAKE_AUTH=1 and SOCIAL_FAKE_TRADE=1 (the real trade-core over an in-memory store), as
 * td-trade.spec.ts.
 */
import * as fs from 'fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

test.use({ actionTimeout: 10000 });

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

const SHOTS = 'docs/handoff/grid';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 72 }); };
const rec = (id: string, name: string, def: string, rarity: string, stats: Record<string, number>) => ({
  id, definitionId: def, kind: 'instance', category: 'equipment', tags: ['artifact'], rarity, soulbound: false,
  acquiredAt: '2026-10-20T00:00:00.000Z', revision: { hlc: 10, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
  name, type: 'artifact', stats, rollQuality: { magicFind: 0.5 }, itemLevel: 8, sellValue: 20, location: { kind: 'bag' },
});
const ledger = (records: unknown[]) => ({ version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 10, legacyBackup: null, era: 55 });
const purse = (gold: number) => ({ version: 3, goldEra: 1, gold, totalGoldEarned: gold, runGoldEarned: gold, ops: [], origin: null, hlc: 10, applied: {} });
const keeper = (uid: string, records: unknown[], gold: number) => ({
  'eclipse-hearth-fake-token': `fake.${uid}.keeper`, 'eclipse-trade-fake': '1', 'godforge-realm-era': '55',
  'godforge-inventory': ledger(records), 'godforge-economy': purse(gold),
});

const canvas = (page: Page) => page.locator('.viewport canvas');
const peerAt = async (page: Page, name: string) => {
  const m = new RegExp(`${name}@(-?\\d+),(-?\\d+)`).exec((await canvas(page).getAttribute('data-peers')) ?? '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};
const calm = async (page: Page) => { await page.waitForTimeout(400); if (await page.locator('.menu-scrim').count()) await page.locator('.menu-scrim').click({ position: { x: 4, y: 4 } }); };
async function card(page: Page, name: string) {
  const c = page.locator('[data-peer-card]');
  for (let i = 0; i < 5; i++) {
    await calm(page);
    await expect.poll(async () => (await canvas(page).getAttribute('data-peers')) ?? '', { timeout: 15000 }).toContain(`${name}@`);
    let at = await peerAt(page, name);
    for (let k = 0; k < 20; k++) { await page.waitForTimeout(150); const again = await peerAt(page, name); if (again && at && again.x === at.x && again.y === at.y) break; at = again; }
    await page.mouse.click(at!.x, at!.y + 6);
    try { await expect(c.locator('h2')).toHaveText(name, { timeout: 2000 }); break; } catch { /* missed */ }
  }
  await page.waitForTimeout(600);
  if (await page.locator('.td-talk').count()) await page.keyboard.press('Escape');
  await expect(c.locator('h2')).toHaveText(name, { timeout: 2000 });
  return c;
}
/** The save as this browser holds it: live item names (the free starter tools left out) and the purse. */
const save = (page: Page) => page.evaluate(() => {
  const inv = JSON.parse(localStorage.getItem('godforge-inventory') ?? '{}');
  const tomb = new Map((inv.tombstones ?? []).map((t: { id: string; revision: { hlc: number } }) => [t.id, t.revision.hlc]));
  const names = (inv.records ?? []).filter((r: { id: string; kind: string; revision: { hlc: number } }) => r.kind === 'instance' && !r.id.startsWith('starter-') && !((tomb.get(r.id) as number ?? -1) >= r.revision.hlc)).map((r: { name: string }) => r.name).sort();
  const eco = JSON.parse(localStorage.getItem('godforge-economy') ?? '{}');
  return { names, gold: Math.floor(eco.gold ?? 0) };
});


async function dragTo(page: Page, from: Locator, to: Locator, at?: { x: number; y: number }): Promise<void> {
  const a = (await from.boundingBox())!, b = (await to.boundingBox())!;
  await page.mouse.move(a.x + Math.min(10, a.width / 2), a.y + Math.min(10, a.height / 2));
  await page.mouse.down();
  await page.mouse.move(a.x + 24, a.y + 24, { steps: 4 });
  await page.mouse.move(at ? b.x + at.x : b.x + b.width / 2, at ? b.y + at.y : b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('drag a satchel piece onto the world: it lies on the ground for the room; onto the trade window: it is offered', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterAs(page, hearth.port, 'Aster', 'ashguard', keeper('ua', [
    rec('s1', 'Ash Blade', 'astral-helm', 'rare', { magicFind: 2 }),
    rec('s2', 'Ember Charm', 'keepers-cowl', 'uncommon', { magicFind: 1 }),
  ], 300));
  const other = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const bryn = await other.newPage();
  await enterAs(bryn, hearth.port, 'Bryn', 'thornstrider', keeper('ub', [rec('r1', 'Tide Ring', 'keepers-cowl', 'epic', { magicFind: 3 })], 20));

  // ── Drop: the Ember Charm from the grid onto the world (left of the satchel). ──
  await calm(page);
  await page.getByRole('button', { name: /^Satchel/ }).first().click();
  const book = page.locator('#satchel-book');
  const charm = book.locator('[data-grid="b"] [data-ids="s2"]');
  await expect(charm).toBeVisible();
  await dragTo(page, charm, canvas(page), { x: 160, y: 420 });
  await expect(book.locator('[data-grid="b"] [data-ids="s2"]'), 'the dropped charm left the grid').toHaveCount(0, { timeout: 2000 });
  await expect.poll(() => save(page), { timeout: 15000 }).toEqual({ names: ['Ash Blade'], gold: 300 });
  await expect.poll(async () => (await canvas(bryn).getAttribute('data-ground')) ?? '', { timeout: 15000 }).toMatch(/^g/);
  await shot(page, 'drop-1280');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

  // ── Trade: open it, then drag the Ash Blade from the satchel onto the window. ──
  const c = await card(page, 'Bryn');
  await c.locator('[data-peer-trade]').click();
  await expect(bryn.locator('[data-trade-ask]')).toBeVisible({ timeout: 10000 });
  await bryn.locator('[data-trade-ask-yes]').click();
  const win = page.locator('[data-trade-window]');
  await expect(win).toBeVisible({ timeout: 10000 });
  // The window lies over the satchel, and lists the satchel itself: drag the Ash Blade from it onto "You offer".
  await dragTo(page, win.locator('[data-trade-bag="s1"]'), win.locator('[data-trade-side="mine"]'));
  await expect(win.locator('[data-trade-mine="s1"]')).toBeVisible({ timeout: 10000 });
  await expect(bryn.locator('[data-trade-theirs="s1"]')).toBeVisible({ timeout: 10000 });
  await shot(page, 'trade-drag-1280');
  await page.locator('[data-trade-cancel]').click();
  await other.close();
});
