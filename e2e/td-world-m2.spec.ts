/**
 * td-world-m2.spec.ts — M2 of the room-run world (Hearth protocol 8; docs/design/online.md §4d).
 *
 * Two browsers (Aster and Bryn, signed in through the local room's fake tokens) against a private Hearth room run with
 * SOCIAL_FAKE_AUTH=1 and SOCIAL_FAKE_TRADE=1: the room settles trades and lays drops with the REAL trade core over the
 * in-memory "Firestore" it shares with the fake Function (scripts/trade-fake.mjs).
 *
 *  1. A party: Aster invites Bryn from the card; Bryn accepts.
 *  2. A drop: Aster drops the Ember Charm from the satchel; it is on Bryn's ground at once (measured), Bryn walks to it
 *     and picks it up; it lands in Bryn's save and leaves Aster's.
 *  3. A trade: Aster offers the Ash Blade and 50 Gold for Bryn's Tide Ring; both Accept, both Confirm; the window says
 *     done at once (measured) and both saves change.
 *  4. A relog: Aster closes the game — Bryn's frames show Aster greyed (offline, still in the party); Aster opens the
 *     game again and is back in the party with no invite.
 *
 * The measured numbers are printed (`# m2 …`); screenshots go to output/m2/ (not committed).
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

test.use({ actionTimeout: 10000 });

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

const SHOTS = 'output/m2';
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
const calm = async (page: Page) => {
  await page.waitForTimeout(300);
  if (await page.locator('.td-talk').count()) await page.keyboard.press('Escape');
  if (await page.locator('.menu-scrim').count()) await page.locator('.menu-scrim').click({ position: { x: 4, y: 4 } });
};
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
  await page.waitForTimeout(400);
  if (await page.locator('.td-talk').count()) await page.keyboard.press('Escape');
  await expect(c.locator('h2')).toHaveText(name, { timeout: 2000 });
  return c;
}
/** The save as this browser holds it: live item names (the starter tools left out) and the purse. */
const save = (page: Page) => page.evaluate(() => {
  const inv = JSON.parse(localStorage.getItem('godforge-inventory') ?? '{}');
  const tomb = new Map((inv.tombstones ?? []).map((t: { id: string; revision: { hlc: number } }) => [t.id, t.revision.hlc]));
  const names = (inv.records ?? []).filter((r: { id: string; kind: string; revision: { hlc: number } }) => r.kind === 'instance' && !r.id.startsWith('starter-') && !((tomb.get(r.id) as number ?? -1) >= r.revision.hlc)).map((r: { name: string }) => r.name).sort();
  const eco = JSON.parse(localStorage.getItem('godforge-economy') ?? '{}');
  return { names, gold: Math.floor(eco.gold ?? 0) };
});
/** Note (in the page, by the wall clock both browsers share) when an attribute of the canvas first matches. */
const watch = (page: Page, attr: string, pattern: string) => page.evaluate(([a, p]) => {
  const el = document.querySelector('.viewport canvas')!;
  const w = window as unknown as Record<string, number>;
  delete w['__m2seen'];
  const check = () => { if (!w['__m2seen'] && new RegExp(p).test(el.getAttribute(a) ?? '')) w['__m2seen'] = Date.now(); };
  new MutationObserver(check).observe(el, { attributes: true, attributeFilter: [a] });
  const tick = () => { check(); if (!w['__m2seen']) requestAnimationFrame(tick); };
  tick();
}, [attr, pattern] as const);
const seenAt = (page: Page) => page.evaluate(() => (window as unknown as Record<string, number>)['__m2seen'] ?? 0);

test('M2: a party, an instant drop picked up by the other, a fast trade, and a relog that keeps the party', async ({ page, browser }, info) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterAs(page, hearth.port, 'Aster', 'ashguard', keeper('ua', [
    rec('s1', 'Ash Blade', 'astral-helm', 'rare', { magicFind: 2 }),
    rec('s2', 'Ember Charm', 'keepers-cowl', 'uncommon', { magicFind: 1 }),
  ], 300));
  const other = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const bryn = await other.newPage();
  await enterAs(bryn, hearth.port, 'Bryn', 'thornstrider', keeper('ub', [rec('r1', 'Tide Ring', 'keepers-cowl', 'epic', { magicFind: 3 })], 20));
  const health = await (await fetch(`http://127.0.0.1:${hearth.port}/health`)).json() as { protocol: number };
  expect(health.protocol).toBe(8);

  // ── 1. A party ──
  const c = await card(page, 'Bryn');
  await c.locator('[data-peer-invite]').click();
  await c.locator('.td-peer__x').click();
  await expect(bryn.locator('[data-party-invite]')).toBeVisible({ timeout: 10000 });
  await bryn.locator('[data-invite-accept]').click();
  await expect(page.locator('[data-party-frame][data-member="Bryn"]')).toBeVisible({ timeout: 10000 });
  await expect(bryn.locator('[data-party-frame][data-member="Aster"]')).toBeVisible({ timeout: 10000 });

  // ── 2. A drop, on the other's ground at once ──
  await calm(page);
  await page.getByRole('button', { name: /^Satchel/ }).first().click();
  await page.locator('#satchel-book .pocket[aria-label^="Ember Charm"]').click();
  await watch(bryn, 'data-ground', '^g');
  const dropBtn = page.locator('[data-drop-item]').first();
  await expect(dropBtn).toBeVisible();
  const dropAt = await dropBtn.evaluate(b => { const t = Date.now(); (b as HTMLButtonElement).click(); return t; });
  await expect.poll(() => seenAt(bryn), { timeout: 10000 }).toBeGreaterThan(0);
  const dropSeen = (await seenAt(bryn)) - dropAt;
  console.log(`# m2 drop: on the other Keeper's ground ${dropSeen} ms after the Drop click (local room)`);
  expect(dropSeen).toBeLessThan(1500);
  await shot(bryn, 'drop-seen');
  // The dropper's satchel lets go at once — not when the escrow lands (owner hotfix 2026-10-22).
  await expect(page.locator('#satchel-book .pocket[aria-label^="Ember Charm"]'), 'the dropped charm left the satchel').toHaveCount(0, { timeout: 1000 });
  // The escrow lands behind it: the charm leaves Aster's save.
  await expect.poll(() => save(page), { timeout: 15000 }).toEqual({ names: ['Ash Blade'], gold: 300 });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  // Bryn walks to it and picks it up.
  const at = /@(-?\d+),(-?\d+)/.exec((await canvas(bryn).getAttribute('data-ground-at')) ?? '');
  expect(at).not.toBeNull();
  await bryn.mouse.click(Number(at![1]), Number(at![2]));
  await expect.poll(() => save(bryn), { timeout: 20000 }).toEqual({ names: ['Ember Charm', 'Tide Ring'], gold: 20 });
  await expect.poll(async () => (await canvas(page).getAttribute('data-ground')) ?? '', { timeout: 15000 }).toBe('');
  await shot(bryn, 'picked');

  // ── 3. A trade, done the moment both confirm ──
  await calm(page); await calm(bryn);
  const c2 = await card(page, 'Bryn');
  await c2.locator('[data-peer-trade]').click();
  await expect(bryn.locator('[data-trade-ask]')).toBeVisible({ timeout: 10000 });
  await bryn.locator('[data-trade-ask-yes]').click();
  await expect(page.locator('[data-trade-window]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-trade-bag="s1"]').click();
  await page.locator('[data-trade-gold]').fill('50');
  await expect(bryn.locator('[data-trade-theirs="s1"]')).toBeVisible({ timeout: 10000 });
  await expect(bryn.locator('[data-trade-their-gold]')).toContainText('50', { timeout: 10000 });
  await bryn.locator('[data-trade-bag="r1"]').click();
  await expect(page.locator('[data-trade-theirs="r1"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-trade-accept]').click();
  await bryn.locator('[data-trade-accept]').click();
  await expect(page.locator('[data-trade-confirm]')).toBeVisible({ timeout: 10000 });
  await expect(bryn.locator('[data-trade-confirm]')).toBeVisible();
  await page.locator('[data-trade-confirm]').click();
  await expect(page.locator('[data-trade-window]')).toHaveAttribute('data-trade-stage', 'waiting', { timeout: 10000 });
  const doneAt = (p: Page) => p.evaluate(() => new Promise<number>(res => {
    const el = document.querySelector('[data-trade-window]')!;
    const check = () => { if (el.getAttribute('data-trade-stage') === 'done') { res(Date.now()); return true; } return false; };
    if (check()) return;
    new MutationObserver(() => { check(); }).observe(el, { attributes: true, attributeFilter: ['data-trade-stage'] });
  }));
  const [aDone, bDone] = [doneAt(page), doneAt(bryn)];
  const confirmAt = await bryn.locator('[data-trade-confirm]').evaluate(b => { const t = Date.now(); (b as HTMLButtonElement).click(); return t; });
  const [ta, tb] = await Promise.all([aDone, bDone]);
  console.log(`# m2 trade: done on the confirmer's screen ${tb - confirmAt} ms and on the other's ${ta - confirmAt} ms after the second Confirm (local room)`);
  expect(Math.max(ta, tb) - confirmAt).toBeLessThan(2000);
  await shot(page, 'trade-done');
  await expect.poll(() => save(page), { timeout: 10000 }).toEqual({ names: ['Tide Ring'], gold: 250 });
  await expect.poll(() => save(bryn), { timeout: 10000 }).toEqual({ names: ['Ash Blade', 'Ember Charm'], gold: 70 });
  await page.locator('[data-trade-close]').click();
  await bryn.locator('[data-trade-close]').click();

  // ── 4. A relog keeps the party ──
  const ctx = page.context();
  await page.close();
  const away = bryn.locator('[data-party-frame][data-member="Aster"][data-party-offline]');
  await expect(away).toBeVisible({ timeout: 15000 });
  await shot(bryn, 'party-offline');
  const again = await ctx.newPage();
  await again.setViewportSize({ width: 1280, height: 800 });
  await again.emulateMedia({ reducedMotion: 'reduce' });
  await again.goto('/play?td=1&hour=12');
  await expect(again.locator('.td-chat')).toHaveAttribute('data-chat-connected', 'true', { timeout: 30000 });
  // Back in the party with no invite: Aster's frames show Bryn; Bryn's show Aster online again.
  await expect(again.locator('[data-party-frame][data-member="Bryn"]')).toBeVisible({ timeout: 15000 });
  await expect(bryn.locator('[data-party-frame][data-member="Aster"]:not([data-party-offline])')).toBeVisible({ timeout: 15000 });
  await shot(again, 'party-back');
  await other.close();
});
