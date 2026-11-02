/**
 * td-trade-satchel.spec.ts — the trade window lists the WHOLE satchel, stacked as the satchel stacks it
 * (owner 2026-10-27: "when trading, it's not showing my inventory complete" and "all items are unstacked").
 *
 * The window used to read `snapshot.bag` — gear instances only, one cell each — so potions, cooked fish, runes and
 * materials (satchel stacks) were simply missing, and a pile of identical Spellstones showed as loose single pieces.
 * Now it reads the satchel grid: every piece, one entry per kind with ×N, a chosen amount offered (Split), and what
 * cannot be traded greyed with the reason.
 *
 * Two Keepers on a private Hearth room (SOCIAL_FAKE_AUTH, SOCIAL_FAKE_TRADE: the real trade-core over memory): Aster on
 * a desktop, Bryn on a phone (390×844). Aster offers 2 of 5 potions and all 30 Ironwood; Bryn a Tide Ring; both
 * Accept and Confirm; the stacks change hands in both saves.
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

test.use({ actionTimeout: 10000 });

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

const rec = (id: string, name: string, def: string, rarity: string, extra: Record<string, unknown> = {}) => ({
  id, definitionId: def, kind: 'instance', category: 'equipment', tags: ['artifact'], rarity, soulbound: false,
  acquiredAt: '2026-10-20T00:00:00.000Z', revision: { hlc: 10, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
  name, type: 'artifact', stats: { magicFind: 2 }, rollQuality: { magicFind: 0.5 }, itemLevel: 8, sellValue: 20, location: { kind: 'bag' }, ...extra,
});
const stone = (id: string) => rec(id, 'Spellstone', 'spellstone:hellfire-nova@1#0', 'rare', { category: 'artifacts', stats: {}, rollQuality: undefined, charges: 6, sellValue: 0 });
const stackRec = (key: string) => ({
  id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 9, deviceId: 'e2e', sequence: 1 }, source: 'inventory', stackKey: key, location: { kind: 'bag' },
});
const ledger = (records: unknown[], stacks: Record<string, number>) => {
  const keys = Object.keys(stacks);
  return {
    version: 2, records: [...records, ...keys.map(stackRec)], tombstones: [],
    stackOps: keys.map((k, i) => ({ id: `e2e-grant-${k}`, stackKey: k, kind: 'grant', quantity: stacks[k], hlc: 5 + i, deviceId: 'e2e', sequence: i + 1 })),
    goldFromSales: 0, sold: 0, hlc: 10, legacyBackup: null, era: 55,
  };
};
const purse = (gold: number) => ({ version: 3, goldEra: 1, gold, totalGoldEarned: gold, runGoldEarned: gold, ops: [], origin: null, hlc: 10, applied: {} });
const keeper = (uid: string, records: unknown[], stacks: Record<string, number>, gold: number) => ({
  'eclipse-hearth-fake-token': `fake.${uid}.keeper`, 'eclipse-trade-fake': '1', 'godforge-realm-era': '55',
  'godforge-inventory': ledger(records, stacks), 'godforge-economy': purse(gold),
});

/** Handoff screenshots only when asked (TRADE_SHOTS=before|after): docs/handoff/tradefix/<when>-<name>.jpg. */
const SHOTS = process.env['TRADE_SHOTS'];
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  fs.mkdirSync('docs/handoff/tradefix', { recursive: true });
  await page.screenshot({ path: `docs/handoff/tradefix/${SHOTS}-${name}.jpg`, type: 'jpeg', quality: 72 });
};
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
/** Stack totals and live instance names (starter tools left out) as this browser's save holds them. */
const save = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-inventory') ?? '{}');
  const inv = raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
  const tomb = new Map((inv.tombstones ?? []).map((t: { id: string; revision: { hlc: number } }) => [t.id, t.revision.hlc]));
  const names = (inv.records ?? []).filter((r: { id: string; kind: string; revision: { hlc: number } }) => r.kind === 'instance' && !r.id.startsWith('starter-') && !((tomb.get(r.id) as number ?? -1) >= r.revision.hlc)).map((r: { name: string }) => r.name).sort();
  const stacks: Record<string, number> = {};
  for (const f of inv.stackFolds ?? []) for (const [k, n] of Object.entries(f.net as Record<string, number>)) stacks[k] = (stacks[k] ?? 0) + n;
  for (const o of inv.stackOps ?? []) stacks[o.stackKey] = (stacks[o.stackKey] ?? 0) + (o.kind === 'grant' ? o.quantity : -o.quantity);
  return { names, potion: stacks['minor-health-potion'] ?? 0, ironwood: stacks['ironwood'] ?? 0 };
});
const qtyOf = (page: Page, sel: string) => page.locator(`${sel} [data-trade-n]`).textContent();

test('the trade window lists the whole satchel, stacks as ×N, and a partial amount changes hands', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterAs(page, hearth.port, 'Aster', 'ashguard', keeper('ua', [
    rec('s1', 'Ash Blade', 'astral-helm', 'rare'),
    stone('st-1'), stone('st-2'),
    rec('b1', 'Bound Locket', 'keepers-cowl', 'uncommon', { soulbound: true }),
  ], { 'minor-health-potion': 5, 'baked-ash-perch': 7, 'rune-ash': 3, ironwood: 30 }, 300));
  const phone = await newContext(browser, info, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const bryn = await phone.newPage();
  // Bryn's satchel is long too: on a phone its last entry must still be reachable (the window scrolls).
  const many: Record<string, number> = { 'minor-health-potion': 1, 'baked-ash-perch': 2, 'rune-ash': 1, 'rune-ember': 1, ironwood: 4, 'ashwood-log': 9, 'ash-perch': 3, 'seared-mirrorfin': 2 };
  await enterAs(bryn, hearth.port, 'Bryn', 'thornstrider', keeper('ub', [
    rec('r1', 'Tide Ring', 'keepers-cowl', 'epic'),
    ...Array.from({ length: 14 }, (_, i) => rec(`g${i}`, `Gear ${i}`, 'astral-helm', 'common', { stats: { magicFind: i + 1 } })),
  ], many, 20));

  const c = await card(page, 'Bryn');
  await c.locator('[data-peer-trade]').click();
  await expect(bryn.locator('[data-trade-ask]')).toBeVisible({ timeout: 10000 });
  await bryn.locator('[data-trade-ask-yes]').tap();
  await expect(page.locator('[data-trade-window]')).toBeVisible({ timeout: 10000 });
  await expect(bryn.locator('[data-trade-window]')).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, 'window-1280'); await shot(bryn, 'window-390');

  // Aster's whole satchel: gear, the Spellstone pile as one ×2, every stack as one ×N, the bound locket greyed with why.
  // (The free starter tools are listed too, greyed: "Keeps".) Before the fix: 7 entries, no stacks, two loose stones.
  for (const key of ['s1', 'st-1', 'b1', 'stack:minor-health-potion', 'stack:baked-ash-perch', 'stack:rune-ash', 'stack:ironwood']) await expect(page.locator(`[data-trade-bag="${key}"]`)).toHaveCount(1);
  await expect(page.locator('[data-trade-bag="st-2"]')).toHaveCount(0);
  await expect(page.locator('[data-trade-bag="s1"]')).toBeEnabled();
  expect(await qtyOf(page, '[data-trade-bag="st-1"]')).toBe('×2');
  expect(await qtyOf(page, '[data-trade-bag="stack:minor-health-potion"]')).toBe('×5');
  expect(await qtyOf(page, '[data-trade-bag="stack:baked-ash-perch"]')).toBe('×7');
  expect(await qtyOf(page, '[data-trade-bag="stack:rune-ash"]')).toBe('×3');
  expect(await qtyOf(page, '[data-trade-bag="stack:ironwood"]')).toBe('×30');
  await expect(page.locator('[data-trade-bag="b1"]')).toBeDisabled();
  await expect(page.locator('[data-trade-bag="b1"]')).toContainText('Soulbound');

  // A stack asks how many (Split): 2 of the 5 potions.
  await page.locator('[data-trade-bag="stack:minor-health-potion"]').click();
  await expect(page.locator('[data-trade-amount]')).toBeVisible();
  await page.locator('[data-trade-amount] input').fill('2');
  await shot(page, 'amount-1280');
  await page.locator('[data-trade-amount-ok]').click();
  await expect(page.locator('[data-trade-mine="stack:minor-health-potion"] [data-trade-n]')).toHaveText('×2', { timeout: 10000 });
  expect(await qtyOf(page, '[data-trade-bag="stack:minor-health-potion"]')).toBe('×3');
  await expect(bryn.locator('[data-trade-theirs="stack:minor-health-potion"] [data-trade-n]')).toHaveText('×2', { timeout: 10000 });
  // All of a stack: the amount starts at all of it.
  await page.locator('[data-trade-bag="stack:ironwood"]').click();
  await expect(page.locator('[data-trade-amount] input')).toHaveValue('30');
  await page.locator('[data-trade-amount-ok]').click();
  await expect(page.locator('[data-trade-bag="stack:ironwood"]')).toHaveCount(0, { timeout: 10000 });
  await expect(bryn.locator('[data-trade-theirs="stack:ironwood"] [data-trade-n]')).toHaveText('×30', { timeout: 10000 });

  // Bryn on the phone: every entry is listed and the last one can be reached and tapped.
  for (const key of ['r1', 'g0', 'g13', ...Object.keys(many).map(k => `stack:${k}`)]) await expect(bryn.locator(`[data-trade-bag="${key}"]`)).toHaveCount(1);
  const last = bryn.locator('[data-trade-bag]').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  // A stack on the phone: the second tap opens "How many?" in view; × puts it away.
  const perch = bryn.locator('[data-trade-bag="stack:ash-perch"]');
  await perch.scrollIntoViewIfNeeded();
  await perch.tap(); await perch.tap();
  await expect(bryn.locator('[data-trade-amount]')).toBeInViewport();
  await expect(bryn.locator('[data-trade-amount] input')).toHaveValue('3');
  await shot(bryn, 'amount-390');
  await bryn.locator('[data-trade-amount-x]').tap();
  await expect(bryn.locator('[data-trade-amount]')).toHaveCount(0);
  await bryn.locator('[data-trade-bag="r1"]').scrollIntoViewIfNeeded();
  await bryn.locator('[data-trade-bag="r1"]').tap();
  await bryn.locator('[data-trade-bag="r1"]').tap();
  await expect(page.locator('[data-trade-theirs="r1"]')).toBeVisible({ timeout: 10000 });

  await page.locator('[data-trade-accept]').click();
  await bryn.locator('[data-trade-accept]').tap();
  await expect(page.locator('[data-trade-confirm]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-trade-confirm]').click();
  await bryn.locator('[data-trade-confirm]').tap();
  await expect(page.locator('[data-trade-window]')).toHaveAttribute('data-trade-stage', 'done', { timeout: 15000 });
  await expect(bryn.locator('[data-trade-window]')).toHaveAttribute('data-trade-stage', 'done', { timeout: 15000 });
  await expect.poll(() => save(page), { timeout: 10000 }).toEqual({ names: ['Ash Blade', 'Bound Locket', 'Spellstone', 'Spellstone', 'Tide Ring'], potion: 3, ironwood: 0 });
  await expect.poll(() => save(bryn), { timeout: 10000 }).toMatchObject({ potion: 3, ironwood: 34 });
  expect((await save(bryn)).names).not.toContain('Tide Ring');
  await phone.close();
});
