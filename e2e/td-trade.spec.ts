/**
 * td-trade.spec.ts — trading and shared ground drops (docs/design/online.md §3.8, §4c; Hearth protocol 6).
 *
 * Two browsers (Aster on a desktop, Bryn on a phone) against a private Hearth room run with SOCIAL_FAKE_AUTH=1 and
 * SOCIAL_FAKE_TRADE=1: tokens `fake.<uid>` sign them in, and the room mounts scripts/trade-fake.mjs — the REAL
 * functions-game/src/trade-core.ts over an in-memory "Firestore" — as the trade Function. The client plays the gateway's
 * part against it (trade-backend.service.ts): push the save before, read and merge it after.
 *
 * Aster asks Bryn to trade from Bryn's card; Bryn accepts from the toast; Aster offers the Ash Blade and 50 Gold, Bryn
 * the Tide Ring; both Accept, both Confirm; the items and the Gold change hands in both saves. Then Aster drops the
 * Ember Charm from the satchel; Bryn sees it on the ground with its plate, walks to it and picks it up.
 *
 * Screenshots: docs/handoff/cozy-ui/trade-{card,ask,window,window-phone,done,ground,picked}.jpg.
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

test.use({ actionTimeout: 10000 });

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

const SHOTS = 'docs/handoff/cozy-ui';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/trade-${name}.jpg`, type: 'jpeg', quality: 72 }); };
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

test('two Keepers trade items and Gold atomically, then one drops an item the other picks up', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterAs(page, hearth.port, 'Aster', 'ashguard', keeper('ua', [
    rec('s1', 'Ash Blade', 'astral-helm', 'rare', { magicFind: 2 }),
    rec('s2', 'Ember Charm', 'keepers-cowl', 'uncommon', { magicFind: 1 }),
  ], 300));
  const phone = await newContext(browser, info, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const bryn = await phone.newPage();
  await enterAs(bryn, hearth.port, 'Bryn', 'thornstrider', keeper('ub', [rec('r1', 'Tide Ring', 'keepers-cowl', 'epic', { magicFind: 3 })], 20));

  // Aster: Bryn's card → Trade.
  const c = await card(page, 'Bryn');
  await expect(c.locator('[data-peer-trade]')).toBeVisible();
  await shot(page, 'card');
  await c.locator('[data-peer-trade]').click();
  // Bryn: the toast → Trade.
  await expect(bryn.locator('[data-trade-ask]')).toBeVisible({ timeout: 10000 });
  await shot(bryn, 'ask');
  await bryn.locator('[data-trade-ask-yes]').tap();
  await expect(page.locator('[data-trade-window]')).toBeVisible({ timeout: 10000 });
  await expect(bryn.locator('[data-trade-window]')).toBeVisible();

  // Offers: Aster the blade and 50 Gold; Bryn the ring.
  await page.locator('[data-trade-bag="s1"]').click();
  await page.locator('[data-trade-gold]').fill('50');
  await expect(bryn.locator('[data-trade-theirs="s1"]')).toBeVisible({ timeout: 10000 });
  await expect(bryn.locator('[data-trade-their-gold]')).toContainText('50', { timeout: 10000 });
  await bryn.locator('[data-trade-bag="r1"]').tap();
  await bryn.locator('[data-trade-bag="r1"]').tap();
  await expect(page.locator('[data-trade-theirs="r1"]')).toBeVisible({ timeout: 10000 });
  // The real card on hover (Aster's mouse over Bryn's ring).
  await page.locator('[data-trade-theirs="r1"]').hover();
  await expect(page.locator('[data-trade-card]')).toContainText('Tide Ring');
  await shot(page, 'window');
  await page.mouse.move(5, 5);

  // Both Accept → both Confirm.
  await page.locator('[data-trade-accept]').click();
  await bryn.locator('[data-trade-accept]').tap();
  await expect(page.locator('[data-trade-confirm]')).toBeVisible({ timeout: 10000 });
  await expect(bryn.locator('[data-trade-confirm]')).toBeVisible();
  await shot(bryn, 'window-phone');
  await page.locator('[data-trade-confirm]').click();
  await expect(page.locator('[data-trade-window]')).toHaveAttribute('data-trade-stage', 'waiting', { timeout: 10000 });
  await bryn.locator('[data-trade-confirm]').tap();
  await expect(bryn.locator('[data-trade-window]')).toHaveAttribute('data-trade-stage', 'done', { timeout: 15000 });
  await expect(page.locator('[data-trade-window]')).toHaveAttribute('data-trade-stage', 'done', { timeout: 15000 });
  await shot(page, 'done');
  await expect.poll(() => save(page), { timeout: 10000 }).toEqual({ names: ['Ember Charm', 'Tide Ring'], gold: 250 });
  await expect.poll(() => save(bryn), { timeout: 10000 }).toEqual({ names: ['Ash Blade'], gold: 70 });
  await page.locator('[data-trade-close]').click();
  await bryn.locator('[data-trade-close]').tap();

  // Aster drops the Ember Charm: satchel → its card → Drop.
  // A missed tap earlier can have walked Aster into a task giver's talk: put it away first.
  if (await page.locator('.td-talk').count()) await page.keyboard.press('Escape');
  await calm(page);
  await page.getByRole('button', { name: /^Satchel/ }).first().click();
  const charm = page.locator('#satchel-book .pocket[aria-label^="Ember Charm"]');
  await charm.click();
  await page.locator('[data-drop-item]').first().click();
  await expect.poll(() => save(page), { timeout: 10000 }).toEqual({ names: ['Tide Ring'], gold: 250 });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  // Everyone in the area sees it (Bryn too), with its plate.
  await expect.poll(async () => (await canvas(bryn).getAttribute('data-ground')) ?? '', { timeout: 15000 }).toMatch(/^g/);
  await expect.poll(async () => (await canvas(page).getAttribute('data-ground')) ?? '', { timeout: 15000 }).toMatch(/^g/);
  await shot(page, 'ground');
  // Bryn walks to it and picks it up.
  const at = /@(-?\d+),(-?\d+)/.exec((await canvas(bryn).getAttribute('data-ground-at')) ?? '');
  expect(at).not.toBeNull();
  await bryn.mouse.click(Number(at![1]), Number(at![2]));
  await expect.poll(() => save(bryn), { timeout: 20000 }).toEqual({ names: ['Ash Blade', 'Ember Charm'], gold: 70 });
  await expect.poll(async () => (await canvas(page).getAttribute('data-ground')) ?? '', { timeout: 15000 }).toBe('');
  await expect.poll(async () => (await canvas(bryn).getAttribute('data-ground')) ?? '', { timeout: 15000 }).toBe('');
  await shot(bryn, 'picked');
  await phone.close();
});

