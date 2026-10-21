/**
 * td-coop.spec.ts — shared creatures in a party (docs/design/online.md §3.4; Hearth protocol 4).
 *
 * Three browsers enter the top-down world against a private Hearth room (scripts/social-server.mjs on a free port) and
 * form a party. Aster joined it first, so the room names Aster host of the Seamworks surface; Bryn and Cora become
 * members: their own creatures are swept and they draw Aster's. With the wild spawns quieted, Aster lays two wolves
 * and a boss (calm, so the screens can be compared):
 *   - every screen holds the same creature ids at the same places with the same life;
 *   - a member's blow is a claim: the host's creature loses the life, and every screen shows it;
 *   - one kill pays each member once (in full: both fought it), and the host's protocol-3 announcement pays nobody again;
 *   - the boss's life is +60% for each other member present (×2.2 for three);
 *   - Aster leaves the party: the room names Bryn host, Bryn adopts the creatures (same ids, same life) and Cora keeps
 *     seeing them, now Bryn's.
 * A last test stands up the v3 room (the server before protocol 4) and checks nothing is shared and nothing breaks.
 *
 * Screenshots: docs/handoff/cozy-ui/coop-{same-monsters,shared-boss,handover}.jpg (two screens side by side).
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { ERA } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL)); });
test.afterAll(async () => { await hearth?.stop(); });

interface CoopView { role: string; host: string | null; area: string; present: string[]; mobs: { id: string; t: string; key: string; x: number; y: number; hp: number; max: number }[] }
type Hooks = { __tdCoop: { view: () => CoopView; quiet: () => boolean; lay: (t: string, dx: number, dy: number, calm?: boolean) => string | null; hit: (id: string, n: number) => boolean } };

const canvas = (page: Page) => page.locator('.viewport canvas');
const view = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.view());
const mob = async (page: Page, id: string) => (await view(page)).mobs.find(m => m.id === id) ?? null;
const peers = async (page: Page) => (await canvas(page).getAttribute('data-peers')) ?? '';
const peerAt = async (page: Page, name: string) => {
  const m = new RegExp(`${name}@(-?\\d+),(-?\\d+)`).exec(await peers(page));
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};
const keeper = () => {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(20) + 10 } as typeof act.progress.xpByDiscipline;
  return { 'godforge-realm-era': String(ERA), 'godforge-activity': act };
};
const step = async (page: Page, key: string, ms: number) => {
  await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
};
const hide = (page: Page) => page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
const calm = async (page: Page) => { await page.waitForTimeout(300); if (await page.locator('.menu-scrim').count()) await page.locator('.menu-scrim').click({ position: { x: 4, y: 4 } }); };
async function invite(page: Page, name: string): Promise<void> {
  await expect.poll(() => peers(page), { timeout: 15000 }).toContain(`${name}@`);
  await page.waitForTimeout(600);
  const at = await peerAt(page, name);
  expect(at, `${name} is drawn`).not.toBeNull();
  await page.mouse.click(at!.x, at!.y);
  const card = page.locator('[data-peer-card]');
  await expect(card.locator('h2')).toHaveText(name, { timeout: 5000 });
  await card.locator('[data-peer-invite]').click();
  await card.locator('.td-peer__x').click();
}
/** Two screens side by side in one picture. */
async function sideBySide(browser: Browser, info: TestInfo, left: Page, right: Page, path: string, labels: [string, string]): Promise<void> {
  const [l, r] = [await left.screenshot({ type: 'jpeg', quality: 80 }), await right.screenshot({ type: 'jpeg', quality: 80 })];
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 560 } });
  const p = await ctx.newPage();
  const img = (b: Buffer, label: string) => `<figure><img src="data:image/jpeg;base64,${b.toString('base64')}"><figcaption>${label}</figcaption></figure>`;
  await p.setContent(`<style>body{margin:0;background:#1e1420;display:flex;gap:8px;padding:8px;font:600 15px system-ui;color:#ffe6a8}figure{margin:0;flex:1}img{width:100%;display:block;border:2px solid #5a3e2a}figcaption{padding:4px 2px}</style>${img(l, labels[0])}${img(r, labels[1])}`);
  await p.screenshot({ path, type: 'jpeg', quality: 82, fullPage: true });
  await ctx.close();
  void info;
}

test('shared creatures: one host, the same monsters on every screen, claims, one reward each, a shared boss, a handover', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cc = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage(), c = await cc.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'warlock', keeper(), 'fxparty=1&fxcoop=1');
    await enterAs(b, hearth.port, 'Bryn', 'ashguard', keeper(), 'fxparty=1&fxcoop=1');
    await enterAs(c, hearth.port, 'Cora', 'lanternwright', keeper(), 'fxparty=1&fxcoop=1');
    await step(b, 'd', 500);
    await step(c, 'a', 500);
    for (const p of [a, b, c]) await hide(p);
    await invite(a, 'Bryn');
    await b.locator('[data-party-invite] [data-invite-accept]').click({ timeout: 10000 });
    await invite(a, 'Cora');
    await c.locator('[data-party-invite] [data-invite-accept]').click({ timeout: 10000 });
    await expect(a.locator('[data-party-frames]')).toHaveAttribute('data-party-size', '3', { timeout: 10000 });

    // ── The election: Aster (first in the party) hosts; Bryn and Cora draw Aster's creatures ──
    await expect(canvas(a)).toHaveAttribute('data-coop-role', 'host', { timeout: 15000 });
    for (const p of [b, c]) await expect(canvas(p)).toHaveAttribute('data-coop-role', 'member', { timeout: 15000 });
    for (const p of [a, b, c]) await p.evaluate(() => (window as unknown as Hooks).__tdCoop.quiet());
    const lay = (t: string, dx: number, dy: number) => a.evaluate(([t, dx, dy]) => (window as unknown as Hooks).__tdCoop.lay(t as string, dx as number, dy as number), [t, dx, dy] as const);
    const w1 = await lay('ash-wolf', 70, 30), w2 = await lay('ash-wolf', -150, 60);
    expect(w1 && w2).toBeTruthy();

    // Same ids, same places, same life on every screen.
    for (const p of [b, c]) await expect.poll(async () => (await view(p)).mobs.map(m => m.id).sort().join(), { timeout: 10000 }).toBe([w1, w2].sort().join());
    const host = await view(a);
    for (const p of [b, c]) {
      for (const id of [w1!, w2!]) {
        const h = host.mobs.find(m => m.id === id)!, m = (await mob(p, id))!;
        expect(Math.abs(m.x - h.x), `x of ${id}`).toBeLessThanOrEqual(2);
        expect(Math.abs(m.y - h.y), `y of ${id}`).toBeLessThanOrEqual(2);
        expect([m.hp, m.max, m.key]).toEqual([h.hp, h.max, h.key]);
      }
    }
    await calm(a); await calm(b);
    await sideBySide(browser, info, a, b, 'docs/handoff/cozy-ui/coop-same-monsters.jpg', ['Aster (host)', 'Bryn (member): the same two wolves, drawn from Aster\'s snapshots']);

    // ── A member's blow is a claim: the host's wolf loses the life; every screen shows it ──
    const max = host.mobs.find(m => m.id === w1)!.max;
    await b.evaluate(id => (window as unknown as Hooks).__tdCoop.hit(id, 7), w1!);
    await expect.poll(async () => (await mob(a, w1!))?.hp, { timeout: 10000 }).toBe(max - 7);
    for (const p of [b, c]) await expect.poll(async () => (await mob(p, w1!))?.hp, { timeout: 10000 }).toBe(max - 7);
    await c.evaluate(id => (window as unknown as Hooks).__tdCoop.hit(id, 5), w1!);
    await expect.poll(async () => (await mob(a, w1!))?.hp, { timeout: 10000 }).toBe(max - 12);

    // ── One kill: Bryn and Cora fought it, so each is paid once, in full; nothing pays again ──
    await a.evaluate(id => (window as unknown as Hooks).__tdCoop.hit(id, 9999), w1!);
    // (A share may come later from a creature Aster's own companions fell; the kill under test pays in full, once.)
    for (const p of [b, c]) await expect(canvas(p)).toHaveAttribute('data-coop-paid', /^full:1,/, { timeout: 10000 });
    for (const p of [a, b, c]) await expect.poll(async () => (await view(p)).mobs.some(m => m.id === w1), { timeout: 10000 }).toBe(false);
    await b.waitForTimeout(2000);
    for (const p of [b, c]) {
      await expect(canvas(p)).toHaveAttribute('data-coop-paid', /^full:1,/);
      // Aster's own protocol-3 announcement of the same kill is not paid as a share on top.
      expect((await canvas(p).getAttribute('data-party-share')) ?? '').not.toMatch(/^\+/);
    }

    // ── A shared boss: +60% life for each other member present (three here: ×2.2) ──
    // The Magma Tyrant's fight life: authored 1,400 × td-life's boss scale (×22, docs/design/loot-and-combat.md §13).
    const TYRANT = 1400 * 22;
    const boss = await lay('magma-tyrant', 90, 40);
    await expect.poll(async () => (await mob(b, boss!))?.max, { timeout: 10000 }).toBe(Math.round(TYRANT * 2.2));
    expect((await mob(a, boss!))?.max).toBe(Math.round(TYRANT * 2.2));
    expect((await mob(c, boss!))?.max).toBe(Math.round(TYRANT * 2.2));
    await b.evaluate(id => (window as unknown as Hooks).__tdCoop.hit(id, 300), boss!);
    await expect.poll(async () => (await mob(a, boss!))?.hp ?? 0, { timeout: 10000 }).toBeLessThanOrEqual(Math.round(TYRANT * 2.2) - 300);
    await expect.poll(async () => (await mob(c, boss!))?.hp ?? 0, { timeout: 10000 }).toBeLessThanOrEqual(Math.round(TYRANT * 2.2) - 300);
    await calm(a); await calm(c);
    await sideBySide(browser, info, a, c, 'docs/handoff/cozy-ui/coop-shared-boss.jpg', ['Aster (host): the Magma Tyrant at ×2.2 life for three', 'Cora (member): the same boss, wounded by Bryn\'s claim']);

    // ── Handover: Aster leaves the party; the room names Bryn; the creatures stay as they were ──
    const before = await view(c);
    await a.locator('[data-party-leave]').click({ timeout: 10000 });
    await expect(canvas(b)).toHaveAttribute('data-coop-role', 'host', { timeout: 15000 });
    await expect(canvas(c)).toHaveAttribute('data-coop-role', 'member', { timeout: 15000 });
    const adopted = await view(b);
    for (const id of [w2!, boss!]) {
      const was = before.mobs.find(m => m.id === id)!, now = adopted.mobs.find(m => m.id === id);
      expect(now, `${id} persists on the new host`).toBeTruthy();
      // The wolf keeps its life exactly; the boss is rescaled at once for two (×1.6), its wound kept in proportion.
      if (id === w2) expect(now!.hp).toBe(was.hp);
      else expect(Math.abs(now!.hp / now!.max - was.hp / was.max)).toBeLessThan(0.01);
    }
    // Two of the party present now: the boss's life is rescaled to ×1.6, its wound kept in proportion.
    await expect.poll(async () => (await mob(c, boss!))?.max, { timeout: 15000 }).toBe(Math.round(TYRANT * 1.6));
    await expect.poll(async () => (await view(c)).mobs.map(m => m.id).sort().join(), { timeout: 10000 }).toContain(w2!);
    await expect.poll(async () => (await view(c)).host, { timeout: 10000 }).toBe((await view(b)).host);
    await calm(b); await calm(c);
    await sideBySide(browser, info, b, c, 'docs/handoff/cozy-ui/coop-handover.jpg', ['Bryn: host now (Aster left the party), the creatures adopted', 'Cora: still a member, the same creatures, now Bryn\'s']);
  } finally {
    await ca.close(); await cb.close(); await cc.close();
  }
});

test('companions: a Thornstrider\'s beast and a Warlock\'s skeletons on each other\'s screens; a stranger sees only the beast', async ({ browser }, info) => {
  test.setTimeout(180_000);
  type Pals = { __tdCoop: { pals: () => { owner: string; k: string; t: string; x: number; y: number }[]; raise: (n: number) => number; mine: () => { k: string }[] } };
  const pals = (page: Page) => page.evaluate(() => (window as unknown as Pals).__tdCoop.pals());
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const ct = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cx = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), th = await ct.newPage(), x = await cx.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'warlock', keeper(), 'fxparty=1&fxcoop=1');
    await enterAs(th, hearth.port, 'Tamsin', 'thornstrider', keeper(), 'fxparty=1&fxcoop=1');
    await enterAs(x, hearth.port, 'Wren', 'ashguard', keeper(), 'fxparty=1&fxcoop=1');
    await step(th, 'd', 500);
    for (const p of [a, th, x]) await hide(p);
    await invite(a, 'Tamsin');
    await th.locator('[data-party-invite] [data-invite-accept]').click({ timeout: 10000 });
    await expect(canvas(a)).toHaveAttribute('data-coop-role', 'host', { timeout: 15000 });
    // Tamsin's spirit beast walks at her side by itself; Aster raises two skeletons.
    await expect.poll(async () => (await th.evaluate(() => (window as unknown as Pals).__tdCoop.mine())).some(p => p.k === 'pet'), { timeout: 10000 }).toBe(true);
    await a.evaluate(() => (window as unknown as Pals).__tdCoop.raise(2));
    // Each sees the other's: Aster the beast (the pet painter, the spirit beast's sheet), Tamsin two skeletons; Glim too.
    await expect.poll(async () => (await pals(a)).filter(p => p.k === 'pet' && p.t === 'spirit-beast').length, { timeout: 10000 }).toBe(1);
    await expect.poll(async () => (await pals(th)).filter(p => p.k === 'skel').length, { timeout: 10000 }).toBe(2);
    expect((await pals(th)).some(p => p.k === 'glim')).toBe(true);
    // Wren, in the room but not the party: the beast and Glim (presence, cosmetic), never the skeletons. Presence travels
    // with movement, so Tamsin takes a step.
    await step(th, 'a', 300);
    await expect.poll(async () => (await pals(x)).filter(p => p.k === 'pet').length, { timeout: 15000 }).toBeGreaterThanOrEqual(1);
    expect((await pals(x)).filter(p => p.k === 'skel').length).toBe(0);
    await calm(a); await calm(th);
    await sideBySide(browser, info, a, th, 'docs/handoff/cozy-ui/coop-companions.jpg', ['Aster (Warlock): Tamsin\'s spirit beast at her side', 'Tamsin (Thornstrider): Aster\'s two raised skeletons']);
  } finally {
    await ca.close(); await ct.close(); await cx.close();
  }
});

test('against the v3 room (before protocol 4) nothing is shared: each simulates its own, the party still works', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const v3 = info.outputPath('social-server-v3.mjs');
  let source = '';
  try { source = execFileSync('git', ['show', '6cf9e3b1:scripts/social-server.mjs'], { encoding: 'utf8' }); } catch { /* shallow clone */ }
  test.skip(!/PROTOCOL = 3;/.test(source), 'the v3 server source is not in this clone');
  fs.writeFileSync(v3, source);
  const old = await startHearth(String(info.project.use.baseURL), v3);
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterAs(a, old.port, 'Aster', 'warlock', keeper(), 'fxparty=1&fxcoop=1');
    await enterAs(b, old.port, 'Bryn', 'ashguard', keeper(), 'fxparty=1&fxcoop=1');
    await step(b, 'd', 500);
    await hide(a);
    await invite(a, 'Bryn');
    await b.locator('[data-party-invite] [data-invite-accept]').click({ timeout: 10000 });
    await expect(a.locator('[data-party-frames]')).toHaveAttribute('data-party-size', '2', { timeout: 10000 });
    await a.waitForTimeout(1500);
    for (const p of [a, b]) expect((await view(p)).role).toBe('solo');
    await a.evaluate(() => (window as unknown as Hooks).__tdCoop.quiet());
    const id = await a.evaluate(() => (window as unknown as Hooks).__tdCoop.lay('ash-wolf', 60, 20));
    await b.waitForTimeout(1500);
    expect((await view(b)).mobs.some(m => m.id === id && m.key.startsWith('fx-coop:'))).toBe(false);
    // The protocol-3 share still pays as before (the 60% of a kill near a party member).
    await a.evaluate(() => (window as unknown as { __tdParty: { smite: () => string | null } }).__tdParty.smite());
    await expect(canvas(b)).toHaveAttribute('data-party-share', /^\+\d+$/, { timeout: 10000 });
  } finally {
    await ca.close(); await cb.close(); await old.stop();
  }
});
