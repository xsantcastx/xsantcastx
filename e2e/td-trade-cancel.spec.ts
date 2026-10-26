/**
 * td-trade-cancel.spec.ts — a cancelled trade closes on both screens (owner 2026-10-26: "when one Keeper cancels, the
 * other Keeper's trade window stays open"). Its own Hearth room, so no Keeper of another spec stands at the spawn.
 * Helpers as td-trade.spec.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

test.use({ actionTimeout: 10000 });

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

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

// Owner 2026-10-26: "when one Keeper cancels, the other Keeper's trade window stays open".
test('one Keeper cancels: the other\'s trade window closes too, saying who cancelled', async ({ page, browser }, info) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterAs(page, hearth.port, 'Cora', 'ashguard', keeper('uc', [rec('c1', 'Cinder Band', 'keepers-cowl', 'rare', { magicFind: 2 })], 100));
  const other = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const dane = await other.newPage();
  await enterAs(dane, hearth.port, 'Dane', 'warlock', keeper('ud', [], 40));
  const c = await card(page, 'Dane');
  await c.locator('[data-peer-trade]').click();
  await expect(dane.locator('[data-trade-ask]')).toBeVisible({ timeout: 10000 });
  await dane.locator('[data-trade-ask-yes]').click();
  await expect(page.locator('[data-trade-window]')).toBeVisible({ timeout: 10000 });
  await expect(dane.locator('[data-trade-window]')).toBeVisible({ timeout: 10000 });
  // An offer on the table, then Cora cancels.
  await page.locator('[data-trade-bag="c1"]').click();
  await expect(dane.locator('[data-trade-theirs="c1"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-trade-cancel]').click();
  await expect(page.locator('[data-trade-window]')).toHaveCount(0, { timeout: 5000 });
  // Dane's window closes on its own, and Dane is told who cancelled.
  await expect(dane.locator('[data-trade-window]')).toHaveCount(0, { timeout: 5000 });
  await expect(dane.getByText('Cora cancelled the trade.').first()).toBeVisible({ timeout: 5000 });
  // Nothing moved.
  await expect.poll(() => save(page), { timeout: 5000 }).toEqual({ names: ['Cinder Band'], gold: 100 });
  await expect.poll(() => save(dane), { timeout: 5000 }).toEqual({ names: [], gold: 40 });
  await other.close();
});
