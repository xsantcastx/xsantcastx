/**
 * td-world-m3.spec.ts — M3 of the room-run world (Hearth protocol 9; docs/design/online.md §4d "M3").
 *
 * Two browsers wake in the Ember Mine's first floor against a private Hearth room running the world. The floor is the
 * room's (a protocol-9 client is hosted everywhere, not only on the island):
 *   - both screens are members of '@room' there and draw the same floor creatures;
 *   - Aster fells one; it is gone on both screens;
 *   - Aster leaves (the page closes) and comes back down: the creature is still dead — the floor never reset — and
 *     Bryn, who stayed, never saw it return. The room's own record agrees (its resting list).
 */
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { ERA } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_WORLD: '1', SOCIAL_WORLD_FX: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

const FLOOR = 'ember-mine-1';
interface WorldView { role: string; host: string | null; area: string; mobs: { id: string; t: string; key: string; x: number; y: number; hp: number; max: number }[] }
type Hooks = { __tdCoop: { view: () => WorldView; target: (id: string) => boolean } };

const canvas = (page: Page) => page.locator('.viewport canvas');
const view = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.view());
const inMine = () => {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(20) + 10 } as typeof act.progress.xpByDiscipline;
  return { 'godforge-realm-era': String(ERA), 'godforge-activity': act, 'eclipse-play-world-v1': { td: { continent: 'ember-isle', level: FLOOR, x: 184, y: 250 } } };
};
const hide = (page: Page) => page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
async function fx(origin: string, body: Record<string, unknown>): Promise<{ mobs: { id: string; t: string; hp: number }[] }> {
  const res = await fetch(`http://127.0.0.1:${hearth.port}/world/fx`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(res.status).toBe(200);
  return res.json();
}

test('a dungeon floor is the room\'s: a kill stays dead when its Keeper leaves and comes back, for everyone', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const origin = new URL(String(info.project.use.baseURL)).origin;
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  let a = await ca.newPage();
  const b = await cb.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'warlock', inMine(), 'fxcoop=1');
    await enterAs(b, hearth.port, 'Bryn', 'ashguard', inMine(), 'fxcoop=1');
    for (const p of [a, b]) await hide(p);
    // Both are the room's members on the floor (a protocol-9 client is hosted in every area).
    for (const p of [a, b]) await expect(canvas(p)).toHaveAttribute('data-coop-role', 'member', { timeout: 20000 });
    for (const p of [a, b]) await expect.poll(async () => { const v = await view(p); return `${v.area}|${v.host}`; }, { timeout: 10000 }).toBe(`${FLOOR}|@room`);
    // The same floor creatures on both screens (the room's, by id).
    await expect.poll(async () => (await view(a)).mobs.length, { timeout: 10000 }).toBeGreaterThan(0);
    const ids = async (p: Page) => (await view(p)).mobs.map(m => m.id).sort().join();
    // (Both computed in each poll: the floor lives, and a creature may cross a screen's edge between two reads.)
    await expect.poll(async () => (await ids(b)) === (await ids(a)), { timeout: 10000 }).toBe(true);

    // ── Aster fells the nearest one ──
    // Through the real attack path (the Keeper's own target: he walks round any wall into sight and reach, then
    // strikes), never a blow forced from where he stands: the room refuses a blow with a wall between (its line of
    // sight), as the screen does. Nearest to where Aster really stands, not to where the save put him.
    type Where = { __tdWaygate: { where: () => { x: number; y: number } } };
    const me = await a.evaluate(() => (window as unknown as Where).__tdWaygate.where());
    const va = await view(a);
    const prey = [...va.mobs].sort((p, q) => Math.hypot(p.x - me.x, p.y - me.y) - Math.hypot(q.x - me.x, q.y - me.y))[0];
    expect(prey.key).toBeTruthy();
    // Until the room itself says it fell (its own floor list, not this screen's).
    const alive = async () => (await fx(origin, { near: 'Bryn' })).mobs.some(m => m.id === prey.id);
    for (let i = 0; i < 60 && await alive(); i++) {
      await a.evaluate(id => (window as unknown as Hooks).__tdCoop.target(id), prey.id);
      await a.waitForTimeout(500);
    }
    expect(await alive()).toBe(false);
    for (const p of [a, b]) await expect.poll(async () => (await view(p)).mobs.some(m => m.key === prey.key), { timeout: 15000 }).toBe(false);

    // ── Aster leaves; Bryn stays. Aster comes back down: still dead, on both screens; the room agrees ──
    await a.close();
    await b.waitForTimeout(3000);
    expect((await view(b)).mobs.some(m => m.key === prey.key)).toBe(false);
    a = await ca.newPage();
    await enterAs(a, hearth.port, 'Aster', 'warlock', inMine(), 'fxcoop=1');
    await hide(a);
    await expect(canvas(a)).toHaveAttribute('data-coop-role', 'member', { timeout: 20000 });
    await expect.poll(async () => (await view(a)).mobs.length, { timeout: 10000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await ids(a)) === (await ids(b)), { timeout: 10000 }).toBe(true);
    expect((await view(a)).mobs.some(m => m.key === prey.key)).toBe(false);
    const room = await fx(origin, { near: 'Bryn' });
    // The room's own floor (all of it, not only what is near the screens): the fallen one is not in it.
    expect(room.mobs.some(m => m.id === prey.id)).toBe(false);
    await a.screenshot({ path: 'output/world-m3/aster-back.png' });
  } finally {
    await ca.close(); await cb.close();
  }
});
