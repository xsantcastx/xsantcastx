/**
 * td-coop.spec.ts — shared creatures end to end in memory (protocol 4): a host's MobSystem and a member's, joined by
 * TdCoop and a fake room. The member sees the host's creatures; its blows become claims that wound the host's; the
 * host's creatures strike the member through its own defenses; a kill pays each once; a boss grows for the party; and
 * when the member becomes host the creatures stay, wounded as they were, and their minds wake.
 */
import type { EngineOptions, KillEvent } from '../engine/engine.model';
import { MOBS, MobSystem, type MobHost } from './td-mobs';
import { TdCoop, type CoopKill, type CoopRole } from './td-coop';
import { makePack } from './td-elites';
import { CoopRewards, coopBossLife } from '../social/coop-rules';
import type { CoopAreas, CoopHit, CoopSnapBody, CoopSnapMsg } from '../social/coop-protocol';

interface Side { sys: MobSystem; coop: TdCoop; me: { x: number; y: number }; hurt: number[]; kills: KillEvent[]; rewards: string[] }

function rig() {
  let clock = 0;
  const wire: { to: 'host' | 'member'; kind: 'snap' | 'hits'; body: CoopSnapBody | { area: string; hits: CoopHit[] }; from: string }[] = [];
  const make = (id: string): Side => {
    const me = { x: 0, y: 0 }, hurt: number[] = [], kills: KillEvent[] = [], rewards: string[] = [];
    const host: MobHost = {
      options: { onKill: (e: KillEvent) => kills.push(e), rollLoot: () => [] } as unknown as EngineOptions,
      walkable: () => true, levelId: () => 'surface', player: () => me, hurtPlayer: n => hurt.push(n), healPlayer: () => undefined, swung: () => undefined,
    };
    const sys = new MobSystem(host);
    sys.aura = null;                                                // no Ember aura: every blow here is the spec's own
    const ledger = new CoopRewards();
    const coop = new TdCoop(sys, {
      send: async body => { wire.push({ to: 'member', kind: 'snap', body, from: id }); return true; },
      claim: async body => { wire.push({ to: 'host', kind: 'hits', body, from: id }); return true; },
      killed: (k: CoopKill) => { const r = ledger.decide(k, { id, area: 'ember-isle', x: me.x, y: me.y }); rewards.push(r.kind); return r.kind === 'none' ? 'none' : r.kind; },
      now: () => clock, phase: () => 'day', still: () => false,
    });
    return { sys, coop, me, hurt, kills, rewards };
  };
  const a = make('A'), b = make('B');
  const sides: Record<string, Side> = { A: a, B: b };
  let areas: CoopAreas = { 'ember-isle': { host: 'A', term: 1, members: ['A', 'B'] } };
  const elect = (next: CoopAreas) => { areas = next; for (const [id, s] of Object.entries(sides)) s.coop.setAreas(areas, id, ['A', 'B']); };
  elect(areas);
  /** One frame on both screens, then the room delivers what was posted (host → members of its area, claims → host). */
  const frame = async (dt = 1 / 60) => {
    clock += dt * 1000;
    for (const [id, s] of Object.entries(sides)) {
      const other = id === 'A' ? sides['B'] : sides['A'];
      s.coop.before(dt, 'ember-isle', [{ id: id === 'A' ? 'B' : 'A', x: other.me.x, y: other.me.y }]);
      s.sys.update(dt);
      s.coop.after(dt);
    }
    for (const w of wire.splice(0)) {
      const host = areas['ember-isle'].host;
      if (w.kind === 'snap') for (const [id, s] of Object.entries(sides)) { if (id !== w.from) s.coop.snap({ ...(w.body as CoopSnapBody), from: w.from, term: areas['ember-isle'].term } as CoopSnapMsg); }
      else sides[host]?.coop.hits({ from: w.from, area: 'ember-isle', x: sides[w.from].me.x, y: sides[w.from].me.y, level: 20, hits: (w.body as { hits: CoopHit[] }).hits });
    }
  };
  // Each frame lets the posts settle (the room answers between frames, as fetch would).
  const run = async (secs: number) => { for (let t = 0; t < secs; t += 1 / 60) { await frame(); await Promise.resolve(); await Promise.resolve(); } };
  return { a, b, elect, frame, run, roles: (): CoopRole[] => [a.coop.role, b.coop.role] };
}

const calm = (def = MOBS['ash-wolf']) => ({ ...def, sight: 0 });

describe('td-coop: shared creatures between a host and a member', () => {
  it('the member draws the host\'s creatures: same ids, same places, same life; it spawns none of its own', async () => {
    const { a, b, run, roles } = rig();
    const wolf = a.sys.place('w:1,1', calm(), 60, 20); wolf.wait = 1e9;
    b.sys.place('mine', MOBS['ash-wolf'], 10, 10);                  // the member's own: swept when it joins
    await run(.5);
    expect(roles()).toEqual(['host', 'member']);
    expect(b.sys.replica).toBeTrue();
    expect(b.sys.mobs.length).toBe(1);
    const rep = b.sys.mobs[0];
    expect(rep.nid).toBe(wolf.nid!);
    expect(rep.key).toBe('w:1,1');
    expect(Math.round(rep.x)).toBe(60); expect(Math.round(rep.y)).toBe(20);
    expect(rep.hp).toBe(wolf.hp);
  });

  it('a member\'s blow is a claim: the host\'s creature loses the life, and the member sees it on the next snapshot', async () => {
    const { a, b, run } = rig();
    const wolf = a.sys.place('w:1,1', { ...calm(), hp: 200 }, 40, 0); wolf.wait = 1e9;
    await run(.3);
    const rep = b.sys.mobs[0];
    b.sys.wound(rep, 30);
    expect(rep.hp).toBe(200);                                       // nothing changes on the member's own say-so
    await run(.4);
    expect(wolf.hp).toBe(170);
    expect(b.sys.mobs[0].hp).toBe(170);
  });

  it('the host\'s creature hunts the member and its bite lands through the member\'s own defenses', async () => {
    const { a, b, run } = rig();
    b.me.x = 30;
    const wolf = a.sys.place('w:2,2', MOBS['ash-wolf'], 46, 0);
    await run(2);
    expect(b.hurt.length).toBeGreaterThan(0);
    expect(a.hurt.length).toBe(0);
    expect(wolf.coopBy?.has('B')).toBeTrue();
    // The member's own Dark Ward drinks part of it: its side, its rules.
    const before = b.hurt.reduce((n, x) => n + x, 0);
    b.sys.ward = 1e6;
    await run(2);
    expect(b.hurt.reduce((n, x) => n + x, 0)).toBe(before);
  });

  it('one kill pays each once: the member that fought it in full (its own spoils), the host as its own', async () => {
    const { a, b, run } = rig();
    const wolf = a.sys.place('w:3,3', { ...calm(), hp: 60 }, 40, 0); wolf.wait = 1e9;
    await run(.3);
    b.sys.wound(b.sys.mobs[0], 20);
    await run(.3);
    a.sys.wound(wolf, 100);                                         // the host fells it
    await run(.5);
    expect(a.kills.length).toBe(1);
    expect(a.kills[0].coop).toBeUndefined();
    expect(b.rewards).toEqual(['full']);
    expect(b.kills.length).toBe(1);
    expect(b.kills[0].coop).toBeTrue();
    expect(b.kills[0].creature).toBe('ash-wolf');
    expect(b.sys.mobs.length).toBe(0);
    await run(1);
    expect(b.kills.length).toBe(1);
  });

  it('a member that only stood by gets the share (no spoils here); a host that only stood by gets the share too', async () => {
    const { a, b, run } = rig();
    const w1 = a.sys.place('w:4,4', calm(), 40, 0); w1.wait = 1e9;
    await run(.3);
    a.sys.wound(w1, 999);
    await run(.3);
    expect(b.rewards).toEqual(['share']);
    expect(b.kills.length).toBe(0);
    const w2 = a.sys.place('w:5,5', calm(), 40, 0); w2.wait = 1e9;
    await run(.3);
    b.sys.wound(b.sys.mobs[0], 999);
    await run(.5);
    expect(a.kills.at(-1)!.share).toBeTrue();
    expect(b.rewards.at(-1)).toBe('full');
  });

  it('a boss grows +60% for the member present, and back when it is alone again', async () => {
    const { a, elect, run } = rig();
    const def = { ...MOBS['magma-tyrant'], sight: 0 };
    const boss = a.sys.place('boss', def, 40, 0); boss.wait = 1e9;
    const base = boss.def.hp;
    await run(.2);
    expect(boss.def.hp).toBe(coopBossLife(base, 2));
    expect(boss.hp).toBe(coopBossLife(base, 2));
    a.sys.wound(boss, Math.round(boss.def.hp / 2));
    elect({ 'ember-isle': { host: 'A', term: 1, members: ['A'] } });
    await run(.1);
    expect(boss.def.hp).toBe(base);
    expect(boss.hp).toBe(Math.round(base / 2));
  });

  it('host migration: the member becomes host, keeps the creatures as they were, and their minds wake', async () => {
    const { a, b, elect, run, roles } = rig();
    const wolf = a.sys.place('w:6,6', { ...MOBS['ash-wolf'], hp: 300 }, 150, 0);
    a.sys.wound(wolf, 100);
    await run(.4);
    const id = wolf.nid!;
    expect(b.sys.mobs[0].hp).toBe(200);
    // A leaves: the room names B.
    elect({ 'ember-isle': { host: 'B', term: 2, members: ['B'] } });
    await run(.1);
    expect(roles()[1]).toBe('solo');
    expect(b.sys.replica).toBeFalse();
    const adopted = b.sys.mobs.find(m => m.nid === id)!;
    expect(adopted).toBeDefined();
    expect(adopted.hp).toBe(200);
    expect(adopted.key).toBe('w:6,6');
    // It hunts B now (its sight is its kind's own).
    b.me.x = 120;
    const x0 = adopted.x;
    await run(1.5);
    expect(adopted.x).toBeLessThan(x0);
    expect(b.hurt.length).toBeGreaterThan(0);
  });

  it('the host is only an id in the election: a room-run world ("@room", no player) drives a member unchanged', async () => {
    const { a, b, elect, run } = rig();
    elect({ 'ember-isle': { host: '@room', term: 7, members: ['A', 'B'] } });
    await run(.1);
    expect([a.coop.role, b.coop.role]).toEqual(['member', 'member']);
    // A world simulated elsewhere (here: another MobSystem standing in for the room's) streams as '@room'.
    const world = new MobSystem({ options: {} as EngineOptions, walkable: () => true, levelId: () => 'surface', player: () => ({ x: 1e6, y: 1e6 }), hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined });
    world.selfAway = true;
    const sent: CoopSnapBody[] = [];
    const room = new TdCoop(world, { send: async body => { sent.push(body); return true; }, claim: async () => true, killed: () => 'none', now: () => 0, phase: () => 'day', still: () => false });
    room.setAreas({ 'ember-isle': { host: '@room', term: 7, members: ['@room', 'A', 'B'] } }, '@room', ['A', 'B']);
    const wolf = world.place('w:9,9', calm(), 40, 0); wolf.wait = 1e9;
    room.before(.2, 'ember-isle', [{ id: 'B', x: 0, y: 0 }]);
    room.after(.2);
    await Promise.resolve();
    b.coop.snap({ ...sent[0], from: '@room', term: 7 });
    expect(b.sys.mobs.map(m => m.nid)).toEqual([wolf.nid!]);
    // B's blow becomes a claim addressed to whoever hosts: the room would weigh it exactly as a player host does.
    b.sys.wound(b.sys.mobs[0], 5);
    await run(.2);
    room.hits({ from: 'B', area: 'ember-isle', x: 0, y: 0, level: 20, hits: [{ i: wolf.nid!, d: 5, el: 'physical' }] });
    expect(wolf.hp).toBe(wolf.def.hp - 5);
  });

  // Owner 2026-10-26: "mobs appear and then disappear, or bug out, when going in and out of dungeons".
  it('stepping into a dungeon: the last area\'s creatures leave at once, a late snapshot of it is refused, nothing is adopted', async () => {
    const { a, b, run } = rig();
    const wolf = a.sys.place('w:1,1', calm(), 60, 20); wolf.wait = 1e9;
    await run(.3);
    expect(b.sys.mobs.length).toBe(1);
    // B takes the stair down; a whole snapshot of the island was still in flight.
    b.sys.enterLevel([]);
    b.coop.left('ember-mine-1');
    b.coop.snap({ area: 'ember-isle', from: 'A', term: 1, seq: 99, kf: true, mobs: [{ i: 'z', t: 'ash-wolf', x: 5, y: 5, f: 1, h: 30, m: 30, l: 3, e: null, tl: 0, ax: 0, ay: 0, fl: 0 }], gone: [], ev: [] } as unknown as CoopSnapMsg);
    expect(b.sys.mobs.length).toBe(0);
    expect(b.sys.replica).toBeFalse();
    // Its own creatures of the dungeon are its own, at full life, and nothing of the island came along.
    const own = b.sys.place('mine-wolf', MOBS['ash-wolf'], 10, 10);
    b.coop.before(1 / 60, 'ember-mine-1', []);
    expect(b.coop.role).toBe('solo');
    expect(b.sys.mobs).toEqual([own]);
    expect(own.hp).toBe(MOBS['ash-wolf'].hp);
  });

  it('back out onto a room-run island: the room is the host at once (no creatures of its own), and its listing changes nothing', () => {
    const sys = new MobSystem({ options: {} as EngineOptions, walkable: () => true, levelId: () => 'surface', player: () => ({ x: 0, y: 0 }), hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined });
    let clock = 0;
    const coop = new TdCoop(sys, { send: async () => true, claim: async () => true, killed: () => 'none', now: () => clock, phase: () => 'day', still: () => false });
    // In the dungeon: the room lists nothing for this Keeper, but it runs the world.
    coop.setAreas({}, 'B', [], true);
    coop.before(1 / 60, 'ember-mine-1', []);
    expect(coop.role).toBe('solo');
    coop.left('ember-isle');
    coop.before(1 / 60, 'ember-isle', []);
    expect(coop.role).toBe('member');
    expect(sys.replica).toBeTrue();
    // The room's snapshot lands on the expected host; then its listing arrives: no reset, the replica stays.
    coop.snap({ area: 'ember-isle', from: '@room', term: -1, seq: 1, kf: true, mobs: [{ i: 'a', t: 'ash-wolf', x: 5, y: 5, f: 1, h: 30, m: 30, l: 3, e: null, tl: 0, ax: 0, ay: 0, fl: 0 }], gone: [], ev: [] } as unknown as CoopSnapMsg);
    expect(sys.mobs.length).toBe(1);
    coop.setAreas({ 'ember-isle': { host: '@room', term: 4, members: ['B'] } }, 'B', [], true);
    clock += 16; coop.before(1 / 60, 'ember-isle', []);
    expect(coop.role).toBe('member');
    expect(sys.mobs.length).toBe(1);
  });

  it('a room that never lists this Keeper in a world area: after a few seconds it is solo there, as before', () => {
    const sys = new MobSystem({ options: {} as EngineOptions, walkable: () => true, levelId: () => 'surface', player: () => ({ x: 0, y: 0 }), hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined });
    let clock = 0;
    const coop = new TdCoop(sys, { send: async () => true, claim: async () => true, killed: () => 'none', now: () => clock, phase: () => 'day', still: () => false });
    coop.setAreas({}, 'B', [], true);
    coop.before(1 / 60, 'ember-isle', []);
    expect(coop.role).toBe('member');
    clock += 6000;
    coop.before(1 / 60, 'ember-isle', []);
    expect(coop.role).toBe('solo');
    expect(sys.replica).toBeFalse();
  });

  // The Sexton's Count online ("the key just won't drop"): the Row-Walker is raised by the Keeper's own screen for the
  // chain's step, which the room cannot see. On a member it stood frozen and took no blow (its claims named no room
  // creature), so the 'key' fact was never recorded. A personal creature is simulated, wounded and felled here.
  describe('personal creatures (a quest foe the room never sees)', () => {
    const raise = (b: Side, personal: boolean) => {
      const pack = b.sys.spawnPack('sexton:row-walker', MOBS['bone-walker'], 40, 0, makePack('unique', ['extra-strong'], 'Hollis Vane', 1));
      if (personal) for (const m of pack) m.personal = true;
      return pack;
    };

    it('the old way (not personal) reproduces the bug: on a member a local foe takes no blow and never falls', async () => {
      const { b, run, roles } = rig();
      await run(.3);
      expect(roles()).toEqual(['host', 'member']);
      const [walker] = raise(b, false);
      const hp = walker.hp;
      b.sys.wound(walker, hp + 50);
      await run(.3);
      expect(walker.hp).toBe(hp);
      expect(b.kills.length).toBe(0);
    });

    it('a member fells its own Row-Walker: the blow lands here, the kill is its own (the host credits the key), with loot', async () => {
      const { a, b, run } = rig();
      await run(.3);
      expect(b.coop.role).toBe('member');
      const [walker, follower] = raise(b, true);
      expect(follower.personal).toBeTrue();
      await run(.3);
      // Snapshots from the room do not sweep it, and the host never hears of it.
      expect(b.sys.mobs).toContain(walker);
      expect(a.sys.mobs.some(m => m.key.startsWith('sexton:'))).toBeFalse();
      b.sys.wound(walker, walker.hp + 50);
      await run(.1);
      expect(b.sys.mobs).not.toContain(walker);
      const kill = b.kills.find(k => k.creature === 'bone-walker');
      expect(kill).toBeDefined();
      expect(kill!.id).toMatch(/^td:surface:sexton:row-walker:/);  // side-scroller hunted(): sextonSaw({ kind: 'walker' })
      expect(kill!.share).toBeUndefined();
      expect(kill!.coop).toBeUndefined();
      expect(b.sys.drops.length).toBeGreaterThan(0);               // its Gold and materials lie here, this Keeper's own
    });

    it('a personal foe moves and bites the member on its own screen', async () => {
      const { b, run } = rig();
      await run(.3);
      b.me.x = 30;
      raise(b, true);
      await run(3);
      expect(b.hurt.length).toBeGreaterThan(0);
    });
  });
});
