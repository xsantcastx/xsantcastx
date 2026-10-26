/**
 * td-world-m4.spec.ts — M4 of the room-run world (Hearth protocol 10; docs/design/online.md §4d "M4").
 *
 * Two browsers on the Seamworks island against a private Hearth room running the world, with the local stand-ins for
 * sign-in and Firestore (SOCIAL_FAKE_AUTH, SOCIAL_FAKE_TRADE). Aster (an Ashguard) is signed in; Bryn (a Warlock) is a
 * guest.
 *   1. A stun: Aster's Shield Bash on a creature of the room — the room lays it, and the creature stands stunned on
 *      BOTH screens and in the room's own record (measured: Aster's cast → Bryn's screen).
 *   2. A kill credits XP once: Aster fells it; the room pays Aster's Hunting XP into the save itself (one operation of
 *      the room's in the activity ledger, never two, however long we wait); Aster's screen never writes it.
 *   3. A death on the room: Bryn's life is the room's; a pack of the room's creatures fells him; the room says so and
 *      both screens see it (Bryn falls; Aster's log hears it). Measured: the life claims' round trip.
 * The numbers are printed (`# m4 …`); screenshots go to output/world-m4/ (not committed).
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { ERA } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

let hearth: Hearth;
test.beforeAll(async ({}, info) => {
  hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_WORLD: '1', SOCIAL_WORLD_FX: '1', SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' });
});
test.afterAll(async () => { await hearth?.stop(); });

interface WorldView { role: string; host: string | null; area: string; mobs: { id: string; t: string; x: number; y: number; hp: number; max: number; stun: boolean }[] }
interface LifeView { on: boolean; hp: number; room: { h: number; m: number; q: number; d?: 1 } | null; inFlight: number; rtt: number[]; down: boolean }
type Hooks = { __tdCoop: { view: () => WorldView; target: (id: string) => boolean; cast: (id: string) => string | null; life: () => LifeView; harm: (n: number) => number } };

const SHOTS = 'output/world-m4';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 72 }); };
const canvas = (page: Page) => page.locator('.viewport canvas');
const view = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.view());
const life = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.life());
const level20 = () => {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(20) + 10 } as typeof act.progress.xpByDiscipline;
  return act;
};
const hide = (page: Page) => page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
async function fx(origin: string, body: Record<string, unknown>): Promise<{ id: string | null; mobs: { id: string; hp: number; st: number }[] }> {
  const res = await fetch(`http://127.0.0.1:${hearth.port}/world/fx`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(res.status).toBe(200);
  return res.json();
}
/** The "Firestore" the room writes through (scripts/trade-fake.mjs), as the signed-in Keeper `uid`. */
let ORIGIN = '';
async function doc(uid: string, op: 'get' | 'put', path: string, data?: unknown): Promise<{ v?: Record<string, unknown> } | null> {
  const res = await fetch(`http://127.0.0.1:${hearth.port}/fake-trade/doc/${op}`, {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Authorization: `Bearer fake.${uid}.keeper` }, body: JSON.stringify({ path, ...(op === 'put' ? { data } : {}) }),
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { data?: { v?: Record<string, unknown> } | null }).data ?? null;
}
/** When (the page's wall clock, shared by both browsers) the room's creature first stands stunned on this screen. */
const watchStun = (page: Page, id: string) => page.evaluate(wid => {
  const w = window as unknown as Record<string, unknown> & Hooks;
  delete w['__m4stun'];
  const tick = () => { if (!w['__m4stun'] && w.__tdCoop.view().mobs.some(m => m.id === wid && m.stun)) w['__m4stun'] = Date.now(); else if (!w['__m4stun']) requestAnimationFrame(tick); };
  tick();
}, id);

test('M4: a stun from one Keeper holds the creature on both screens; a kill credits XP once; a death on the room is seen by both', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const origin = new URL(String(info.project.use.baseURL)).origin;
  ORIGIN = origin;
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  const ACT = 'users/u1/progress/activity';
  try {
    // Aster's save in the room's store (the room pays into it); Bryn is a guest.
    await doc('u1', 'put', ACT, { v: level20(), updatedAt: new Date().toISOString() });
    await doc('u1', 'put', 'users/u1/economy/state', { v: { version: 3, goldEra: 1, gold: 50, totalGoldEarned: 50, runGoldEarned: 50, ops: [], origin: null, hlc: 10, applied: {} }, updatedAt: new Date().toISOString() });
    await enterAs(a, hearth.port, 'Aster', 'ashguard', { 'godforge-realm-era': String(ERA), 'godforge-activity': level20(), 'eclipse-hearth-fake-token': 'fake.u1.keeper', 'eclipse-trade-fake': '1' }, 'fxcoop=1');
    await enterAs(b, hearth.port, 'Bryn', 'warlock', { 'godforge-realm-era': String(ERA), 'godforge-activity': level20() }, 'fxcoop=1');
    for (const p of [a, b]) await hide(p);
    for (const p of [a, b]) await expect(canvas(p)).toHaveAttribute('data-coop-role', 'member', { timeout: 20000 });
    for (const p of [a, b]) await expect.poll(async () => (await view(p)).host, { timeout: 10000 }).toBe('@room');
    // The room keeps both Keepers' life (protocol 10).
    for (const p of [a, b]) await expect(canvas(p)).toHaveAttribute('data-room-life', 'on', { timeout: 10000 });

    // ── 1. Aster's Shield Bash stuns a creature of the room: both screens, and the room ──
    // An Obsidian Golem: tough enough that the bash's own blow does not fell it first.
    const wolf = (await fx(origin, { near: 'Aster', quiet: true, lay: { type: 'obsidian-golem', dx: 14, dy: 0, calm: true } })).id!;
    for (const p of [a, b]) await expect.poll(async () => (await view(p)).mobs.some(m => m.id === wolf), { timeout: 10000 }).toBe(true);
    await watchStun(b, wolf);
    // (No target: the bash finds the creature at its side; an auto-attack would fell it before the stun is compared.)
    const castAt = await a.evaluate(() => { (window as unknown as Hooks).__tdCoop.cast('shield-bash'); return Date.now(); });
    await expect.poll(async () => (await fx(origin, { near: 'Aster' })).mobs.find(m => m.id === wolf)?.st ?? 0, { timeout: 5000 }).toBeGreaterThan(0);
    await expect.poll(() => b.evaluate(() => (window as unknown as Record<string, number>)['__m4stun'] ?? 0), { timeout: 5000 }).toBeGreaterThan(0);
    const seenAt = await b.evaluate(() => (window as unknown as Record<string, number>)['__m4stun']);
    expect((await view(a)).mobs.find(m => m.id === wolf)?.stun).toBe(true);
    await shot(b, 'bryn-sees-stun');
    console.log(`# m4 stun: Aster's cast → Bryn's screen ${seenAt - castAt} ms`);

    // ── 2. Aster fells one (an Ash Wolf at its side): the room pays its XP into the save, once ──
    const before = (await doc('u1', 'get', ACT))?.v as { progress: { xpByDiscipline: { hunting: number } } };
    const xp0 = before.progress.xpByDiscipline.hunting;
    const prey = (await fx(origin, { near: 'Aster', lay: { type: 'ash-wolf', dx: -14, dy: 0, calm: true } })).id!;
    await expect.poll(async () => (await view(a)).mobs.some(m => m.id === prey), { timeout: 10000 }).toBe(true);
    const alive = async () => (await fx(origin, { near: 'Aster' })).mobs.some(m => m.id === prey);
    const killAt = Date.now();
    for (let i = 0; i < 60 && await alive(); i++) { await a.evaluate(id => (window as unknown as Hooks).__tdCoop.target(id), prey); await a.waitForTimeout(300); }
    expect(await alive()).toBe(false);
    const hunted = async () => ((await doc('u1', 'get', ACT))?.v as { progress: { xpByDiscipline: { hunting: number } } }).progress.xpByDiscipline.hunting;
    await expect.poll(hunted, { timeout: 15000 }).toBeGreaterThan(xp0);
    const paidAt = Date.now();
    const once = await hunted();
    await a.waitForTimeout(4000);
    expect(await hunted()).toBe(once);
    const ops = ((await doc('u1', 'get', ACT))?.v as { operations: { id: string; hlcRevision: { deviceId: string }; xpGrant: { amount: number } }[] }).operations.filter(o => o.hlcRevision.deviceId === 'room');
    expect(ops.length).toBe(1);
    expect(ops[0].xpGrant.amount).toBe(once - xp0);
    await expect(canvas(a)).toHaveAttribute('data-room-paid', /^[1-9]\d*:/);
    // Aster's screen asked; it never wrote the XP itself (its own ledger holds no new hunting operation).
    const local = await a.evaluate(() => JSON.parse(localStorage.getItem('godforge-activity') ?? '{}') as { operations?: { disciplineId: string }[] });
    expect((local.operations ?? []).filter(o => o.disciplineId === 'hunting').length).toBe(0);
    console.log(`# m4 credit: +${once - xp0} XP in the save ${paidAt - killAt} ms after the first blow (once; one room op)`);

    // ── 3. Bryn falls to the room's creatures: the room's word, both screens ──
    const lb = await life(b);
    expect(lb.on).toBe(true);
    await b.evaluate(n => (window as unknown as Hooks).__tdCoop.harm(n), Math.max(0, lb.hp - 8));
    await expect.poll(async () => (await life(b)).room?.h ?? 999, { timeout: 5000 }).toBeLessThan(20);
    for (let i = 0; i < 3; i++) await fx(origin, { near: 'Bryn', lay: { type: 'ash-wolf', dx: 10 + i * 6, dy: i * 6, calm: false } });
    await expect.poll(async () => (await life(b)).down, { timeout: 30000 }).toBe(true);
    await expect.poll(async () => Number(await canvas(a).getAttribute('data-room-falls') ?? 0), { timeout: 10000 }).toBeGreaterThan(0);
    await shot(b, 'bryn-fell');
    const rtt = (await life(b)).rtt.concat((await life(a)).rtt).sort((x, y) => x - y);
    console.log(`# m4 life: claims' round trip median ${Math.round(rtt[Math.floor(rtt.length / 2)] ?? 0)} ms over ${rtt.length}; Bryn down on the room's word`);
    // He wakes at a hearth, whole, and the room has him on his feet again.
    await expect.poll(async () => { const l = await life(b); return !l.down && (l.room?.d ?? 0) === 0 && (l.room?.h ?? 0) > 20; }, { timeout: 30000 }).toBe(true);
  } finally {
    await ca.close(); await cb.close();
  }
});
