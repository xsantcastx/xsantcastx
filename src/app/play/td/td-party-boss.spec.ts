import { MECH, PARTY_FORMS, newPartyState, partyStep, type PartyArena, type PartyKeeper, type PartyMark } from './td-party-boss';

/** A stand-in arena: Keepers where the test puts them, every blow and mark written down. */
function arena(ks: PartyKeeper[], o: { stopped?: () => boolean } = {}) {
  const hits: { id: string; n: number; type: string; st?: string }[] = [], marks: PartyMark[] = [], heals: number[] = [], adds: string[] = [];
  const A: PartyArena = {
    keepers: () => ks, strike: (k, n, type, st) => hits.push({ id: k.id, n, type, ...(st ? { st: st.s } : {}) }), ring: () => undefined, mark: e => marks.push(e),
    say: () => undefined, adds: type => adds.push(type), heal: n => heals.push(n), stopped: o.stopped ?? (() => false), rng: () => .3, cadence: 1,
  };
  return { A, hits, marks, heals, adds };
}
const boss = (hp = 1, max = 1) => ({ x: 0, y: 0, hp, def: { hp: max, dmg: [90, 110] as [number, number], level: 42 } });
const run = (s: ReturnType<typeof newPartyState>, b: ReturnType<typeof boss>, A: PartyArena, secs: number, fix: string | null = 'tank') => { for (let t = 0; t < secs; t += .05) partyStep(s, b, A, .05, fix); };

describe('td-party-boss (S10: the mechanic vocabulary)', () => {
  it('every party form has three phases ending at 0, and the Antlered Storm keeps its arena Wet', () => {
    for (const f of Object.values(PARTY_FORMS)) { expect(f.phases.length).toBe(3); expect(f.phases[2].to).toBe(0); }
    expect(PARTY_FORMS['antlered-storm'].wet).toBeTrue();
  });

  it('a soak is split among those inside; empty, it strikes everyone', () => {
    const ks = [{ id: 'tank', self: false, x: 0, y: 0 }, { id: 'dps', self: false, x: 8, y: 0 }, { id: 'heal', self: false, x: 200, y: 0 }];
    const s = newPartyState(PARTY_FORMS['anvil-warden']), r = arena(ks);
    run(s, boss(.2), r.A, 9.5);
    const soak = r.hits.filter(h => h.type === 'physical');
    expect(s.stats.soaked).toBeGreaterThan(0);
    // 4B split two ways: each takes 2B (B = 100), the healer far away nothing.
    expect(soak.find(h => h.id === 'tank')!.n).toBeCloseTo(MECH.soakB * 100 / 2, 0);
    expect(soak.some(h => h.id === 'heal')).toBeFalse();
  });

  it('a channel nobody stops mends the boss; a stun in it stops it', () => {
    const ks = [{ id: 'tank', self: false, x: 0, y: 0 }, { id: 'heal', self: false, x: 80, y: 0 }];
    const s = newPartyState(PARTY_FORMS['ember-warden']), r = arena(ks);
    run(s, boss(.5), r.A, 6);
    expect(r.heals.length).toBe(1);
    let stun = false;
    const s2 = newPartyState(PARTY_FORMS['ember-warden']), r2 = arena(ks, { stopped: () => stun });
    run(s2, boss(.5), r2.A, 4); stun = true; run(s2, boss(.5), r2.A, 1);
    expect(r2.heals.length).toBe(0);
    expect(s2.stats.interrupted).toBe(1);
  });

  it('a tether snaps past six tiles for 2B each', () => {
    const ks = [{ id: 'a', self: false, x: 0, y: 0 }, { id: 'b', self: false, x: 7 * 16 + 4, y: 0 }];
    const s = newPartyState(PARTY_FORMS['bone-dragon']), r = arena(ks);
    run(s, boss(.4), r.A, 3);
    expect(s.stats.snapped).toBe(1);
    expect(r.hits.filter(h => h.type === 'lightning').map(h => Math.round(h.n))).toEqual([200, 200]);
    expect(r.marks.some(m => m.m === 'tether' && m.t === 0)).toBeTrue();
  });

  it('spread rings burst on each Keeper standing in another ring', () => {
    const ks = [{ id: 'a', self: false, x: 0, y: 0 }, { id: 'b', self: false, x: 20, y: 0 }, { id: 'c', self: false, x: 300, y: 0 }];
    const s = newPartyState(PARTY_FORMS['the-uncounted']), r = arena(ks);
    run(s, boss(.4), r.A, 5.2);
    expect(s.stats.overlaps).toBe(2);
    expect(r.hits.some(h => h.id === 'c')).toBeFalse();
  });

  it('the Antlered Storm strikes under Keepers as lightning, deeper in its Wet arena', () => {
    const ks = [{ id: 'tank', self: false, x: 0, y: 0 }];
    const s = newPartyState(PARTY_FORMS['antlered-storm']), r = arena(ks);
    run(s, boss(2, 2), r.A, 3.5);
    const bolt = r.hits.find(h => h.type === 'lightning');
    expect(bolt).toBeDefined();
    expect(bolt!.n).toBeCloseTo(1.6 * 100 * MECH.wetLightning, 0);
  });

  // ── S10b ──
  it('the Last Siege: its crossbows at the top threat, its catapult on the healer\'s side, faster on its Last Turn', () => {
    const ks = [{ id: 'tank', self: false, x: 20, y: 0 }, { id: 'heal', self: false, x: -90, y: 10 }];
    const f = PARTY_FORMS['last-siege'];
    expect(f.phases.map(p => p.step)).toEqual([MECH.towerStep, MECH.towerStep, MECH.lastTurnStep]);
    const s = newPartyState(f), r = arena(ks);
    run(s, boss(2, 2), r.A, 3);
    // The volley: three bolts round the tank (0.8B each where they land).
    expect(s.rings.filter(x => x.m === 'volley').length + r.hits.filter(h => h.id === 'tank').length).toBeGreaterThan(0);
    const s2 = newPartyState(f), r2 = arena(ks);
    s2.healed.set('heal', 500);
    run(s2, boss(.5), r2.A, 4.3);
    expect(r2.hits.some(h => h.id === 'heal' && h.type === 'fire')).toBeTrue();
  });

  it('the Fogmother: Wrap chills the one she holds, Gloam Blizzard frosts the farthest, Settle closes the fog', () => {
    const ks = [{ id: 'tank', self: false, x: 16, y: 0 }, { id: 'far', self: false, x: 150, y: 0 }];
    const s = newPartyState(PARTY_FORMS['fogmother']), r = arena(ks);
    run(s, boss(2, 2), r.A, 3.2);
    const wrap = r.hits.find(h => h.id === 'tank' && h.type === 'cold');
    expect(wrap?.st).toBe('chill');
    expect(r.marks.some(m => m.m === 'wrap' && m.a === 'tank')).toBeTrue();
    const s2 = newPartyState(PARTY_FORMS['fogmother']), r2 = arena(ks);
    run(s2, boss(.5), r2.A, 8.5);
    expect(r2.hits.some(h => h.id === 'far' && h.st === 'frost')).toBeTrue();
    const s3 = newPartyState(PARTY_FORMS['fogmother']), r3 = arena(ks);
    run(s3, boss(.2), r3.A, 1);
    expect(r3.marks.some(m => m.m === 'settle')).toBeTrue();
  });
});
