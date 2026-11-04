/**
 * td-wilds.spec.ts — S11, the Verdant Wilds as an act (docs/world/campaign.md S11; docs/design/world-acts.md §1.3, §2.3,
 * §5.3): the accept-when list, as tests. Each section is its own area; no seam is an invisible wall; every section and
 * every Root Hollows floor has one thing to read, one sealed thing and one sound; the Root Hollows are the only way into
 * the Deep Wilds (the Greenwood's road is grown shut); Mossharbor to the temple gate is 12–15 minutes; the hot spots
 * spawn their packs; the Walking Tree moves only while unseen and pays once a night.
 */
import { CONTINENTS, LEVELS, landOf } from './td-levels';
import { TdWorld } from './td-world';
import { HandLevel, footFree } from './td-level';
import { TILE } from './td-art';
import { SEAM_CLEAR, SEAM_PAST, WILDS_BIBLE, WILDS_ROUTE, seamArrival, seamPast } from './td-sections';
import { zoneOf } from './td-zones';
import { WORLD_AREAS_ALL } from '../world/room-world';
import { hearthsOf } from './td-hearth';
import { buildBoard } from './td-harbour';
import { WILDS_I18N } from './td-wilds.i18n';
import { NIGHT_PLACES, NightEvents, WALKER_AREA } from './td-night-events';
import { NIGHT_REWARDS, WALKER, nightEventsAt, nightSpan } from '../../shared/night-events/night-events.model';
import { WORLD_BOSSES } from '../world/world-bosses';

const WILDS = Object.keys(CONTINENTS).filter(id => landOf(id) === 'verdant-wilds');
const HOLLOWS = ['root-hollows-1', 'root-hollows-2', 'root-hollows-3'];
const SPEED = 4.6; // tiles a second (world-acts.md §0: td-engine SPEED, before Move Speed)
const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;

describe('S11: the Verdant Wilds as an act of sections', () => {
  it('has the seven sections and Rootglass, each its own area the room runs; the old single area is gone', () => {
    expect(WILDS.sort()).toEqual(['verdant-wilds-courts', 'verdant-wilds-deep-wilds', 'verdant-wilds-fernglades', 'verdant-wilds-glassmere',
      'verdant-wilds-greenwood', 'verdant-wilds-rootglass', 'verdant-wilds-rootwater', 'verdant-wilds-shore']);
    for (const id of [...WILDS, ...HOLLOWS]) {
      expect(WORLD_AREAS_ALL).withContext(id).toContain(id);
      expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
    }
    expect(CONTINENTS['verdant-wilds']).toBeUndefined();
  });

  it('every region of every section has its zone row, inside the act\'s band', () => {
    for (const id of WILDS) for (const row of CONTINENTS[id].map) for (const ch of row) {
      const z = zoneOf(`${id}:${ch}`);
      expect(z).withContext(`${id}:${ch}`).not.toBeNull();
      expect(z!.band[0]).toBeGreaterThanOrEqual(15);
      expect(z!.band[1]).toBeLessThanOrEqual(40);
    }
  });

  it('every seam is paired, walked through (a gate in the wood\'s wall), and sets the Keeper down 6 tiles inside with nothing near', () => {
    for (const id of WILDS) {
      const w = new TdWorld(CONTINENTS[id]);
      for (const sm of CONTINENTS[id].seams ?? []) {
        const far = CONTINENTS[sm.to], back = far?.seams?.find(x => x.id === sm.arrive);
        expect(back).withContext(`${id} ${sm.id}`).toBeDefined();
        expect(back!.to).toBe(id);
        expect(back!.arrive).toBe(sm.id);
        const [dc, dr] = STEP[sm.dir];
        for (let k = 0; k <= SEAM_PAST + 2; k++) expect(w.walkable(sm.c + dc * k, sm.r + dr * k)).withContext(`${id} ${sm.id} +${k} ${w.ground(sm.c + dc * k, sm.r + dr * k)}`).toBeTrue();
        expect(seamPast(sm, sm.c + dc * SEAM_PAST, sm.r + dr * SEAM_PAST)).toBeTrue();
        expect(seamPast(sm, sm.c, sm.r)).toBeFalse();
        for (const side of [-12, 12]) {
          const c = sm.c + dc * 10 + (dc ? 0 : side), r = sm.r + dr * 10 + (dr ? 0 : side);
          expect(w.walkable(c, r)).withContext(`${id} ${sm.id} beside the cut (${c},${r}) ${w.ground(c, r)}`).toBeFalse();
          expect(w.ground(c, r)).withContext(`${id} ${sm.id}: the wood's wall`).toBe('vinewall');
        }
        const fw = new TdWorld(far), a = seamArrival(back!);
        expect(footFree(fw, a.c * TILE + TILE / 2, a.r * TILE + TILE - 2)).withContext(`${sm.to} arrival`).toBeTrue();
        const near = fw.spawnsIn((a.c - 12) * TILE, (a.r - 12) * TILE, (a.c + 12) * TILE, (a.r + 12) * TILE).filter(s => Math.hypot(s.x / TILE - a.c, s.y / TILE - a.r) <= SEAM_CLEAR);
        expect(near.map(s => s.key)).withContext(`${sm.to} arrival from ${id}`).toEqual([]);
      }
    }
  });

  it('every section and Root Hollows floor has one thing to read, one sealed thing and one sound (the zone bible\'s check)', () => {
    for (const area of [...WILDS, ...HOLLOWS]) {
      const b = WILDS_BIBLE[area];
      expect(b).withContext(area).toBeDefined();
      const stalls = CONTINENTS[area] ? new TdWorld(CONTINENTS[area]).stalls : new HandLevel(LEVELS[area]).stalls;
      expect(stalls.some(s => s.station.id === b.read)).withContext(`${area} read`).toBeTrue();
      expect(stalls.some(s => s.station.id === b.sealed)).withContext(`${area} sealed`).toBeTrue();
      expect(WILDS_I18N[`reach.read.${b.read.slice(5)}`]?.en).withContext(b.read).toBeTruthy();
      expect(WILDS_I18N[`reach.read.${b.read.slice(5)}`]?.es).withContext(b.read).toBeTruthy();
      expect(WILDS_I18N[`reach.sealed.${b.sealed.slice(7)}`]?.es).withContext(b.sealed).toBeTruthy();
      expect(b.sound.every[0]).toBeGreaterThan(0);
    }
  });

  it('every mark stands on open ground a Keeper can reach (never in the wood\'s wall)', () => {
    for (const id of WILDS) {
      const w = new TdWorld(CONTINENTS[id]);
      for (const mk of CONTINENTS[id].marks ?? []) {
        // Beside it (the tile in front, or one either side) is walkable ground.
        const open = [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 2]].some(([dc, dr]) => w.walkable(mk.c + dc, mk.r + dr));
        expect(open).withContext(`${id} ${mk.id} at ${mk.c},${mk.r}: ${w.ground(mk.c, mk.r + 1)}`).toBeTrue();
      }
    }
  });

  it('one Waystone a section, each on safe ground with a hearth only in the towns (Rootglass has the Shrine)', () => {
    const ids = WILDS.map(id => CONTINENTS[id].stone?.id);
    expect(ids.every(Boolean)).toBeTrue();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of WILDS) {
      const w = new TdWorld(CONTINENTS[id]), st = w.stalls.find(s => s.station.id === `tdstone:${CONTINENTS[id].stone!.id}`)!;
      expect(st).withContext(id).toBeDefined();
      expect(w.safeAt(Math.floor(st.x / TILE), Math.floor(st.y / TILE) - 1)).withContext(id).toBeTrue();
      // A camp has no hearth; the Shore and the Fernglades have their villages' (Mossharbor, Thornwick); Rootglass its own.
      const villages = (CONTINENTS[id].villages ?? []).length, camp = CONTINENTS[id].townKind === 'camp';
      expect(hearthsOf(w).length).withContext(id).toBe((camp ? 0 : 1) + villages);
      expect(hearthsOf(w).some(h => !!h.shrine)).withContext(id).toBe(id === 'verdant-wilds-rootglass');
    }
  });

  it('the Root Hollows are the only way into the Deep Wilds: in by the Greenwood\'s root-hole, out up the −3 root-ramp', () => {
    const exits = (id: string) => [...new HandLevel(LEVELS[id]).exits.values()];
    expect(exits('root-hollows-1')).toContain({ to: 'surface', arrive: 'root-hollows', continent: 'verdant-wilds-greenwood' });
    expect(exits('root-hollows-3')).toContain({ to: 'surface', arrive: 'wilds-ramp', continent: 'verdant-wilds-deep-wilds' });
    const green = new TdWorld(CONTINENTS['verdant-wilds-greenwood']), deep = new TdWorld(CONTINENTS['verdant-wilds-deep-wilds']);
    expect(green.ways.get('root-hollows')).toEqual({ to: 'root-hollows-1', arrive: 'hollows-out', ship: false });
    expect(deep.ways.get('wilds-ramp')).toEqual({ to: 'root-hollows-3', arrive: 'hollows3-ramp', ship: false });
    // No seam joins the Deep Wilds to anything but the Courts.
    for (const id of WILDS) for (const sm of CONTINENTS[id].seams ?? []) if (sm.to === 'verdant-wilds-deep-wilds') expect(id).toBe('verdant-wilds-courts');
  });

  it('the thorn hedge shuts the Greenwood\'s old road: its cut is blocked from wall to wall', () => {
    const def = CONTINENTS['verdant-wilds-greenwood'], w = new TdWorld(def), hedge = def.marks!.find(m => m.id === 'sealed:thorn-hedge')!;
    expect(hedge.look).toBe('hedge');
    // Its deepest row stands between the wall's guaranteed faces: nothing walks past it, beside the road or on it.
    const deep = hedge.r + (hedge.span!.rows - 1) * hedge.span!.dir;
    for (let c = hedge.c - 8; c <= hedge.c + 8; c++) expect(w.walkable(c, deep)).withContext(`${c},${deep} ${w.ground(c, deep)}`).toBeFalse();
    // Every road tile of the cut is thorns, mouth to back.
    for (let k = 0; k < hedge.span!.rows; k++) for (let d = -1; d <= 1; d++) expect(w.walkable(hedge.c + d, hedge.r + k * hedge.span!.dir)).withContext(`thorns ${d},${k}`).toBeFalse();
    // The road runs up to it (a road you can see grown shut), and the cairn beside it can be read.
    expect(w.walkable(hedge.c, hedge.r + 1)).toBeTrue();
    expect(w.walkable(hedge.c, hedge.r + 6)).toBeTrue();
    expect(WILDS_I18N['reach.read.hedge-cairn'].en).toContain('The wood closes what it forgets.');
    expect(WILDS_I18N['reach.read.hedge-cairn'].es).toContain('El bosque cierra lo que olvida.');
  });

  it('the walk from Mossharbor\'s pier to the Overgrown Temple\'s gate is 12–15 minutes, no fighting', () => {
    let tiles = 0;
    for (const step of WILDS_ROUTE) {
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
      tiles += dist.get(`${tc},${tr}`)! * .9;
    }
    const minutes = tiles / SPEED / 60;
    expect(minutes).toBeGreaterThanOrEqual(12);
    expect(minutes).toBeLessThanOrEqual(15);
  });

  it('the hot spots stand off the road in their own clearings: a den (a unique pack), a champion ground, a camp', () => {
    const want: Readonly<Record<string, { id: string; prefix: string; n: number }>> = {
      'verdant-wilds-greenwood': { id: 'weaver-canopy', prefix: 'den', n: 1 },
      'verdant-wilds-deep-wilds': { id: 'hart-meadow', prefix: 'cg', n: 6 },
      'verdant-wilds-courts': { id: 'bell-less-square', prefix: 'camp', n: 11 },
    };
    for (const [area, k] of Object.entries(want)) {
      const def = CONTINENTS[area], w = new TdWorld(def), camp = def.camps!.find(c => c.id === k.id)!;
      const all = w.spawnsIn((camp.c - 24) * TILE, (camp.r - 24) * TILE, (camp.c + 24) * TILE, (camp.r + 24) * TILE);
      const sp = all.filter(s => s.key.startsWith(`${k.prefix}:${k.id}:`));
      expect(sp.length).withContext(area).toBe(k.n);
      // No other pack within 18 tiles of its heart (the Director's S7 rule).
      const others = all.filter(s => !s.key.startsWith(`${k.prefix}:${k.id}:`) && Math.hypot(s.x / TILE - camp.c, s.y / TILE - camp.r) < 18);
      expect(others.map(s => s.key)).withContext(`${area} others`).toEqual([]);
      for (const road of def.roads) for (let i = 1; i < road.length; i++) {
        const [x0, y0] = road[i - 1], [x1, y1] = road[i], L = Math.hypot(x1 - x0, y1 - y0) || 1;
        const t = Math.max(0, Math.min(1, ((camp.c - x0) * (x1 - x0) + (camp.r - y0) * (y1 - y0)) / (L * L)));
        expect(Math.hypot(camp.c - (x0 + (x1 - x0) * t), camp.r - (y0 + (y1 - y0) * t))).withContext(`${area} road ${i}`).toBeGreaterThanOrEqual(8);
      }
      expect(w.placeName(camp.c * TILE, camp.r * TILE)).toBe(camp.name);
    }
  });

  it('the old ways still land: ships at Mossharbor, the temple\'s gate in the Courts, the Copied Hart in the Deep Wilds', () => {
    const shore = new TdWorld(CONTINENTS['verdant-wilds-shore']);
    expect(shore.ways.get('ship-mossharbor')).toEqual({ to: 'infernal-reach-pyrehold', arrive: 'ship-verdant', ship: true });
    expect(new TdWorld(CONTINENTS['infernal-reach-pyrehold']).ways.get('ship-verdant')?.to).toBe('verdant-wilds-shore');
    expect(new TdWorld(CONTINENTS['ember-isle']).ways.get('ship-isle-verdant')?.to).toBe('verdant-wilds-shore');
    expect(new TdWorld(CONTINENTS['verdant-wilds-courts']).ways.get('overgrown-temple')).toEqual({ to: 'overgrown-temple-1', arrive: 'temple-out', ship: false });
    expect([...new HandLevel(LEVELS['overgrown-temple-1']).exits.values()].some(e => e.continent === 'verdant-wilds-courts')).toBeTrue();
    expect(WORLD_BOSSES.find(b => b.id === 'the-copied-hart')!.area).toBe('verdant-wilds-deep-wilds');
    expect(CONTINENTS['verdant-wilds-courts'].places.some(p => p.kind === 'standing-stones' && p.name === 'The Ring of Thorns')).toBeTrue();
    // S10's Storm-Struck Oak stands in the Greenwood, its ring in a clearing off every road and clear of the hot spots.
    const green = CONTINENTS['verdant-wilds-greenwood'], oak = green.places.find(p => p.kind === 'storm-oak')!;
    const storm = WORLD_BOSSES.find(b => b.id === 'antlered-storm')!;
    expect(storm.area).toBe('verdant-wilds-greenwood');
    expect([storm.at!.c, storm.at!.r]).toEqual([oak.c, oak.r]);
    for (const road of green.roads) for (let i = 1; i < road.length; i++) {
      const [x0, y0] = road[i - 1], [x1, y1] = road[i], L = Math.hypot(x1 - x0, y1 - y0) || 1;
      const t = Math.max(0, Math.min(1, ((oak.c - x0) * (x1 - x0) + (oak.r - y0) * (y1 - y0)) / (L * L)));
      expect(Math.hypot(oak.c - (x0 + (x1 - x0) * t), oak.r - (y0 + (y1 - y0) * t))).withContext(`oak road ${i}`).toBeGreaterThanOrEqual(14);
    }
    for (const k of green.camps ?? []) expect(Math.hypot(k.c - oak.c, k.r - oak.r)).toBeGreaterThan(40);
    for (const g of green.glades ?? []) expect(Math.hypot(g.c - oak.c, g.r - oak.r)).toBeGreaterThan(30);
    const gw = new TdWorld(green);
    expect(gw.walkable(oak.c, oak.r + 3)).toBeTrue();
    expect(gw.spawnsIn((oak.c - 14) * TILE, (oak.r - 14) * TILE, (oak.c + 14) * TILE, (oak.r + 14) * TILE).filter(s => Math.hypot(s.x / TILE - oak.c, s.y / TILE - oak.r) < 12).map(s => s.key)).toEqual([]);
  });

  it('Sunny Pell\'s fen-barge holds for Mirewatch until the Elder Rootwyrm falls (the end of Act II)', () => {
    const base = { continents: CONTINENTS, level: 30, gold: 1e6 };
    const before = buildBoard('mossharbor', base).find(r => r.destPier === 'mirewatch')!;
    expect(before.state).toBe('locked');
    expect(before.gate).toBe('elder-rootwyrm');
    expect(buildBoard('mossharbor', { ...base, cleared: new Set(['elder-rootwyrm']) }).find(r => r.destPier === 'mirewatch')!.state).toBe('ok');
    expect(buildBoard('mossharbor', base).find(r => r.destPier === 'pyrehold')!.state).toBe('ok');
  });
});

describe('S11: the Walking Tree (the Greenwood, at night or in fog)', () => {
  const night = 40, ms = nightSpan(night).start + 60_000;
  const glade = { x: NIGHT_PLACES.walker[0] * TILE + TILE / 2, y: NIGHT_PLACES.walker[1] * TILE + TILE - 2 };
  const step = (ev: NightEvents, keeper: { x: number; y: number }, seen: boolean, secs = 1) => {
    const out = [];
    for (let t = 0; t < secs; t += .25) out.push(...ev.update({ ms: ms + t * 1000, area: WALKER_AREA, surface: true, keeper, dt: .25, seen: () => seen }));
    return out;
  };

  it('walks every night in the Greenwood, and nowhere else', () => {
    expect(nightEventsAt(WALKER_AREA, ms).some(e => e.id === 'walking-tree')).toBeTrue();
    expect(nightEventsAt('verdant-wilds-deep-wilds', ms).some(e => e.id === 'walking-tree')).toBeFalse();
  });

  it('moves only while unseen, never within six tiles; after three moves it waits, and one blow pays a copy-seed once', () => {
    const ev = new NightEvents(), near = { x: glade.x + 3 * TILE, y: glade.y };
    // In sight it never moves, however long the Keeper looks.
    step(ev, near, true, 4);
    const home = ev.walker();
    expect([home.x, home.y]).toEqual([glade.x, glade.y]);
    for (let i = 1; i <= WALKER.moves; i++) {
      const was = ev.walker();
      step(ev, { x: glade.x - 40 * TILE, y: glade.y }, false, .5);
      const now = ev.walker();
      expect([now.x, now.y]).withContext(`move ${i}`).not.toEqual([was.x, was.y]);
      expect(Math.hypot(now.x - (glade.x - 40 * TILE), now.y - glade.y)).toBeGreaterThan(WALKER.keep * TILE);
      // Before its third move a blow does nothing.
      if (i < WALKER.moves) expect(ev.strikeWalker(now)).withContext(`blow after move ${i}`).toBeFalse();
      step(ev, { x: now.x + 3 * TILE, y: now.y }, true, 1);
    }
    expect(ev.walker().ready).toBeTrue();
    // Looking away again does nothing now: it waits.
    const waits = ev.walker();
    step(ev, { x: glade.x - 40 * TILE, y: glade.y }, false, 1);
    expect([ev.walker().x, ev.walker().y]).toEqual([waits.x, waits.y]);
    // Too far for a blow; then within reach.
    expect(ev.strikeWalker({ x: waits.x + 5 * TILE, y: waits.y })).toBeFalse();
    expect(ev.strikeWalker({ x: waits.x + TILE, y: waits.y })).toBeTrue();
    const news = step(ev, waits, true, .25);
    expect(news.filter(n => n.kind === 'reward' && n.id === 'walking-tree').length).toBe(1);
    // Struck, it is a plain tree for the rest of the night: no second blow, no second seed.
    expect(ev.strikeWalker({ x: waits.x + TILE, y: waits.y })).toBeFalse();
    expect(step(ev, waits, true, .5).some(n => n.kind === 'reward')).toBeFalse();
    expect(ev.walker().struck).toBeTrue();
    expect(NIGHT_REWARDS['walking-tree'].stacks).toEqual([{ id: 'copy-seed', qty: 1 }]);
  });

  it('every spot it walks to stands in the Greenwood\'s open glade', () => {
    const w = new TdWorld(CONTINENTS[WALKER_AREA]);
    for (const [c, r] of [NIGHT_PLACES.walker, ...NIGHT_PLACES.walks]) {
      expect(w.walkable(c, r)).withContext(`${c},${r} ${w.ground(c, r)}`).toBeTrue();
      expect(w.objectsIn((c - 1) * TILE, (r - 1) * TILE, (c + 2) * TILE, (r + 2) * TILE).filter(o => o.kind === 'tree').length).withContext(`${c},${r}`).toBe(0);
    }
  });
});
