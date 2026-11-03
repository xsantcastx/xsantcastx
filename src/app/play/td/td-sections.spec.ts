/**
 * td-sections.spec.ts — S7, the Infernal Reach as an act (docs/world/campaign.md S7; docs/design/world-acts.md §1.2):
 * the accept-when list, as tests. The room runs each section as its own area; no seam is an invisible wall; every
 * section has one thing to read, one sealed thing and one sound; the walk from Pyrehold's plaza to the Caldera Rim is
 * 12–15 minutes; the hot spots spawn their packs; Garrick Dross's board holds the Verdant ship until the Sovereign falls.
 */
import { CONTINENTS, LEVELS, landOf } from './td-levels';
import { TdWorld } from './td-world';
import { HandLevel, footFree } from './td-level';
import { TILE } from './td-art';
import { REACH_BIBLE, REACH_ROUTE, SEAM_CLEAR, SEAM_PAST, seamArrival, seamPast } from './td-sections';
import { ZONES, zoneOf } from './td-zones';
import { WORLD_AREAS_ALL } from '../world/room-world';
import { hearthsOf } from './td-hearth';
import { buildBoard } from './td-harbour';
import { REACH_I18N } from './td-reach.i18n';

const REACH = Object.keys(CONTINENTS).filter(id => landOf(id) === 'infernal-reach');
const SPEED = 4.6; // tiles a second (world-acts.md §0: td-engine SPEED, before Move Speed)
const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;

describe('S7: the Infernal Reach as an act of sections', () => {
  it('has the nine sections and the two villages, each its own area the room runs', () => {
    expect(REACH.sort()).toEqual(['infernal-reach-ashgrove', 'infernal-reach-badlands', 'infernal-reach-charwood', 'infernal-reach-cinderport', 'infernal-reach-deep-charwood',
      'infernal-reach-molten-fields', 'infernal-reach-pyre-peaks', 'infernal-reach-pyrehold', 'infernal-reach-shore', 'infernal-reach-steppe']);
    for (const id of [...REACH, 'kiln-tunnels-1', 'glass-throat-1', 'glass-throat-2']) {
      expect(WORLD_AREAS_ALL).withContext(id).toContain(id);
      // The Hearth's area grammar (social-server AREA) and the drop and hearth ids keep to [a-z0-9-].
      expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
    }
    expect(CONTINENTS['infernal-reach']).toBeUndefined();
  });

  it('every region of every section has its zone row, inside the act\'s band', () => {
    for (const id of REACH) for (const row of CONTINENTS[id].map) for (const ch of row) {
      const z = zoneOf(`${id}:${ch}`);
      expect(z).withContext(`${id}:${ch}`).not.toBeNull();
      expect(z!.band[0]).toBeGreaterThanOrEqual(8);
      expect(z!.band[1]).toBeLessThanOrEqual(30);
    }
    expect(ZONES['kiln-tunnels-1'].band).toEqual([12, 14]);
    expect(ZONES['glass-throat-1'].band[0]).toBeLessThan(ZONES['glass-throat-2'].band[0]);
  });

  it('every seam is paired, walked through (a gate you can see), and sets the Keeper down 6 tiles inside with nothing near', () => {
    for (const id of REACH) {
      const w = new TdWorld(CONTINENTS[id]);
      for (const sm of CONTINENTS[id].seams ?? []) {
        const far = CONTINENTS[sm.to], back = far?.seams?.find(x => x.id === sm.arrive);
        expect(back).withContext(`${id} ${sm.id}`).toBeDefined();
        expect(back!.to).toBe(id);
        expect(back!.arrive).toBe(sm.id);
        const [dc, dr] = STEP[sm.dir];
        // The road runs on through the gate, and stepping onto it past the line crosses.
        for (let k = 0; k <= SEAM_PAST + 2; k++) expect(w.walkable(sm.c + dc * k, sm.r + dr * k)).withContext(`${id} ${sm.id} +${k}`).toBeTrue();
        expect(seamPast(sm, sm.c + dc * SEAM_PAST, sm.r + dr * SEAM_PAST)).toBeTrue();
        expect(seamPast(sm, sm.c, sm.r)).toBeFalse();
        // The gate stands in the land's edge: rock or sea past the cut on both sides (its ragged face crosses too: SEAM_SIDE).
        for (const side of [-12, 12]) {
          const c = sm.c + dc * 10 + (dc ? 0 : side), r = sm.r + dr * 10 + (dr ? 0 : side);
          expect(w.walkable(c, r)).withContext(`${id} ${sm.id} beside the cut (${c},${r}) ${w.ground(c, r)}`).toBeFalse();
        }
        // The arrival rule, on the far side.
        const fw = new TdWorld(far), a = seamArrival(back!);
        expect(footFree(fw, a.c * TILE + TILE / 2, a.r * TILE + TILE - 2)).withContext(`${sm.to} arrival`).toBeTrue();
        const near = fw.spawnsIn((a.c - 12) * TILE, (a.r - 12) * TILE, (a.c + 12) * TILE, (a.r + 12) * TILE).filter(s => Math.hypot(s.x / TILE - a.c, s.y / TILE - a.r) <= SEAM_CLEAR);
        expect(near.map(s => s.key)).withContext(`${sm.to} arrival from ${id}`).toEqual([]);
      }
    }
  });

  it('every section and connector floor has one thing to read, one sealed thing and one sound (the zone bible\'s check)', () => {
    for (const area of [...REACH, 'kiln-tunnels-1', 'glass-throat-1', 'glass-throat-2']) {
      const b = REACH_BIBLE[area];
      expect(b).withContext(area).toBeDefined();
      const stalls = CONTINENTS[area] ? new TdWorld(CONTINENTS[area]).stalls : new HandLevel(LEVELS[area]).stalls;
      expect(stalls.some(s => s.station.id === b.read)).withContext(`${area} read`).toBeTrue();
      expect(stalls.some(s => s.station.id === b.sealed)).withContext(`${area} sealed`).toBeTrue();
      expect(REACH_I18N[`reach.read.${b.read.slice(5)}`]?.en).withContext(b.read).toBeTruthy();
      expect(REACH_I18N[`reach.sealed.${b.sealed.slice(7)}`]?.es).withContext(b.sealed).toBeTruthy();
      expect(b.sound.every[0]).toBeGreaterThan(0);
    }
  });

  it('one Waystone a section, each on safe ground with a hearth only in the towns', () => {
    const ids = REACH.map(id => CONTINENTS[id].stone?.id);
    expect(ids.every(Boolean)).toBeTrue();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of REACH) {
      const w = new TdWorld(CONTINENTS[id]), st = w.stalls.find(s => s.station.id === `tdstone:${CONTINENTS[id].stone!.id}`)!;
      expect(st).withContext(id).toBeDefined();
      expect(w.safeAt(Math.floor(st.x / TILE), Math.floor(st.y / TILE) - 1)).withContext(id).toBeTrue();
      const camp = CONTINENTS[id].townKind === 'camp';
      expect(hearthsOf(w).length).withContext(id).toBe(camp ? 0 : 1);
      expect(hearthsOf(w).some(h => !!h.shrine)).withContext(id).toBe(id === 'infernal-reach-pyrehold');
    }
  });

  it('the connectors are the only ways on, and their far mouths open onto the next section', () => {
    const exits = (id: string) => [...new HandLevel(LEVELS[id]).exits.values()];
    expect(exits('kiln-tunnels-1').map(e => e.continent).sort()).toEqual(['infernal-reach-charwood', 'infernal-reach-deep-charwood']);
    expect(exits('glass-throat-1').some(e => e.continent === 'infernal-reach-badlands')).toBeTrue();
    expect(exits('glass-throat-2').some(e => e.continent === 'infernal-reach-molten-fields')).toBeTrue();
    // No seam joins the Charwood to the Deep Charwood, nor the Badlands to the Molten Fields.
    const joins = (a: string, b: string) => (CONTINENTS[a].seams ?? []).some(s => s.to === b);
    expect(joins('infernal-reach-charwood', 'infernal-reach-deep-charwood')).toBeFalse();
    expect(joins('infernal-reach-badlands', 'infernal-reach-molten-fields')).toBeFalse();
  });

  it('the walk from Pyrehold\'s plaza to the Caldera Rim is 12–15 minutes, no fighting', () => {
    let tiles = 0;
    for (const step of REACH_ROUTE) {
      const def = CONTINENTS[step.area];
      if (def) { const r = def.roads[0]; for (let i = 1; i < r.length; i++) tiles += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); continue; }
      const lv = new HandLevel(LEVELS[step.area]);
      const at = (id: string) => { const s = lv.stalls.find(x => x.station.id === id)!; return [Math.floor(s.x / TILE), Math.floor((s.y - 7) / TILE)] as const; };
      const [sc, sr] = at(step.from!), [tc, tr] = at(step.to!);
      const dist = new Map<string, number>([[`${sc},${sr}`, 0]]), q: (readonly [number, number])[] = [[sc, sr]];
      while (q.length) {
        const [c, r] = q.shift()!;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const k = `${c + dc},${r + dr}`;
          if (dist.has(k) || !(lv.walkable(c + dc, r + dr) || (c + dc === tc && r + dr === tr))) continue;
          dist.set(k, dist.get(`${c},${r}`)! + 1); q.push([c + dc, r + dr]);
        }
      }
      expect(dist.has(`${tc},${tr}`)).withContext(`${step.area} crossable`).toBeTrue();
      tiles += dist.get(`${tc},${tr}`)! * .9; // a 4-way count, eased toward the 8-way walk
    }
    const minutes = tiles / SPEED / 60;
    expect(minutes).toBeGreaterThanOrEqual(12);
    expect(minutes).toBeLessThanOrEqual(15);
  });

  it('the hot spots stand off the road with their packs: a camp, a den (a unique pack), a champion ground', () => {
    const want: Readonly<Record<string, { id: string; prefix: string; n: number }>> = {
      'infernal-reach-deep-charwood': { id: 'kettle', prefix: 'camp', n: 11 },
      'infernal-reach-badlands': { id: 'scorch-rings', prefix: 'cg', n: 6 },
      'infernal-reach-molten-fields': { id: 'drake-nests', prefix: 'den', n: 1 },
      'infernal-reach-pyre-peaks': { id: 'last-cairn', prefix: 'camp', n: 10 },
    };
    for (const [area, k] of Object.entries(want)) {
      const def = CONTINENTS[area], w = new TdWorld(def), camp = def.camps!.find(c => c.id === k.id)!;
      const sp = w.spawnsIn((camp.c - 20) * TILE, (camp.r - 20) * TILE, (camp.c + 20) * TILE, (camp.r + 20) * TILE).filter(s => s.key.startsWith(`${k.prefix}:${k.id}:`));
      expect(sp.length).withContext(area).toBe(k.n);
      for (const s of sp) expect(s.level).withContext(s.key).toBeDefined();
      // Off the road (world-acts.md §2: "never on it, so a traveller can pass"): every road stays 8 tiles or more from its heart.
      for (const road of def.roads) for (let i = 1; i < road.length; i++) {
        const [x0, y0] = road[i - 1], [x1, y1] = road[i], L = Math.hypot(x1 - x0, y1 - y0) || 1;
        const t = Math.max(0, Math.min(1, ((camp.c - x0) * (x1 - x0) + (camp.r - y0) * (y1 - y0)) / (L * L)));
        expect(Math.hypot(camp.c - (x0 + (x1 - x0) * t), camp.r - (y0 + (y1 - y0) * t))).withContext(`${area} road ${i}`).toBeGreaterThanOrEqual(8);
      }
      expect(w.placeName(camp.c * TILE, camp.r * TILE)).toBe(camp.name);
    }
  });

  it('Garrick Dross\'s board holds the Verdant ship until the Cinder Sovereign falls (the end of Act I)', () => {
    const base = { continents: CONTINENTS, level: 20, gold: 1e6 };
    const before = buildBoard('pyrehold', base).find(r => r.destPier === 'mossharbor')!;
    expect(before.state).toBe('locked');
    expect(before.gate).toBe('cinder-sovereign');
    expect(buildBoard('pyrehold', { ...base, cleared: new Set(['cinder-sovereign']) }).find(r => r.destPier === 'mossharbor')!.state).toBe('ok');
    // Back to Ember Isle is never locked; the Isle sails to Pyrehold as before.
    expect(buildBoard('pyrehold', base).find(r => r.destPier === 'ember-harbour')!.state).toBe('ok');
    expect(buildBoard('ember-harbour', base).find(r => r.destPier === 'pyrehold')!.to).toBe('infernal-reach-pyrehold');
  });
});
