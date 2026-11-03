/**
 * td-ground-stacks.spec.ts — stacks on the shared online ground (docs/design/verb-matrix.md ticket T1, ground half).
 * Two Keepers in a private Hearth room with SOCIAL_FAKE_AUTH=1 and SOCIAL_FAKE_TRADE=1 (the real trade-core over an
 * in-memory store, as td-grid-online.spec.ts): Aster drops 3 of her 5 Minor Health potions through the "How many … to
 * drop?" bar; they leave her satchel at once; Bryn sees one pile "Minor Health Potion ×3" and takes it whole; the save
 * on both sides says so (the room re-counted what Aster held, and moved the amount as one op each way).
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

test.use({ actionTimeout: 10000 });

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

const OUT = 'output/polish2';
const shot = async (page: Page, name: string) => { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const SK = 'minor-health-potion';
const stackLedger = (sk: string, qty: number) => ({
  version: 2, records: [{ id: `stack:${sk}`, definitionId: sk, kind: 'stack', category: 'materials', tags: ['material', sk], soulbound: false, acquiredAt: '2026-10-20T00:00:00.000Z', revision: { hlc: 10, deviceId: 'e2e', sequence: 1 }, source: 'inventory', stackKey: sk, location: { kind: 'bag' } }],
  tombstones: [], stackOps: qty ? [{ id: `seed:${sk}`, stackKey: sk, kind: 'grant', quantity: qty, hlc: 10, deviceId: 'e2e', sequence: 1 }] : [], goldFromSales: 0, sold: 0, hlc: 10, legacyBackup: null, era: 55,
});
const keeper = (uid: string, qty: number) => ({
  'eclipse-hearth-fake-token': `fake.${uid}.keeper`, 'eclipse-trade-fake': '1', 'godforge-realm-era': '55', 'preferred-language': 'en',
  'godforge-inventory': stackLedger(SK, qty), 'godforge-economy': { version: 3, goldEra: 1, gold: 50, totalGoldEarned: 50, runGoldEarned: 50, ops: [], origin: null, hlc: 10, applied: {} },
});
/** How many of the potion this browser's save holds (folds and live ops, as the satchel counts). */
const held = (page: Page) => page.evaluate(sk => {
  const inv = JSON.parse(localStorage.getItem('godforge-inventory') ?? '{}');
  const folds: { deviceId: string; upToHlc: number; net: Record<string, number> }[] = inv.stackFolds ?? [];
  let n = folds.reduce((a, f) => a + (f.net?.[sk] ?? 0), 0);
  const seen = new Set<string>();
  for (const op of inv.stackOps ?? []) {
    if (op.stackKey !== sk || seen.has(op.id)) continue;
    seen.add(op.id);
    const own = folds.find(f => f.deviceId === op.deviceId);
    if (own && op.hlc <= own.upToHlc) continue;
    n += op.kind === 'grant' ? op.quantity : -op.quantity;
  }
  return Math.max(0, n);
}, SK);
const calm = async (page: Page) => { await page.waitForTimeout(400); if (await page.locator('.menu-scrim').count()) await page.locator('.menu-scrim').click({ position: { x: 4, y: 4 } }); };
/** What the satchel grid shows of the potion (the cells' counts added up). */
const shown = (page: Page) => page.locator(`#satchel-book [data-grid="b"] [data-stack="${SK}"]`).evaluateAll(els => els.reduce((a, e) => a + Number(e.getAttribute('data-qty') ?? 0), 0));

test('online, two Keepers: 3 of 5 potions dropped through "How many?" lie as one pile ×3; the other Keeper takes it whole', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterAs(page, hearth.port, 'Aster', 'ashguard', keeper('us1', 5));
  const other = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const bryn = await other.newPage();
  await enterAs(bryn, hearth.port, 'Bryn', 'thornstrider', keeper('us2', 0));

  await calm(page);
  await page.getByRole('button', { name: /^Satchel/ }).first().click();
  const book = page.locator('#satchel-book');
  await expect(book.locator(`[data-grid="b"] [data-stack="${SK}"]`).first()).toBeVisible({ timeout: 10000 });
  await book.locator(`[data-grid="b"] [data-stack="${SK}"]`).first().click();
  await page.locator('.d2tip--pinned [data-drop-item]').click();
  // "How many Minor Health Potion to drop?" starts at all five; three it is.
  const bar = page.locator('[data-drop-amount]');
  await expect(bar).toBeVisible();
  await expect(bar.locator('[data-drop-amount-n]')).toHaveValue('5');
  await bar.locator('[data-drop-amount-n]').fill('3');
  await shot(page, 'ground-stack-howmany-1280');
  await bar.locator('[data-drop-amount-ok]').click();
  // They leave the satchel at once (held back until the room's escrow is read back), and never twice.
  await expect.poll(() => shown(page), { timeout: 3000 }).toBe(2);
  await expect.poll(() => held(page), { timeout: 20000 }).toBe(2);
  await expect.poll(() => shown(page), { timeout: 5000 }).toBe(2);

  // Bryn's screen: one pile, "Minor Health Potion ×3".
  type P = { n: number; px: number; py: number; ids: string[]; labels: string[] };
  const piles = () => bryn.evaluate(() => (window as unknown as { __tdGround: { piles(): P[] } }).__tdGround.piles());
  const ours = (p: P) => p.labels.some(l => l === 'Minor Health Potion ×3');
  await expect.poll(async () => (await piles()).some(ours), { timeout: 20000 }).toBe(true);
  await calm(bryn);
  const pile = (await piles()).find(ours)!;
  expect(pile.ids.every(id => id.startsWith('shared:'))).toBe(true);
  await shot(bryn, 'ground-stack-pile-1280');
  await bryn.mouse.click(pile.px, pile.py, { button: 'right' });
  const win = bryn.locator('[data-pile-window]');
  await expect(win).toBeVisible();
  await win.locator('[data-pile-take]').first().click();
  // A pile of three asks "How many … to take?" (polish2): two it is; one lies on, and nobody lost or gained a potion.
  const take = bryn.locator('[data-drop-amount]');
  await expect(take).toBeVisible();
  await expect(take.locator('[data-drop-amount-n]')).toHaveValue('3');
  await take.locator('[data-drop-amount-n]').fill('2');
  await shot(bryn, 'ground-stack-take-howmany-1280');
  await take.locator('[data-drop-amount-ok]').click();
  await expect.poll(() => held(bryn), { timeout: 20000 }).toBe(2);
  const rest = (p: P) => p.labels.some(l => l === 'Minor Health Potion');
  await expect.poll(async () => (await piles()).some(rest), { timeout: 10000 }).toBe(true);
  expect(await held(page)).toBe(2);
  // The last one (a pile of one asks nothing) is taken whole: the pile leaves both screens.
  await calm(bryn);
  const last = (await piles()).find(rest)!;
  await bryn.mouse.click(last.px, last.py, { button: 'right' });
  await expect(bryn.locator('[data-pile-window]')).toBeVisible();
  await bryn.locator('[data-pile-window] [data-pile-take]').first().click();
  await expect.poll(() => held(bryn), { timeout: 20000 }).toBe(3);
  await expect.poll(async () => (await piles()).some(rest), { timeout: 10000 }).toBe(false);
  expect(await held(page)).toBe(2);
  await other.close();
});
