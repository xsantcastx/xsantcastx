/**
 * room-world.spec.ts — the room-run world (Hearth protocol 7) in the browser: the same RoomWorld the Hearth runs, with
 * a client's own MobSystem + TdCoop as a member of '@room'. The member draws the room's creatures; its blow is a claim
 * the room weighs; a room kill pays the member's XP but rolls no personal loot (the room rolled it, once); the room's
 * ground is laid among the member's drops, beside the corpse, and a pick asks the room instead of granting.
 * (The node suite, scripts/social-world.test.mjs, covers the room's HTTP verbs, two clients, forged intents and sleep.)
 */
import type { EngineOptions, KillEvent } from '../engine/engine.model';
import { MobSystem, type Drop, type MobHost } from '../td/td-mobs';
import { TdCoop, type CoopKill } from '../td/td-coop';
import { CoopRewards } from '../social/coop-rules';
import type { CoopHit } from '../social/coop-protocol';
import { ROOM_HOST, WORLD_DROP_ID, WORLD_PROTOCOL } from '../social/world-protocol';
import { ROOM_DROP_ID, ROOM_WORLD_PROTOCOL } from '../social/social-room';
import { RoomWorld } from './room-world';

describe('RoomWorld (protocol 7: the room simulates)', () => {
  const AREA = 'ember-isle';
  /** An open spot just outside the town, found on the real map. */
  function openSpot(w: RoomWorld): { x: number; y: number } {
    for (let r = 0; r < 200; r++) for (let c = -60; c < 60; c++) {
      if (!w.world.safeAt(c, r) && [0, 1, 2, 3].every(d => w.world.walkable(c + d, r))) return { x: c * 16 + 8, y: r * 16 + 8 };
    }
    throw new Error('no open ground');
  }

  function member() {
    const me = { x: 0, y: 0 }, kills: KillEvent[] = [], taken: Drop[] = [];
    const claims: CoopHit[][] = [];
    const host: MobHost = {
      options: { onKill: (e: KillEvent) => kills.push(e), rollLoot: () => { throw new Error('a member never rolls the room\'s loot'); }, onRoomTake: (d: Drop) => taken.push(d) } as unknown as EngineOptions,
      walkable: () => true, levelId: () => 'surface', player: () => me, hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
    };
    const sys = new MobSystem(host);
    sys.aura = null;
    const ledger = new CoopRewards();
    const coop = new TdCoop(sys, {
      send: async () => false,
      claim: async body => { claims.push(body.hits); return true; },
      killed: (k: CoopKill) => { const r = ledger.decide(k, { id: 'A', area: AREA, x: me.x, y: me.y }); return r.kind === 'none' ? 'none' : r.kind; },
      now: () => 0, phase: () => 'day', still: () => true,
    });
    return { me, sys, coop, kills, claims, taken };
  }

  it('a member draws the room\'s creature, its blow is weighed by the room, the kill pays XP and the loot is the room\'s', async () => {
    let now = 1_800_000_000_000;
    const room = new RoomWorld({ area: AREA, seed: 'spec', now: () => now, boot: 'k1' });
    const at = openSpot(room);
    room.fxQuiet();
    room.keeper({ id: 'A', x: at.x, y: at.y, level: 25 });
    const wolf = room.fxLay('ash-wolf', at.x + 30, at.y, true)!;
    const a = member();
    a.me.x = at.x; a.me.y = at.y;
    a.coop.setAreas({ [AREA]: { host: ROOM_HOST, term: room.term, members: ['A'] } }, 'A', []);
    a.coop.before(.016, AREA, []);
    expect(a.coop.role).toBe('member');
    // The room's snapshot, as the Hearth relays it.
    const snap = () => { const b = room.snapFor('A')!; a.coop.snap({ ...b, from: ROOM_HOST, term: room.term }); };
    snap();
    expect(a.sys.mobs.map(m => m.nid)).toEqual([wolf]);
    // The member's blow is a claim (nothing lands on its own screen's numbers), the room weighs it.
    const replica = a.sys.mobs[0];
    a.sys.wound(replica, 9);
    a.coop.after(.2);
    await Promise.resolve();
    expect(a.claims.length).toBe(1);
    const life = room.mobs.mobs.find(m => m.nid === wolf)!.hp;
    room.claims('A', a.claims[0]);
    expect(room.mobs.mobs.find(m => m.nid === wolf)!.hp).toBe(life - 9);
    // The room fells it: the member hears the kill, is paid its Hunting XP, and rolls nothing of its own.
    for (let i = 0; i < 20 && room.mobs.mobs.some(m => m.nid === wolf); i++) room.claims('A', [{ i: wolf, d: 30, el: 'physical' }]);
    snap();
    expect(a.sys.mobs.length).toBe(0);
    expect(a.kills.length).toBe(1);
    expect(a.kills[0].creature).toBe('ash-wolf');
    expect(a.sys.drops.length).toBe(0);
    // The room's ground: laid among the member's drops, beside the corpse its kill left, never taken by walking alone.
    const ground = room.groundList();
    expect(ground.length).toBeGreaterThan(0);
    expect(ground.every(g => WORLD_DROP_ID.test(g.id) && g.m === wolf && g.own.join() === 'A')).toBeTrue();
    expect(a.coop.corpseOf(wolf)).toMatch(/^corpse:/);
    for (const g of ground) a.sys.drops.push({ id: g.id, x: g.x, y: g.y, coins: g.coins, qty: g.qty, label: g.label, color: g.color, age: 1, corpse: a.coop.corpseOf(g.m), room: { hold: 0, wait: 0 } });
    expect(a.sys.corpseLoot(a.coop.corpseOf(wolf)!).length).toBe(ground.length);
    // Walking onto one picks it: it leaves the screen at once and the room is asked (the HUD grants on its yes).
    a.me.x = ground[0].x; a.me.y = ground[0].y;
    a.sys.update(.1);
    expect(a.taken.map(d => d.id)).toContain(ground[0].id);
    expect(a.sys.drops.some(d => d.id === ground[0].id)).toBeFalse();
    expect(room.take(ground[0].id, 'A').ok).toBeTrue();
    now += 1;
  });

  it('the client\'s copies of the protocol\'s values agree with the wire\'s', () => {
    expect(ROOM_WORLD_PROTOCOL).toBe(WORLD_PROTOCOL);
    expect(ROOM_DROP_ID.source).toBe(WORLD_DROP_ID.source);
  });

  it('another Keeper\'s loot waits on this screen until it is anyone\'s (no pick, no request)', () => {
    const a = member();
    a.sys.drops.push({ id: 'td:surface:w.ember-isle.k1.9', x: 0, y: 0, coins: 12, qty: 0, label: '12 Gold', color: '#ffd25a', age: 1, room: { hold: 3, wait: 0 } });
    a.sys.update(.5);
    expect(a.taken.length).toBe(0);
    expect(a.sys.drops.length).toBe(1);
    for (let i = 0; i < 8; i++) a.sys.update(.5);
    expect(a.taken.length).toBe(1);
  });

  it('S6: the room\'s creature casts its ability; the member sees the ring and takes the blow and its stun through the bite', () => {
    let now = 1_800_000_000_000;
    const room = new RoomWorld({ area: AREA, seed: 'spec-s6', now: () => now, boot: 'k6' });
    const at = openSpot(room);
    room.fxQuiet();
    room.keeper({ id: 'A', x: at.x, y: at.y, level: 30 });
    room.fxLay('obsidian-golem', at.x + 26, at.y);
    const golem = room.mobs.mobs[0];
    golem.ab = [0]; golem.cd = 99;
    const a = member();
    a.me.x = at.x; a.me.y = at.y;
    a.coop.setAreas({ [AREA]: { host: ROOM_HOST, term: room.term, members: ['A'] } }, 'A', []);
    a.coop.before(.016, AREA, []);
    const snap = () => { const b = room.snapFor('A')!; a.coop.snap({ ...b, from: ROOM_HOST, term: room.term }); };
    let sawRing = false;
    for (let i = 0; i < 40; i++) { now += 50; room.tick(.05); snap(); if (a.sys.bursts.some(b => b.tone === 'glass')) sawRing = true; }
    expect(sawRing).toBeTrue();
    expect(a.sys.kst.stun > 0 || a.sys.kst.immune > 0).toBeTrue();
  });
});
