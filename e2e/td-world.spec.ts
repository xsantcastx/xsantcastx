/**
 * td-world.spec.ts — the room-run world (Hearth protocol 7; docs/design/online.md "Phase 8: the room simulates").
 *
 * Two browsers enter the Seamworks island against a private Hearth room running the world (scripts/social-server.mjs
 * with the game's own simulation compiled from the sources). No party: the room hosts every Keeper on the island.
 *   - both screens are members of '@room' and draw the same creature (same id, same place, same life);
 *   - Aster's blows are claims the room weighs; the creature dies on both screens at once; Aster is paid its kill;
 *   - the room rolls the loot once: the same pieces, the same ids, lie on both screens, beside the corpse;
 *   - Bryn did not fight it: on Bryn's screen the loot waits (Aster's for a moment); Aster walks onto it, it leaves
 *     Aster's screen at once (optimistic) and the room says yes; it leaves Bryn's screen too.
 * The client-perceived and round-trip times of the take are printed (data-world-take: ok:n:rtt:server).
 */
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { ERA } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_WORLD: '1', SOCIAL_WORLD_FX: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

interface WorldView { role: string; host: string | null; area: string; mobs: { id: string; t: string; x: number; y: number; hp: number; max: number }[] }
interface Ground { id: string; x: number; y: number; coins: number; label: string; hold: number; corpse: string }
type Hooks = { __tdCoop: { view: () => WorldView; hit: (id: string, n: number) => boolean; ground: () => Ground[]; walkTo: (id: string) => boolean } };

const canvas = (page: Page) => page.locator('.viewport canvas');
const view = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.view());
const ground = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.ground());
const keeper = () => {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(20) + 10 } as typeof act.progress.xpByDiscipline;
  return { 'godforge-realm-era': String(ERA), 'godforge-activity': act };
};
const hide = (page: Page) => page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
/** The room's test hook (SOCIAL_WORLD_FX=1, local only): quiet the wild spawns, lay a calm creature beside a Keeper. */
async function fx(origin: string, body: Record<string, unknown>): Promise<{ id: string | null; mobs: { id: string; hp: number }[] }> {
  const res = await fetch(`http://127.0.0.1:${hearth.port}/world/fx`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(res.status).toBe(200);
  return res.json();
}

test('the room runs the island: two Keepers see the same creature die and the same drop; first allowed take wins', async ({ browser }, info) => {
  test.setTimeout(180_000);
  const origin = new URL(String(info.project.use.baseURL)).origin;
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'warlock', keeper(), 'fxcoop=1');
    await enterAs(b, hearth.port, 'Bryn', 'ashguard', keeper(), 'fxcoop=1');
    for (const p of [a, b]) await hide(p);
    // No party: the room hosts the island for both.
    for (const p of [a, b]) await expect(canvas(p)).toHaveAttribute('data-coop-role', 'member', { timeout: 20000 });
    for (const p of [a, b]) await expect.poll(async () => (await view(p)).host, { timeout: 10000 }).toBe('@room');

    // ── The same creature on both screens ──
    // Past the coin magnet's eight tiles, so its Gold lies until Aster walks to it (and both screens can compare it).
    const laid = await fx(origin, { near: 'Aster', quiet: true, lay: { type: 'ash-wolf', dx: 140, dy: 0, calm: true } });
    const wolf = laid.id!;
    expect(wolf).toBeTruthy();
    for (const p of [a, b]) await expect.poll(async () => (await view(p)).mobs.map(m => m.id).join(), { timeout: 10000 }).toBe(wolf);
    const [va, vb] = [await view(a), await view(b)];
    const [ma, mb] = [va.mobs[0], vb.mobs[0]];
    expect([mb.t, mb.hp, mb.max]).toEqual([ma.t, ma.hp, ma.max]);
    expect(Math.abs(ma.x - mb.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(ma.y - mb.y)).toBeLessThanOrEqual(2);

    // ── Aster's blow is a claim: the room's wolf loses the life, on both screens ──
    await a.evaluate(id => (window as unknown as Hooks).__tdCoop.hit(id, 7), wolf);
    for (const p of [a, b]) await expect.poll(async () => (await view(p)).mobs.find(m => m.id === wolf)?.hp, { timeout: 10000 }).toBe(ma.max - 7);

    // ── It dies on both screens; Aster (who fought it) is paid ──
    for (let i = 0; i < 6 && (await view(a)).mobs.some(m => m.id === wolf); i++) {
      await a.evaluate(id => (window as unknown as Hooks).__tdCoop.hit(id, 40), wolf);
      await a.waitForTimeout(400);
    }
    for (const p of [a, b]) await expect.poll(async () => (await view(p)).mobs.some(m => m.id === wolf), { timeout: 10000 }).toBe(false);
    await expect(canvas(a)).toHaveAttribute('data-coop-paid', /^full:1,/, { timeout: 10000 });
    await expect(canvas(b)).not.toHaveAttribute('data-coop-paid', /^full:1,/);

    // ── The same drop on both screens, beside the corpse ──
    const server = await fx(origin, { near: 'Aster' }) as unknown as { ground: { id: string }[] };
    console.log(`room ground: ${server.ground.map(g => g.id).join(', ')}; Aster's screen: ${await canvas(a).getAttribute('data-room-ground')} (${await canvas(a).getAttribute('data-world-take')}); Bryn's: ${await canvas(b).getAttribute('data-room-ground')}`);
    await expect.poll(async () => (await ground(a)).length, { timeout: 10000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await ground(b)).map(g => g.id).sort().join(), { timeout: 10000 }).toBe((await ground(a)).map(g => g.id).sort().join());
    const ga = await ground(a), gb = await ground(b);
    expect(ga.every(g => g.corpse.startsWith('corpse:'))).toBe(true);
    // Bryn's screen holds it back (Aster's for a moment); Aster's does not.
    expect(gb.every(g => g.hold > 0)).toBe(true);
    expect(ga.every(g => g.hold === 0)).toBe(true);
    await info.attach('ground', { body: JSON.stringify(ga, null, 1), contentType: 'application/json' });
    await a.screenshot({ path: 'output/world/aster-drop.png' });
    await b.screenshot({ path: 'output/world/bryn-drop.png' });

    // ── Aster walks onto one piece: gone from Aster's screen at once, the room says yes, gone from Bryn's ──
    const piece = ga[0];
    await a.evaluate(id => (window as unknown as Hooks).__tdCoop.walkTo(id), piece.id);
    await expect.poll(async () => (await ground(a)).some(g => g.id === piece.id), { timeout: 3000 }).toBe(false);
    await expect(canvas(a)).toHaveAttribute('data-world-take', /^ok:/, { timeout: 10000 });
    await expect.poll(async () => (await ground(b)).some(g => g.id === piece.id), { timeout: 10000 }).toBe(false);
    const took = (await canvas(a).getAttribute('data-world-take')) ?? '';
    const [, , rtt, roomMs] = took.split(':');
    console.log(`world take (local hearth): client-perceived 0 ms (optimistic), round trip ${rtt} ms, room ${roomMs} ms`);
  } finally {
    await ca.close(); await cb.close();
  }
});
